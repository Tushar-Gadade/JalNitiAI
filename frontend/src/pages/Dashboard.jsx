import React from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, stageColor, stageName } from '../services/api.js';
import { Card, Kpi, Loading, Msg, Page, StageBadge, StageLegend, num, pct, useAsync } from '../components/ui.jsx';

export default function Dashboard() {
  const res = useAsync(() => api.get('/reservoirs/1/status'));
  const runs = useAsync(async () => { const l = await api.get('/optimization'); return l.length ? api.get(`/optimization/${l[0].id}`) : null; });
  const [sel, setSel] = React.useState(null);
  if (res.loading || runs.loading) return <Loading what="dashboard" />;
  const r = res.data, run = runs.data, k = run?.kpis;
  const day1 = (run?.allocations || []).filter(a => a.day === 0);
  const alerts = [];
  if (run?.status === 'pending') alerts.push(['info', `Plan #${run.id} is waiting for operator approval.`]);
  (run?.twin?.checks || []).filter(c => c.status !== 'PASS').forEach(c => alerts.push([c.status === 'FAIL' ? 'err' : 'info', `${c.check}: ${c.detail}`]));
  const s = sel || day1[0];
  return (<Page title="Command Dashboard" sub="Current reservoir position, scarcity stage and the latest recommended allocation. Water is never cut automatically; every plan needs human approval.">
    <Msg kind="err">{res.error || runs.error}</Msg>
    <div className="grid g4" style={{ marginBottom: 18 }}>
      <Kpi value={`${num(r?.fill_pct)}%`} label={`System storage (${num(r?.latest?.storage_mcm, 0)} of ${num(r?.reservoir?.capacity_mcm, 0)} MCM)`} />
      <Kpi value={`${num(r?.city_allocable_mcm, 2)} MCM`} label="City-allocable storage (planning window)" />
      <Kpi value={k ? `${k.days_of_safe_supply} days` : '-'} label="Days of safe supply at planned draw" tone={k && k.days_of_safe_supply < 7 ? 'warn' : ''} />
      <Kpi value={k ? stageName(k.scarcity_stage) : 'No plan yet'} label="Scarcity stage (day 1)" tone={k && k.scarcity_stage >= 3 ? 'bad' : k && k.scarcity_stage >= 1 ? 'warn' : 'good'} />
      <Kpi value={k ? `${num(k.reserve_mcm, 2)} MCM` : '-'} label="Protected reserve (uncertainty-adjusted)" />
      <Kpi value={k ? `${num(k.total_unmet_pct)}%` : '-'} label="Unmet demand over horizon" tone={k && k.total_unmet_pct > 20 ? 'bad' : ''} />
    </div>
    {alerts.map((a, i) => <Msg key={i} kind={a[0]}>{a[1]}</Msg>)}
    {!run && <Card><p>No allocation plan has been generated yet.</p><Link className="btn" to="/optimization" style={{ textDecoration: 'none', display: 'inline-block' }}>Generate today's plan</Link></Card>}
    {run && <div className="grid g2">
      <Card title={`Allocation map: plan #${run.id} (${run.status}), day 1`}>
        <StageLegend />
        <div className="zones">
          {day1.map(a => <button key={a.zone_id} className={`zt ${['hospital', 'industry_essential'].includes(a.zone_type) ? 'prot' : ''}`} style={{ borderLeftColor: stageColor(a.ration_stage) }} onClick={() => setSel(a)}>
            <b>{a.zone_code} {a.zone_name}</b><small>{num(a.allocated_mld)} of {num(a.demand_mld)} MLD ({pct(a.satisfaction)})</small></button>)}
        </div>
        {s && <div className="msg info" style={{ marginTop: 12 }}><b>{s.zone_name}</b>: demand {num(s.demand_mld)} MLD, allocation {num(s.allocated_mld)} MLD, satisfaction {pct(s.satisfaction)}, fairness debt {num(s.fairness_debt, 2)}. <StageBadge n={s.ration_stage} /><br />{s.explanation}</div>}
      </Card>
      <Card title="Reservoir storage, last 60 days (MCM)">
        <div style={{ height: 280 }}><ResponsiveContainer><AreaChart data={r.history}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={30} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
          <Area dataKey="storage_mcm" name="Storage (MCM)" stroke="#12306b" fill="#9db4e0" /></AreaChart></ResponsiveContainer></div>
        <p className="sub">Source: {r.latest?.source} ({r.latest?.quality_flag}). {r.latest?.source === 'synthetic' && 'Synthetic series - replace with India-WRIS/CWC data (see README).'}</p>
      </Card>
    </div>}
  </Page>);
}
