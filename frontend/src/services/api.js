const BASE = import.meta.env.VITE_API_URL || '/api';
export const getToken = () => localStorage.getItem('jn_token');
export const getUser = () => { try { return JSON.parse(localStorage.getItem('jn_user')); } catch { return null; } };
export function logout() { localStorage.removeItem('jn_token'); localStorage.removeItem('jn_user'); window.location.href = '/login'; }
async function req(method, path, body, raw) {
  const res = await fetch(BASE + path, {
    method, headers: { ...(raw ? { 'Content-Type': 'text/csv' } : body ? { 'Content-Type': 'application/json' } : {}), ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && path !== '/auth/login') logout();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
export const api = {
  get: p => req('GET', p), post: (p, b) => req('POST', p, b || {}), put: (p, b) => req('PUT', p, b), csv: (p, text) => req('POST', p, text, true),
};
export const stageName = n => ['Normal supply', 'Conservation advisory', 'Mild reduction', 'Time-window rationing', 'Severe restriction', 'Emergency (protected minimum)'][n] ?? '-';
export const stageColor = n => `var(--s${n})`;
