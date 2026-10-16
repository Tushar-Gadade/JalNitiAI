const express = require('express');
const { query } = require('../db');
const { login, requireAuth, requireRole } = require('../middleware/auth');
const ai = require('../services/ai.service');
const reservoir = require('../services/reservoir.service');
const demand = require('../services/demand.service');
const optimization = require('../services/optimization.service');
const approval = require('../services/approval.service');
const audit = require('../services/audit.service');

const r = express.Router();
const h = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

r.get('/health', h(async (_q, res) => {
  let ai_ok = false; try { await ai.get('/health'); ai_ok = true; } catch {}
  await query('SELECT 1'); res.json({ status: 'ok', database: true, ai_service: ai_ok });
}));
r.post('/auth/login', login);
r.use(requireAuth);
r.get('/auth/me', (req, res) => res.json({ user: { username: req.user.sub, role: req.user.role } }));

// Reservoir
r.post('/reservoir-readings', requireRole('operator'), h(async (req, res) => {
  const row = await reservoir.addReading(req.body); await audit.log(req.user.sub, 'create', 'reservoir_reading', row.id, null, row); res.status(201).json(row);
}));
r.get('/reservoirs/:id/status', h(async (req, res) => res.json(await reservoir.status(+req.params.id))));

// Zones, demand
r.get('/zones', h(async (_q, res) => res.json((await query(`SELECT z.*, f.debt_score::float, f.consecutive_ration_days, f.last_ratio::float
  FROM demand_zone z LEFT JOIN fairness_state f ON f.zone_id=z.id ORDER BY z.id`)).rows)));
r.post('/demand-readings/import', requireRole('operator'), express.text({ type: ['text/csv', 'text/plain'], limit: '5mb' }), h(async (req, res) => {
  if (typeof req.body !== 'string') return res.status(400).json({ error: 'Send CSV text with Content-Type: text/csv' });
  const out = await demand.importCsv(req.body); await audit.log(req.user.sub, 'import', 'demand_reading', '', null, out); res.json(out);
}));

// Forecasts
r.post('/forecasts/run', requireRole('operator'), h(async (req, res) => {
  const f = await ai.post('/forecast/run', { horizon: 7, ...(req.body || {}) });
  const { rows: [run] } = await query('INSERT INTO forecast_run(model_version,horizon,metrics,uncertainty_method) VALUES ($1,$2,$3,$4) RETURNING id',
    ['gbr-quantile-1.0', f.horizon, JSON.stringify(f.metrics), 'quantile 10/90 + scenario percentiles']);
  for (const d of f.demand) await query('INSERT INTO demand_forecast(forecast_run_id,zone_id,ts,lower,predicted,upper) VALUES ($1,$2,$3,$4,$5,$6)', [run.id, d.zone_id, d.date, d.lower, d.predicted, d.upper]);
  res.json({ forecast_run_id: run.id, ...f });
}));
r.get('/forecasts/metrics', h(async (_q, res) => res.json(await ai.get('/forecast/metrics'))));

// Optimisation
r.post('/optimization/run', requireRole('operator'), h(async (req, res) => {
  const out = await optimization.run(req.body || {}, req.user.sub);
  await audit.log(req.user.sub, 'run', 'optimization_run', out.id, null, { params: req.body, kpis: out.kpis }); res.status(201).json(out);
}));
r.get('/optimization', h(async (_q, res) => res.json(await optimization.list())));
r.get('/optimization/:id', h(async (req, res) => res.json(await optimization.get(+req.params.id))));
r.get('/optimization/:id/explanations', h(async (req, res) => {
  const run = await optimization.get(+req.params.id);
  res.json({ reasons: run.allocations.map(a => ({ zone_id: a.zone_id, zone_name: a.zone_name, day: a.day, reason_code: a.reason_code, explanation: a.explanation })),
             counterfactuals: run.counterfactuals, twin: run.twin });
}));
r.post('/optimization/:id/approve', requireRole('operator'), h(async (req, res) => res.json(await approval.decide(+req.params.id, req.body || {}, req.user.sub))));

