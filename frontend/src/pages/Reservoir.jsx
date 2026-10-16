import React from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api.js';
import { Card, Kpi, Loading, Msg, Page, num, useAsync } from '../components/ui.jsx';

export default function Reservoir() {
  const { data, error, loading } = useAsync(() => api.get('/reservoirs/1/status'));
  if (loading) return <Loading what="reservoir" />;
  const r = data?.reservoir;
  return (<Page title="Reservoir" sub="Live storage and inflow readings for the source reservoir. Data is automatically refreshed from the latest available source.">
    <Msg kind="err">{error}</Msg>
    {r && <div className="grid g4" style={{ marginBottom: 18 }}>
      <Kpi value={r.name} label={`${r.state} | basin: Kosasthalaiyar / Araniar / Adyar`} />
      <Kpi value={`${num(r.capacity_mcm, 0)} MCM`} label="Gross live capacity (about 11.06 TMC)" />
      <Kpi value={`${num(data.fill_pct)}%`} label="Current fill" />
      <Kpi value={`${(r.city_share * 100).toFixed(2)}%`} label="City planning share of live storage" />
    </div>}
    <Card title="Storage and inflow history">
      <div style={{ height: 300 }}><ResponsiveContainer><ComposedChart data={data?.history || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={30} />
        <YAxis yAxisId="l" tick={{ fontSize: 11 }} /><YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} /><Tooltip /><Legend />
        <Line yAxisId="l" dataKey="storage_mcm" name="Storage (MCM)" stroke="#12306b" dot={false} strokeWidth={2} /><Bar yAxisId="r" dataKey="inflow_mcm" name="Inflow (MCM/day)" fill="#ff9933" /></ComposedChart></ResponsiveContainer></div>
      <Msg kind="info">Reservoir data is automatically updated from the latest available source. Data refreshes when new readings are available from India-WRIS / CWC.</Msg>
    </Card>
  </Page>);
}
