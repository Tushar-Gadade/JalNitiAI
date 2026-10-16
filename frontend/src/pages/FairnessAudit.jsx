import React from 'react';
import { api } from '../services/api.js';
import { Card, Kpi, Loading, Msg, Page, num, pct, useAsync } from '../components/ui.jsx';

export default function FairnessAudit() {
  const { data, error, loading } = useAsync(() => api.get('/fairness/audit'));
  if (loading) return <Loading what="fairness audit" />;
  const zones = data?.zones || [];
  const withRatio = zones.filter(z => z.avg_ratio !== null);
  const lowest = [...withRatio].sort((a, b) => a.avg_ratio - b.avg_ratio).slice(0, 3);
  const highestDebt = [...zones].sort((a, b) => (b.debt || 0) - (a.debt || 0))[0];
  return (<Page title="Fairness Audit" sub="Fairness debt remembers which zones were rationed before, so the same communities are not cut again and again. Debt falls gradually once a zone receives adequate service.">
    <Msg kind="err">{error}</Msg>
    <code className="eq">debt(next) = alpha × debt(now) + beta × max(0, target ratio − delivered ratio)</code>
    <div className="grid g4" style={{ marginBottom: 18 }}>
      <Kpi value={zones.length} label="Total demand zones" />
      <Kpi value={withRatio.length} label="Zones with service history" />
      <Kpi value={highestDebt ? highestDebt.code : '—'} label={`Highest debt zone${highestDebt ? ` (${num(highestDebt.debt, 2)})` : ''}`} tone={highestDebt && highestDebt.debt > 1 ? 'warn' : ''} />
      <Kpi value={(data?.sector_shortage || []).length} label="Sectors in latest plan" />
    </div>
    {lowest.length > 0 && <Msg kind="info">Zones receiving less than their peers: {lowest.map(z => `${z.code} (${pct(z.avg_ratio)})`).join(', ')}.</Msg>}
    <div className="grid g2">
      <Card title="Zone-level service history"><div className="tw"><table><thead><tr><th>Zone</th><th className="n">Avg ratio</th><th className="n">Last ratio</th><th className="n">Consec. days</th><th className="n">Limit</th><th className="n">Fairness debt</th><th className="n">Plans</th></tr></thead>
        <tbody>{zones.map(z => <tr key={z.id} style={z.max_cut_days && z.consecutive >= z.max_cut_days ? { background: '#fdecea' } : undefined}><td><b>{z.code}</b> {z.name}</td><td className="n">{pct(z.avg_ratio)}</td><td className="n">{pct(z.last_ratio)}</td><td className="n">{z.consecutive}</td><td className="n">{z.max_cut_days || '—'}</td><td className="n">{num(z.debt, 2)}</td><td className="n">{z.approved_runs}</td></tr>)}</tbody></table></div></Card>
      <Card title="Shortage share by sector (latest plan)">
        {(data?.sector_shortage || []).length > 0
          ? <div className="tw"><table><thead><tr><th>Sector</th><th className="n">Shortage (MLD-days)</th><th className="n">Demand (MLD-days)</th><th className="n">Shortfall</th></tr></thead>
            <tbody>{(data?.sector_shortage || []).map(s => <tr key={s.type}><td>{s.type.replace('_', ' ')}</td><td className="n">{num(s.shortage)}</td><td className="n">{num(s.demand)}</td><td className="n">{pct(s.shortage / s.demand, 1)}</td></tr>)}</tbody></table></div>
          : <p>No approved plan yet — run and approve an optimization plan to see sector breakdown.</p>}
      </Card>
    </div>
    <Card title="Proposed vs approved allocations (operator overrides)">
      {data?.overrides?.length ? <div className="tw"><table><thead><tr><th>Plan</th><th>Zone</th><th className="n">Proposed (MLD)</th><th className="n">Approved (MLD)</th></tr></thead><tbody>{data.overrides.map((o, i) => <tr key={i}><td>#{o.run_id}</td><td>Z{String(o.zone_id).padStart(2, '0')}</td><td className="n">{num(o.proposed)}</td><td className="n">{num(o.approved)}</td></tr>)}</tbody></table></div> : <p>No operator overrides recorded.</p>}
    </Card>
  </Page>);
}
