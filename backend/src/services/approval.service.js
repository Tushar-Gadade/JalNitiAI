const { query, pool } = require('../db');
const ai = require('./ai.service');
const audit = require('./audit.service');
const optimization = require('./optimization.service');

async function decide(runId, { decision, comment, overrides = [], actual = {} }, user) {
  if (!['approve', 'reject'].includes(decision)) { const e = new Error('decision must be approve or reject'); e.status = 400; throw e; }
  const run = await optimization.get(runId);
  if (run.status !== 'pending') { const e = new Error(`Run already ${run.status}`); e.status = 409; throw e; }
  const protectedZones = new Set(run.allocations.filter(a => ['hospital', 'industry_essential'].includes(a.zone_type)).map(a => a.zone_id));
  if (decision === 'approve' && overrides.some(o => protectedZones.has(o.zone_id)) && !(comment && comment.trim().length >= 10)) {
    const e = new Error('A reason (min 10 characters) is required when changing a protected allocation'); e.status = 400; throw e;
  }
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const o of overrides) {
      if (!(o.allocated_mld >= 0)) continue;
      await c.query('UPDATE allocation_decision SET approved_mld=$1 WHERE run_id=$2 AND zone_id=$3 AND day=$4', [o.allocated_mld, runId, o.zone_id, o.day ?? 0]);
    }
    await c.query('UPDATE optimization_run SET status=$1 WHERE id=$2', [decision === 'approve' ? 'approved' : 'rejected', runId]);
    await c.query('INSERT INTO approval(run_id,operator,decision,comment,overrides) VALUES ($1,$2,$3,$4,$5)', [runId, user, decision, comment || null, JSON.stringify(overrides)]);
    if (decision === 'approve') {   // feed measured/approved day-1 delivery back into fairness memory
      const { rows } = await c.query('SELECT zone_id, demand_mld, approved_mld FROM allocation_decision WHERE run_id=$1 AND day=0', [runId]);
      const st = (await c.query('SELECT * FROM fairness_state')).rows;
      const state = Object.fromEntries(st.map(r => [r.zone_id, { debt: +r.debt_score, consecutive: r.consecutive_ration_days }]));
      const pol = (await optimization.currentPolicy()).params;
      const delivered = Object.fromEntries(rows.map(r => [r.zone_id, actual[r.zone_id] ?? +r.approved_mld]));
      const demand = Object.fromEntries(rows.map(r => [r.zone_id, +r.demand_mld]));
      const next = await ai.post('/fairness/update', { state, delivered, demand, policy: pol });
      for (const [zid, s] of Object.entries(next))
        await c.query('UPDATE fairness_state SET debt_score=$1, consecutive_ration_days=$2, last_ratio=$3, updated_at=now() WHERE zone_id=$4', [s.debt, s.consecutive, s.last_ratio, zid]);
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  await audit.log(user, decision, 'optimization_run', runId, { status: 'pending' }, { status: decision, comment, overrides });
  return { id: runId, status: decision === 'approve' ? 'approved' : 'rejected' };
}
module.exports = { decide };
