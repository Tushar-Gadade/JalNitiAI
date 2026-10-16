import React from 'react';
import { api, getUser } from '../services/api.js';
import { Card, Loading, Msg, Page, useAsync } from '../components/ui.jsx';

const fields = [['alpha', 'Fairness-debt memory (alpha, 0-1)', 0.05], ['beta', 'Debt added per missed target (beta)', 0.5], ['debt_weight', 'Protection strength of debt', 0.5],
  ['reserve_days', 'Strategic reserve (days of demand)', 0.25], ['inequity_weight', 'Inequity penalty weight', 10], ['repeat_cut_weight', 'Repeat-rationing penalty weight', 10]];

export default function PolicySettings() {
  const pol = useAsync(() => api.get('/policies'));
  const logs = useAsync(() => api.get('/audit-logs'));
  const [f, setF] = React.useState(null);
  const [m, setM] = React.useState({ k: 'info', t: '' });
  const admin = getUser()?.role === 'admin';
  React.useEffect(() => { if (pol.data && !f) setF(pol.data.params); }, [pol.data]); // eslint-disable-line
  const save = async e => {
    e.preventDefault();
    try { const params = Object.fromEntries(fields.map(([k]) => [k, +f[k]])); const r = await api.put(`/policies/${pol.data.id}`, { params }); setM({ k: 'ok', t: `Policy version ${r.version} saved and logged.` }); pol.reload(); logs.reload(); }
    catch (x) { setM({ k: 'err', t: x.message }); }
  };
  if (pol.loading || !f) return <Loading what="policy" />;
  return (<Page title="Policy & Audit" sub="Policy parameters are visible to all operators and editable only by administrators. Every change creates a new version and an audit entry so any recommendation can be reproduced.">
    <Msg kind="err">{pol.error}</Msg><Msg kind={m.k}>{m.t}</Msg>
    <Card title={`Active policy: version ${pol.data.version}`}>
      <form onSubmit={save}><div className="row">{fields.map(([k, l, st]) => <div className="fld" key={k}><label htmlFor={k}>{l}</label><input id={k} type="number" step={st} disabled={!admin} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} style={{ width: 150 }} /></div>)}</div>
        {admin ? <button className="btn" type="submit">Save new policy version</button> : <p className="sub">Sign in as an administrator to change policy.</p>}</form>
      <p className="sub" style={{ marginTop: 10 }}>Protected minimums per zone (55 litres per person per day for households, set per zone) are policy inputs, not hard-coded truths. Confirm them against your local service standard.</p></Card>
    <Card title="Audit log (latest 100)"><div className="tw"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead>
      <tbody>{(logs.data || []).map(l => <tr key={l.id}><td>{new Date(l.ts).toLocaleString('en-IN')}</td><td>{l.actor}</td><td>{l.action}</td><td>{l.entity} {l.entity_id}</td></tr>)}</tbody></table></div></Card>
  </Page>);
}
