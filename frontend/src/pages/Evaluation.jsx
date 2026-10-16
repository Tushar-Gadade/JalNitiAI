import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api.js';
import { Card, Msg, Page, num, useAsync } from '../components/ui.jsx';

const cols = [['unmet_pct', 'Unmet %', 2], ['protected_violation_mld_days', 'Protected violation (MLD-days)', 1], ['worst_zone_mean_ratio', 'Worst residential zone (mean ratio)', 3], ['max_consecutive_rationing_days', 'Max consecutive rationing days', 0],
  ['residential_gini', 'Residential Gini', 3], ['reserve_violation_days', 'Reserve violation days', 0], ['delivery_cost', 'Delivery cost', 0], ['avg_solver_runtime_s', 'Solver s/day', 3]];
const better = { worst_zone_mean_ratio: 'max' };

export default function Evaluation() {
  const presets = useAsync(() => api.get('/evaluation/presets'));
  const [preset, setPreset] = React.useState('delayed_monsoon');
  const [res, setRes] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const run = async () => { setBusy(true); setErr(''); try { setRes(await api.post('/evaluation/run', { preset, days: 14 })); } catch (e) { setErr(e.message); } setBusy(false); };
  const best = k => { const v = res.results.map(r => r[k]); return better[k] === 'max' ? Math.max(...v) : Math.min(...v); };
  return (<Page title="Evaluation" sub="Rolling-horizon stress test of JalNiti AI against standard rules, including an ablation without fairness debt and without uncertainty scenarios. Best value in each column is highlighted.">
    <Msg kind="err">{err || presets.error}</Msg>
    <Card title="Run a 14-day experiment"><div className="row">
      <div><label htmlFor="pr">Stress scenario</label><select id="pr" value={preset} onChange={e => setPreset(e.target.value)}>{Object.entries(presets.data || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <button className="btn" onClick={run} disabled={busy}>{busy ? 'Simulating (about 10 seconds)...' : 'Run comparison'}</button></div></Card>
    {res && <><Msg kind="info">{res.note}</Msg>
      <Card title={res.label}><div className="tw"><table><thead><tr><th>Method</th>{cols.map(c => <th key={c[0]} className="n">{c[1]}</th>)}</tr></thead>
        <tbody>{res.results.map(r => <tr key={r.method} style={r.method === 'jalniti_full' ? { background: '#fff4e0' } : undefined}><td><b>{r.label}</b></td>
          {cols.map(([k, , d]) => <td key={k} className="n" style={r[k] === best(k) ? { background: '#e0f1dd', fontWeight: 700 } : undefined}>{num(r[k], d)}</td>)}</tr>)}</tbody></table></div>
        <p className="sub" style={{ marginTop: 8 }}>Baselines that hold back water to smooth releases end the run with more stored water; read unmet demand together with reserve and protected-service columns. Trade-offs: fairness can raise delivery cost, and a larger reserve can raise today's shortage.</p></Card>
      <Card title="Protected violations and unmet demand"><div style={{ height: 320 }}><ResponsiveContainer><BarChart data={res.results.map(r => ({ name: r.label.replace('JalNiti', 'JN').replace(' (full)', ''), unmet: r.unmet_pct, viol: r.protected_violation_mld_days / 10 }))}>
        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} /><YAxis /><Tooltip /><Legend />
        <Bar dataKey="unmet" name="Unmet demand %" fill="#12306b" /><Bar dataKey="viol" name="Protected violation (MLD-days / 10)" fill="#d32f2f" /></BarChart></ResponsiveContainer></div></Card></>}
  </Page>);
}
