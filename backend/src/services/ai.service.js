const base = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';
async function call(method, path, body) {
  const r = await fetch(base() + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) { const e = new Error(`AI service ${r.status}: ${text.slice(0, 300)}`); e.status = r.status === 422 ? 400 : 502; throw e; }
  return JSON.parse(text);
}
module.exports = { get: p => call('GET', p), post: (p, b) => call('POST', p, b || {}) };
