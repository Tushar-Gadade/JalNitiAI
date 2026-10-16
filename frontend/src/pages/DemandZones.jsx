import React from 'react';
import { api } from '../services/api.js';
import { Card, Loading, Msg, Page, num, useAsync } from '../components/ui.jsx';

export default function DemandZones() {
  const z = useAsync(() => api.get('/zones'));
  if (z.loading) return <Loading what="zones" />;
  return (<Page title="Demand Zones" sub="Consumer zones with their protected minimums, vulnerability and criticality scores.">
    <Msg kind="err">{z.error}</Msg>
    <Card title="Zones"><div className="tw"><table><thead><tr><th>Code</th><th>Zone</th><th>Type</th><th className="n">Population</th><th className="n">Demand (MLD)</th><th className="n">Protected min (MLD)</th><th className="n">Vulnerability</th><th className="n">Criticality</th><th className="n">Max cut days</th><th className="n">Fairness debt</th></tr></thead>
      <tbody>{z.data.map(r => <tr key={r.id}><td>{r.code}</td><td>{r.name}</td><td>{r.type.replace('_', ' ')}</td><td className="n">{r.population ? r.population.toLocaleString('en-IN') : '-'}</td><td className="n">{num(r.base_mld)}</td><td className="n">{num(r.min_mld)}</td>
        <td className="n">{num(r.vulnerability_score, 2)}</td><td className="n">{num(r.criticality_score, 2)}</td><td className="n">{r.max_cut_days}</td><td className="n">{num(r.debt_score, 2)}</td></tr>)}</tbody></table></div></Card>
  </Page>);
}
