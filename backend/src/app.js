const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const app = express();
app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '2mb' }));
app.use('/api', routes);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  if (err.status !== 400 && err.status !== 404 && err.status !== 409) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal server error' });
});
module.exports = app;
