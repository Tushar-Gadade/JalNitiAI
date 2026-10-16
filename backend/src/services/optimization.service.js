const { query, pool } = require('../db');
const ai = require('./ai.service');

async function currentPolicy() {
  const { rows } = await query('SELECT * FROM policy_rule WHERE active ORDER BY version DESC LIMIT 1');
  return rows[0];
}
async function fairnessState() {
  const { rows } = await query('SELECT * FROM fairness_state');
  return Object.fromEntries(rows.map(r => [r.zone_id, { debt: +r.debt_score, consecutive: r.consecutive_ration_days }]));
}

async function run(params, user) {
  const policy = await currentPolicy();
  const state = await fairnessState();
  const result = await ai.post('/optimize/run', { ...params, policy: { ...policy.params, ...(params.policy || {}) }, state });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows } = await c.query(`INSERT INTO optimization_run(created_by,horizon,params,policy_version,model_version,solver_status,objective_values,runtime_s,kpis,twin,counterfactuals,storage_paths)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [user, result.horizon, JSON.stringify(params), policy.version, result.model_version, result.kpis.solver_status, JSON.stringify({ unmet_pct: result.kpis.total_unmet_pct }),
       result.kpis.runtime_s, JSON.stringify(result.kpis), JSON.stringify(result.twin), JSON.stringify(result.counterfactuals || []), JSON.stringify(result.storage_paths)]);
    const id = rows[0].id;
    for (const a of result.allocations)
      await c.query(`INSERT INTO allocation_decision(run_id,zone_id,day,ts,demand_mld,allocated_mld,approved_mld,shortage_mld,satisfaction,ration_stage,ration_level,reason_code,explanation)
        VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12)`,
        [id, a.zone_id, a.day, a.date, a.demand_mld, a.allocated_mld, a.shortage_mld, a.satisfaction, a.ration_stage, a.ration_level, a.reason_code, a.explanation]);
    await c.query('COMMIT');
    return { id, status: 'pending', ...result };
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

async function get(id) {
  const { rows: [r] } = await query('SELECT * FROM optimization_run WHERE id=$1', [id]);
  if (!r) { const e = new Error('Run not found'); e.status = 404; throw e; }
  const { rows: alloc } = await query(`SELECT a.*, z.code zone_code, z.name zone_name, z.type zone_type, f.debt_score fairness_debt
    FROM allocation_decision a JOIN demand_zone z ON z.id=a.zone_id LEFT JOIN fairness_state f ON f.zone_id=z.id WHERE run_id=$1 ORDER BY day, zone_id`, [id]);
  return { ...r, allocations: alloc.map(a => ({ ...a, demand_mld: +a.demand_mld, allocated_mld: +a.allocated_mld, approved_mld: +a.approved_mld,
    shortage_mld: +a.shortage_mld, satisfaction: +a.satisfaction, fairness_debt: +a.fairness_debt, date: a.ts })) };
}
async function list() {
  return (await query('SELECT id, created_at, created_by, horizon, status, solver_status, kpis FROM optimization_run ORDER BY id DESC LIMIT 30')).rows;
}
module.exports = { run, get, list, currentPolicy };
