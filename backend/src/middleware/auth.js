const jwt = require('jsonwebtoken');
const secret = () => process.env.JWT_SECRET || 'dev-secret';
const users = () => ({
  [process.env.OPERATOR_USER || 'operator']: { pass: process.env.OPERATOR_PASS || 'Jalniti@2026', role: 'operator' },
  [process.env.ADMIN_USER || 'admin']: { pass: process.env.ADMIN_PASS || 'Admin@2026', role: 'admin' },
});
function login(req, res) {
  const { username, password } = req.body || {};
  const u = users()[username];
  if (!u || u.pass !== password) return res.status(401).json({ error: 'Invalid username or password' });
  const token = jwt.sign({ sub: username, role: u.role }, secret(), { expiresIn: '8h' });
  res.json({ token, user: { username, role: u.role } });
}
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  try { req.user = jwt.verify(h.replace('Bearer ', ''), secret()); next(); }
  catch { res.status(401).json({ error: 'Sign in required' }); }
}
const requireRole = role => (req, res, next) =>
  req.user && (req.user.role === role || req.user.role === 'admin') ? next() : res.status(403).json({ error: 'Not permitted for your role' });
module.exports = { login, requireAuth, requireRole };
