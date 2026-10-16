const { query } = require('../db');
// CSV: date,zone_id,requested_mld[,delivered_mld]
async function importCsv(text) {
  const lines = text.trim().split(/\r?\n/); const head = lines.shift().split(',').map(s => s.trim().toLowerCase());
  const idx = n => head.indexOf(n);
  if (idx('date') < 0 || idx('zone_id') < 0 || (idx('requested_mld') < 0 && idx('demand_mld') < 0))
    { const e = new Error('CSV needs columns: date, zone_id, requested_mld (optional: delivered_mld)'); e.status = 400; throw e; }
  const zones = new Set((await query('SELECT id FROM demand_zone')).rows.map(r => r.id));
  let ok = 0; const rejected = [];
  for (const [n, l] of lines.entries()) {
    const c = l.split(','); const date = c[idx('date')]; const zid = +c[idx('zone_id')];
    const req = +c[idx(idx('requested_mld') >= 0 ? 'requested_mld' : 'demand_mld')];
    const del = idx('delivered_mld') >= 0 ? +c[idx('delivered_mld')] : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !zones.has(zid) || !(req >= 0 && req < 1000)) { rejected.push({ row: n + 2, reason: 'invalid date, zone or range' }); continue; }
    await query(`INSERT INTO demand_reading(zone_id,ts,requested_mld,actual_delivered_mld) VALUES ($1,$2,$3,$4)
      ON CONFLICT (zone_id,ts) DO UPDATE SET requested_mld=$3, actual_delivered_mld=$4`, [zid, date, req, del]); ok++;
  }
  return { imported: ok, rejected: rejected.slice(0, 20), rejected_count: rejected.length };
}
module.exports = { importCsv };
