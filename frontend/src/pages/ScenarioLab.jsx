import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api.js';
import { Card, Loading, Msg, Page, num, pct } from '../components/ui.jsx';

export default function ScenarioLab() {
  const [p, setP] = React.useState({ inflow_factor: 1, demand_growth: 0, reserve_days: 1, storage_factor: 1, outage_zone: '', outage_cap: 40 });
  const [out, setOut] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }));
  const run = React.useCallback(async (params) => {
    setBusy(true); setErr('');
    try {
      const presets = await api.get('/scenarios/presets');
      const current = params || p;
      const custom = { inflow_factor: +current.inflow_factor, demand_growth: +current.demand_growth / 100, reserve_days: +current.reserve_days, storage_factor: +current.storage_factor,
        ...(current.outage_zone ? { outages: { [current.outage_zone]: current.outage_cap / 100 } } : {}) };
      setOut(await api.post('/scenarios/compare', { scenarios: [{ name: 'Your custom scenario', params: custom }, ...presets.map(x => ({ name: x.name, params: x.params }))] }));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }, [p]);
  React.useEffect(() => { run(p); }, []);
  const Slider = ({ id, label, min, max, step, unit = '' }) => (<div className="fld"><label htmlFor={id}>{label}: <b>{p[id]}{unit}</b></label>
    <input id={id} type="range" min={min} max={max} step={step} value={p[id]} onChange={e => set(id, e.target.value)} style={{ width: '100%' }} /></div>);
  return (<Page title="Scenario Lab" sub="Adjust rainfall, demand growth, reserve policy or a pipe outage, then compare the optimiser's response with standard scenarios. Nothing here changes live supply.">
    <Msg kind="err">{err}</Msg>
    <Card title="Scenario settings"><div className="grid g2">
      <div><Slider id="inflow_factor" label="Rainfall / inflow multiplier" min="0" max="2" step="0.1" /><Slider id="demand_growth" label="Demand growth" min="-10" max="30" step="1" unit="%" />
        <Slider id="storage_factor" label="Starting storage multiplier" min="0.3" max="1.5" step="0.05" /></div>
      <div><Slider id="reserve_days" label="Strategic reserve (days of demand)" min="0" max="3" step="0.25" />
        <div className="row"><div><label htmlFor="oz">Simulated pipe outage in zone</label><select id="oz" value={p.outage_zone} onChange={e => set('outage_zone', e.target.value)}><option value="">None</option>{[1, 2, 3, 4, 5, 6, 7, 8].map(i => <option key={i} value={i}>Z{String(i).padStart(2, '0')}</option>)}</select></div>
          <div><label htmlFor="oc">Remaining capacity (%)</label><input id="oc" type="number" min="0" max="100" value={p.outage_cap} onChange={e => set('outage_cap', e.target.value)} style={{ width: 90 }} /></div></div></div>
    </div><button className="btn" onClick={() => run()} disabled={busy} style={{ marginTop: 8 }}>{busy ? 'Running scenarios...' : 'Re-run with custom settings'}</button></Card>
    {busy && !out && <Loading what="scenarios" />}
    {out && <><Card title="Comparison"><div className="tw"><table><thead><tr><th>Scenario</th><th className="n">Unmet %</th><th className="n">Protected violation (MLD)</th><th className="n">Worst zone (day 1)</th><th className="n">Residential Gini</th><th className="n">Lowest dry storage (MCM)</th><th>Scarcity stage</th><th>Twin</th></tr></thead>
      <tbody>{out.map(o => <tr key={o.name}><td><b>{o.name}</b></td><td className="n">{num(o.kpis.total_unmet_pct)}</td><td className="n">{num(o.kpis.protected_violation_mld, 2)}</td><td className="n">{pct(o.kpis.worst_zone_ratio_day1)}</td><td className="n">{num(o.kpis.residential_gini_day1, 3)}</td><td className="n">{num(o.kpis.min_dry_storage_mcm, 2)}</td><td>{o.kpis.scarcity_stage_name.replace(/_/g, ' ').toLowerCase()}</td><td><span className={`badge ${o.twin_ok ? 'pass' : 'fail'}`}>{o.twin_ok ? 'PASS' : 'FAIL'}</span></td></tr>)}</tbody></table></div></Card>
      <Card title="Unmet demand and protected violations by scenario"><div style={{ height: 300 }}><ResponsiveContainer><BarChart data={out.map(o => ({ name: o.name.split(' (')[0], unmet: o.kpis.total_unmet_pct, viol: o.kpis.protected_violation_mld }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Legend />
        <Bar dataKey="unmet" name="Unmet demand %" fill="#12306b" /><Bar dataKey="viol" name="Protected violation (MLD)" fill="#d32f2f" /></BarChart></ResponsiveContainer></div></Card></>
    }
  </Page>);
}
