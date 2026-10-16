import React from 'react';
import { api, getUser } from '../services/api.js';
import { Card, Kpi, Loading, Msg, Page, StageBadge, StageLegend, num, pct, useAsync } from '../components/ui.jsx';

export default function OptimizationRun() {
  const hist = useAsync(() => api.get('/optimization'));
  const [run, setRun] = React.useState(null);
  const [expl, setExpl] = React.useState(null);
  const [day, setDay] = React.useState(0);
  const [horizon, setHorizon] = React.useState(7);
  const [busy, setBusy] = React.useState(false);
  const [m, setM] = React.useState({ k: 'info', t: '' });
  const [comment, setComment] = React.useState('');
  const [ov, setOv] = React.useState({});
  const can = ['operator', 'admin'].includes(getUser()?.role);

  const open = async id => { setM({ k: 'info', t: '' }); setOv({}); setDay(0); const r = await api.get(`/optimization/${id}`); setRun(r); setExpl(await api.get(`/optimization/${id}/explanations`)); };
  React.useEffect(() => { if (hist.data?.length && !run) open(hist.data[0].id).catch(e => setM({ k: 'err', t: e.message })); }, [hist.data]); // eslint-disable-line
  const generate = async () => {
    setBusy(true); setM({ k: 'info', t: '' });
    try { const r = await api.post('/optimization/run', { horizon: +horizon }); await open(r.id); hist.reload(); } catch (e) { setM({ k: 'err', t: e.message }); }
    setBusy(false);
  };
  const decide = async decision => {
    const overrides = Object.entries(ov).filter(([, v]) => v !== '').map(([zone_id, v]) => ({ zone_id: +zone_id, day: 0, allocated_mld: +v }));
    try { const r = await api.post(`/optimization/${run.id}/approve`, { decision, comment, overrides }); setM({ k: 'ok', t: `Plan #${run.id} ${r.status}. ${decision === 'approve' ? 'Fairness debt has been updated from the approved allocation.' : ''}` }); await open(run.id); hist.reload(); }
    catch (e) { setM({ k: 'err', t: e.message }); }
  };
  if (hist.loading) return <Loading what="plans" />;
  const rows = (run?.allocations || []).filter(a => a.day === day);
  const k = run?.kpis, twin = run?.twin;
  const ctr = (expl?.counterfactuals || []);
  return (<Page title="Allocation Plan" sub="The optimiser recommends a multi-day schedule. Review the reasons, the digital-twin checks and the alternatives, then approve or reject. Changing a protected allocation requires a written reason.">
    <Msg kind={m.k}>{m.t}</Msg><Msg kind="err">{hist.error}</Msg>
    <Card title="Generate or open a plan"><div className="row">
      {can && <><div><label htmlFor="h">Planning horizon (days)</label><select id="h" value={horizon} onChange={e => setHorizon(e.target.value)}>{[3, 5, 7, 10, 14].map(n => <option key={n}>{n}</option>)}</select></div>
        <button className="btn" onClick={generate} disabled={busy}>{busy ? 'Optimising...' : 'Run optimiser'}</button></>}
      <div><label htmlFor="o">Previous plans</label><select id="o" value={run?.id || ''} onChange={e => open(e.target.value)}>
        {(hist.data || []).map(r => <option key={r.id} value={r.id}>#{r.id} - {new Date(r.created_at).toLocaleString('en-IN')} - {r.status}</option>)}</select></div>
    </div></Card>
    {!run && <p>No plans yet. Run the optimiser to create one.</p>}
    {run && <>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <Kpi value={`${num(k.total_unmet_pct)}%`} label="Unmet demand over horizon" tone={k.total_unmet_pct > 20 ? 'bad' : 'warn'} />
        <Kpi value={`${num(k.protected_violation_mld, 2)} MLD`} label="Protected-minimum violation" tone={k.protected_violation_mld > 0 ? 'bad' : 'good'} />
        <Kpi value={pct(k.worst_zone_ratio_day1)} label="Worst zone satisfaction (day 1)" />
        <Kpi value={num(k.residential_gini_day1, 3)} label="Residential Gini (day 1)" />
        <Kpi value={`${num(k.min_dry_storage_mcm, 2)} MCM`} label={`Lowest dry-scenario storage (reserve ${num(k.reserve_mcm, 2)})`} tone={k.reserve_shortfall_mcm > 0 ? 'warn' : 'good'} />
        <Kpi value={`${k.solver_status} (${k.runtime_s}s)`} label="Solver status" />
      </div>
      <Card title="Digital-twin validation"><div className="tw"><table><tbody>{twin.checks.map(c => <tr key={c.check}><td style={{ width: 90 }}><span className={`badge ${c.status.toLowerCase()}`}>{c.status}</span></td><td><b>{c.check}</b></td><td>{c.detail}</td></tr>)}</tbody></table></div>
        <p className="sub" style={{ marginTop: 8 }}>{twin.feasible_and_safe ? 'The plan is feasible and safe to submit for approval.' : 'The plan has a failed check. Do not approve without a documented override.'}</p></Card>
      <Card title={`Allocation for day ${day + 1} (${rows[0]?.date || ''})`}>
        <div className="row" style={{ marginBottom: 8 }}><div><label htmlFor="dy">Day</label><select id="dy" value={day} onChange={e => setDay(+e.target.value)}>{Array.from({ length: run.horizon }, (_, i) => <option key={i} value={i}>Day {i + 1}</option>)}</select></div></div>
        <StageLegend />
        <div className="tw"><table><thead><tr><th>Zone</th><th className="n">Demand (MLD)</th><th className="n">Recommended (MLD)</th>{run.status === 'pending' && day === 0 && can && <th className="n">Override (MLD)</th>}<th>Satisfaction</th><th>Stage</th><th>Why</th></tr></thead>
          <tbody>{rows.map(a => <tr key={a.zone_id}><td><b>{a.zone_code}</b> {a.zone_name}</td><td className="n">{num(a.demand_mld)}</td><td className="n">{num(a.allocated_mld)}{+a.approved_mld !== +a.allocated_mld && <><br /><small>approved {num(a.approved_mld)}</small></>}</td>
            {run.status === 'pending' && day === 0 && can && <td className="n"><input aria-label={`Override for ${a.zone_name}`} type="number" step="0.1" min="0" style={{ width: 90 }} value={ov[a.zone_id] ?? ''} onChange={e => setOv({ ...ov, [a.zone_id]: e.target.value })} /></td>}
            <td><div className="bar"><i style={{ width: pct(a.satisfaction) }} /></div>{pct(a.satisfaction)}</td><td><StageBadge n={a.ration_stage} /></td><td><small><b>{a.reason_code.replace(/_/g, ' ').toLowerCase()}</b><br />{a.explanation}</small></td></tr>)}</tbody></table></div>
      </Card>
      {ctr.length > 0 && <Card title="Counterfactual alternatives (what if?)"><ul>{ctr.map((c, i) => <li key={i}><b>{c.lever}:</b> {c.message}</li>)}</ul></Card>}
      {run.status === 'pending' && can && <Card title="Operator decision">
        <div className="fld"><label htmlFor="cm">Comment (required, 10+ characters, if you change a hospital or essential-industry allocation)</label><textarea id="cm" rows="3" style={{ width: '100%' }} value={comment} onChange={e => setComment(e.target.value)} /></div>
        <div className="row"><button className="btn go" onClick={() => decide('approve')}>Approve plan</button><button className="btn stop" onClick={() => decide('reject')}>Reject plan</button></div>
        <p className="sub" style={{ marginTop: 8 }}>The original recommendation is always preserved, and every decision is written to the audit log.</p></Card>}
      {run.status !== 'pending' && <Msg kind={run.status === 'approved' ? 'ok' : 'info'}>This plan is {run.status}.</Msg>}
    </>}
  </Page>);
}
