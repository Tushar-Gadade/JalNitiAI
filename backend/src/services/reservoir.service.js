const { query } = require('../db');
const ai = require('./ai.service');

async function seed() {
  const { rows } = await query('SELECT count(*)::int n FROM demand_zone');
  if (rows[0].n > 0) return;
  console.log('[seed] loading zones, reservoir, policy and readings from AI service');
  const [zones, st, pol] = await Promise.all([ai.get('/zones'), ai.get('/reservoir/status'), ai.get('/policy/defaults')]);
  const r = st.reservoir;
  await query('INSERT INTO reservoir(id,name,state,capacity_mcm,dead_storage_mcm,city_share) VALUES (1,$1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
    [r.name, r.state, r.capacity_mcm, r.dead_storage_mcm, r.city_share]);
  for (const z of zones) {
    await query(`INSERT INTO demand_zone(id,code,name,type,population,base_mld,min_mld,vulnerability_score,criticality_score,priority,max_cut_days,capacity_mld,loss)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`,
      [z.id, z.code, z.name, z.type, z.population, z.base_mld, z.min_mld, z.vulnerability, z.criticality, z.priority, z.max_cut_days, z.capacity_mld, z.loss]);
    await query('INSERT INTO fairness_state(zone_id) VALUES ($1) ON CONFLICT DO NOTHING', [z.id]);
    if (z.type === 'hospital') await query('INSERT INTO critical_facility(zone_id,facility_type,minimum_need_mld,operating_hours) VALUES ($1,$2,$3,$4)', [z.id, 'Hospital cluster', z.min_mld, '24x7']);
  }
  await query('INSERT INTO policy_rule(version,params,changed_by) VALUES (1,$1,$2)', [JSON.stringify(pol), 'system']);
  for (const h of st.history)
    await query('INSERT INTO reservoir_reading(reservoir_id,ts,storage_mcm,inflow_mcm,source,quality_flag) VALUES (1,$1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [h.date, h.storage_mcm, h.inflow_mcm, st.source, st.quality_flag]);
}

async function addReading({ ts, storage_mcm, inflow_mcm = 0, source = 'manual' }) {
  const [res] = (await query('SELECT capacity_mcm FROM reservoir WHERE id=1')).rows;
  const s = Number(storage_mcm);
  if (!ts || Number.isNaN(s) || s < 0 || s > Number(res.capacity_mcm) * 1.02) {
    const e = new Error('Storage must be between 0 and reservoir capacity; date is required'); e.status = 400; throw e;
  }
  const { rows } = await query(`INSERT INTO reservoir_reading(reservoir_id,ts,storage_mcm,inflow_mcm,source,quality_flag)
    VALUES (1,$1,$2,$3,$4,'OK') ON CONFLICT (reservoir_id,ts) DO UPDATE SET storage_mcm=$2, inflow_mcm=$3, source=$4 RETURNING *`, [ts, s, inflow_mcm, source]);
  return rows[0];
}

async function status(id = 1) {
  const [r] = (await query('SELECT * FROM reservoir WHERE id=$1', [id])).rows;
  if (!r) { const e = new Error('Reservoir not found'); e.status = 404; throw e; }
  const hist = (await query('SELECT ts::text AS date, storage_mcm::float, inflow_mcm::float, source, quality_flag FROM reservoir_reading WHERE reservoir_id=$1 ORDER BY ts DESC LIMIT 60', [id])).rows.reverse();
  const last = hist[hist.length - 1];
  const stale = last ? (Date.now() - new Date(last.date).getTime()) / 86400000 > 7 : true;
  return { reservoir: r, latest: last, fill_pct: last ? +(last.storage_mcm / r.capacity_mcm * 100).toFixed(1) : null,
           city_allocable_mcm: last ? +(last.storage_mcm * r.city_share).toFixed(3) : null, stale_data_alert: stale, history: hist };
}
module.exports = { seed, addReading, status };
