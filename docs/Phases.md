# JalNiti AI — Project Phases

## Phase 1 — Core Infrastructure ✅ Complete

**Goal:** Get the system running end-to-end with real-looking data.

- [x] PostgreSQL schema design (zones, readings, plans, audit logs)
- [x] Node.js / Express backend with JWT auth
- [x] Python FastAPI intelligence service
- [x] Synthetic Chennai data generation (reservoir, weather, demand)
- [x] Seeding pipeline (AI service → backend DB on first boot)
- [x] Docker Compose setup for local dev
- [x] Basic login page

---

## Phase 2 — Optimization Engine ✅ Complete

**Goal:** Generate and explain water allocation plans.

- [x] Multi-objective LP formulation (PuLP) — minimize unmet demand + inequity + debt
- [x] Fairness debt tracking (alpha/beta update rule)
- [x] Scarcity stage classification (stages 0–5)
- [x] Digital twin water balance check
- [x] Plan approval workflow (operator can accept/override)
- [x] Audit log for all actions
- [x] AI-generated explanation per zone per day

---

## Phase 3 — Dashboard & UI ✅ Complete

**Goal:** Operators can use the app without reading docs.

- [x] Command Dashboard with KPI cards and allocation map
- [x] Reservoir monitor page
- [x] Demand Zones table
- [x] Optimization run page (generate + approve plan)
- [x] Scenario Lab (5 preset + custom what-if scenarios)
- [x] Fairness Audit page
- [x] Policy Settings page
- [x] Evaluation / stress test page
- [x] Stage legend and color-coded zone cards

---

## Phase 4 — Data Cleanup & UX Polish 🔄 In Progress

**Goal:** Remove clutter, improve usability.

- [x] Remove stale data popup from Dashboard
- [x] Remove manual reservoir upload form
- [x] Remove demand forecast section from Zones page
- [x] Auto-load scenarios on Scenario Lab page open
- [x] Simplify Fairness Audit (remove empty chart, add KPI summary)
- [ ] Connect real India-WRIS / CWC reservoir data feed
- [ ] Auto-refresh reservoir data on a schedule (cron / polling)
- [ ] Better empty state handling across all pages
- [ ] Mobile-responsive layout improvements

---

## Phase 5 — Live Data Integration 🔲 Planned

**Goal:** Connect to real government data sources.

- [ ] India-WRIS API / Google Sheets feed for reservoir levels
- [ ] IMD weather data feed (for inflow prediction)
- [ ] CMWSSB / Metrowater demand data integration
- [ ] Scheduled background job to auto-import latest readings
- [ ] Data quality flag pipeline (validate, interpolate, flag anomalies)
- [ ] Webhook / alert if data is stale for > 24 hours

---

## Phase 6 — Advanced Features 🔲 Planned

**Goal:** Make the system production-ready.

- [ ] Multi-reservoir support (Poondi, Cholavaram, Red Hills, Chembarambakkam individually)
- [ ] Counterfactual explanations ("If zone Z01 had less debt, allocation would be X")
- [ ] Public transparency portal (read-only, no auth)
- [ ] Email / SMS alert to operators when plan is ready
- [ ] Historical plan comparison (before/after monsoon, year-on-year)
- [ ] Export plans as PDF report
- [ ] Role-based user management UI (add/remove operators)

---

## Phase 7 — Scale & Production 🔲 Future

**Goal:** Deploy for real use by CMWSSB.

- [ ] Production deployment (cloud hosting — GCP / AWS)
- [ ] SSL / HTTPS setup
- [ ] Database backup and disaster recovery
- [ ] Load testing and performance optimization
- [ ] Compliance review (data privacy, government data standards)
- [ ] Operator training program
- [ ] Feedback loop: actual delivered vs. planned comparison
