# JalNiti AI — Product Requirements Document (PRD)

## 1. What We're Building

**JalNiti AI** is an AI-powered urban water allocation and decision support system for Chennai, India. It helps municipal water authorities make fair, data-driven decisions about how to distribute scarce water across the city during droughts and scarcity events.

The system does **not** cut water automatically — every plan must be reviewed and approved by a human operator. AI optimizes and explains; humans decide.

---

## 2. The Problem

Chennai faces recurrent water scarcity, especially during delayed or weak monsoons. The current allocation process is:
- Manual and spreadsheet-based
- Opaque — communities don't know why they receive less water
- Inequitable — the same zones are repeatedly cut without historical memory
- Reactive — operators wait for crisis, rather than planning ahead

---

## 3. Targeted Users

| Role | Who | What they do |
|------|-----|-------------|
| **Operator** | CMWSSB / Metrowater field officer | Reviews AI plans, approves or overrides allocations |
| **Admin** | Senior water authority officer | Manages policy parameters, user access |
| **Viewer** | Public / civic officials | Read-only dashboard view of current supply status |

---

## 4. Core Features

### 4.1 Command Dashboard
- Live KPIs: storage %, city-allocable MCM, days of safe supply, scarcity stage
- Allocation map for day 1 of the latest plan (zone-by-zone)
- 60-day reservoir storage trend chart
- Alert panel for pending plans and twin checks

### 4.2 Reservoir Monitor (`/reservoir`)
- Live fill level, capacity, inflow history
- Storage + inflow chart (combined ComposedChart)
- Auto-fetch from latest data source (India-WRIS / CWC / synthetic fallback)
- No manual upload required

### 4.3 Demand Zones (`/zones`)
- Zone table: code, name, type, population, demand MLD, protected minimum
- Vulnerability and criticality scores
- Fairness debt per zone
- No demand forecast section (removed for simplicity)

### 4.4 Optimization Run (`/optimization`)
- Generate a 7-day water allocation plan using multi-objective linear programming
- View plan KPIs: unmet %, protected violations, scarcity stage, Gini coefficient
- Approve or reject the plan with optional overrides per zone
- Explanation: why each zone got its allocation (AI-generated natural language)

### 4.5 Scenario Lab (`/scenarios`)
- Auto-loads default scenarios on page open
- Adjustable parameters: rainfall multiplier, demand growth, storage factor, pipe outage zone
- Comparison table: 6 scenarios side-by-side
- Bar chart: unmet demand and protected violations per scenario

### 4.6 Fairness Audit (`/fairness`)
- Summary KPIs: total zones, zones with history, highest debt zone
- Zone-level service history table with consecutive ration days
- Sector shortage breakdown (residential, hospital, industry)
- Operator override history

### 4.7 Policy Settings (`/policy`)
- Tune fairness debt parameters (alpha, beta, weights)
- Adjust reserve days and scarcity thresholds

### 4.8 Evaluation
- Stress-test the optimizer across preset crisis scenarios
- Backtest performance on historical data

---

## 5. Non-Goals (MVP)

- No real-time IoT sensor integration (fallback to scheduled data)
- No public-facing citizen portal
- No mobile app
- No automated enforcement of plans

---

## 6. Success Metrics

- Operator can generate, review and approve a plan in < 5 minutes
- Plans explain every zone decision in plain English
- No zone is rationed for more consecutive days than its `max_cut_days` limit
- Fairness debt converges toward zero over time for all zones