// Scenarios, evaluation
r.get('/scenarios/presets', h(async (_q, res) => res.json(await ai.get('/scenarios/presets'))));
r.post('/scenarios/compare', h(async (req, res) => {
  const st = Object.fromEntries((await query('SELECT * FROM fairness_state')).rows.map(x => [x.zone_id, { debt: +x.debt_score, consecutive: x.consecutive_ration_days }]));
  const pol = (await optimization.currentPolicy()).params;
  const body = req.body || {}; body.base = { ...(body.base || {}), state: st, policy: pol };
  res.json(await ai.post('/scenarios/compare', body));
}));
r.get('/evaluation/presets', h(async (_q, res) => res.json(await ai.get('/evaluate/presets'))));
r.post('/evaluation/run', h(async (req, res) => res.json(await ai.post('/evaluate/run', req.body || {}))));

// Fairness audit
r.get('/fairness/audit', h(async (_q, res) => {
  const zones = (await query(`SELECT z.id, z.code, z.name, z.type, z.max_cut_days, f.debt_score::float debt, f.consecutive_ration_days consecutive, f.last_ratio::float last_ratio
    FROM demand_zone z JOIN fairness_state f ON f.zone_id=z.id ORDER BY z.id`)).rows;
  const hist = (await query(`SELECT a.zone_id, a.run_id, a.satisfaction::float s, (a.approved_mld/NULLIF(a.demand_mld,0))::float approved_ratio
    FROM allocation_decision a JOIN optimization_run o ON o.id=a.run_id WHERE o.status='approved' AND a.day=0 ORDER BY a.run_id DESC LIMIT 300`)).rows;
  const sector = (await query(`SELECT z.type, sum(a.shortage_mld)::float shortage, sum(a.demand_mld)::float demand FROM allocation_decision a
    JOIN demand_zone z ON z.id=a.zone_id WHERE a.run_id=(SELECT max(id) FROM optimization_run) GROUP BY z.type`)).rows;
  const diff = (await query(`SELECT run_id, zone_id, allocated_mld::float proposed, approved_mld::float approved FROM allocation_decision
    WHERE day=0 AND abs(allocated_mld-approved_mld)>0.001 ORDER BY run_id DESC LIMIT 50`)).rows;
  const byZone = {}; hist.forEach(x => (byZone[x.zone_id] ||= []).push(x.approved_ratio));
  res.json({ zones: zones.map(z => ({ ...z, avg_ratio: byZone[z.id] ? byZone[z.id].reduce((p, c) => p + c, 0) / byZone[z.id].length : null, approved_runs: (byZone[z.id] || []).length })),
             sector_shortage: sector, overrides: diff });
}));

// Policy
r.get('/policies', h(async (_q, res) => res.json(await optimization.currentPolicy())));
r.put('/policies/:id', requireRole('admin'), h(async (req, res) => {
  const cur = await optimization.currentPolicy(); const p = req.body?.params || {};
  const num = (k, lo, hi) => { if (k in p && !(typeof p[k] === 'number' && p[k] >= lo && p[k] <= hi)) { const e = new Error(`${k} must be a number between ${lo} and ${hi}`); e.status = 400; throw e; } };
  num('alpha', 0, 1); num('beta', 0, 20); num('debt_weight', 0, 20); num('reserve_days', 0, 10); num('inequity_weight', 0, 5000); num('repeat_cut_weight', 0, 5000);
  const next = { ...cur.params, ...p };
  await query('UPDATE policy_rule SET active=false WHERE active');
  const { rows: [n] } = await query('INSERT INTO policy_rule(version,params,changed_by) VALUES ($1,$2,$3) RETURNING *', [cur.version + 1, JSON.stringify(next), req.user.sub]);
  await audit.log(req.user.sub, 'update', 'policy_rule', n.version, cur.params, next); res.json(n);
}));
r.get('/audit-logs', h(async (_q, res) => res.json((await query('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100')).rows)));
module.exports = r;
