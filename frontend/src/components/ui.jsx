import React from 'react';
import { stageName } from '../services/api.js';

export const Kpi = ({ value, label, tone }) => <div className={`kpi ${tone || ''}`}><b>{value}</b><span>{label}</span></div>;
export const StageBadge = ({ n }) => <span className={`badge st${n}`}>{stageName(n)}</span>;
export const Msg = ({ kind = 'info', children }) => children ? <div className={`msg ${kind}`} role={kind === 'err' ? 'alert' : 'status'}>{children}</div> : null;
export const Page = ({ title, sub, children }) => (<><h2 className="pt">{title}</h2><p className="sub">{sub}</p>{children}</>);
export const Card = ({ title, children }) => <section className="card">{title && <h3>{title}</h3>}{children}</section>;
export const Loading = ({ what = 'data' }) => <p role="status">Loading {what}...</p>;
export const StageLegend = () => (
  <div className="legend" aria-label="Rationing stage legend">
    {[0, 1, 2, 3, 4, 5].map(n => <span key={n} style={{ '--c': `var(--s${n})` }}>{stageName(n)}</span>)}
    <span style={{ '--c': '#1f6fe5' }}>Blue outline: protected facility</span>
  </div>
);
export const num = (v, d = 1) => (v === null || v === undefined || Number.isNaN(+v) ? '-' : (+v).toFixed(d));
export const pct = (v, d = 0) => (v === null || v === undefined ? '-' : `${(+v * 100).toFixed(d)}%`);
export const useAsync = (fn, deps = []) => {
  const [s, set] = React.useState({ data: null, error: '', loading: true });
  const load = React.useCallback(() => { set(x => ({ ...x, loading: true })); fn().then(data => set({ data, error: '', loading: false })).catch(e => set({ data: null, error: e.message, loading: false })); }, deps); // eslint-disable-line
  React.useEffect(load, [load]);
  return { ...s, reload: load };
};
