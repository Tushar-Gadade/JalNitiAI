require('dotenv').config();
const app = require('./app');
const { waitForDb, migrate } = require('./db');
const reservoir = require('./services/reservoir.service');
const ai = require('./services/ai.service');
const PORT = process.env.PORT || 4000;
(async () => {
  await waitForDb(); await migrate();
  for (let i = 0; i < 40; i++) {       // AI service trains its model on first start, so allow time
    try { await ai.get('/health'); await reservoir.seed(); break; }
    catch (e) { console.log(`[ai] waiting for intelligence service (${i + 1}/40)`); await new Promise(r => setTimeout(r, 3000)); }
  }
  app.listen(PORT, () => console.log(`JalNiti API listening on :${PORT}`));
})().catch(e => { console.error(e); process.exit(1); });
