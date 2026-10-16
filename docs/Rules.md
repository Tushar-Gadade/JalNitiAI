# JalNiti AI — Rules & Guardrails

## 1. What TO Use

### Frontend
- **React 18** with functional components and hooks only (no class components)
- **Vite** for dev server and build
- **React Router v6** for client-side routing (`<Link>`, `useNavigate`, `<Routes>`)
- **Recharts** for all data visualizations (already installed)
- **Vanilla CSS** via `styles.css` — no Tailwind, no MUI, no styled-components
- Shared UI primitives from `components/ui.jsx`: `Card`, `Kpi`, `Loading`, `Msg`, `Page`, `useAsync`, `num`, `pct`
- `api.js` for all HTTP calls — never use raw `fetch` directly in pages

### Backend (Node.js)
- **Express** for routing
- **pg** (node-postgres) for database access — use the `query()` helper from `db.js`
- **jsonwebtoken** for JWT auth
- **helmet** for HTTP security headers
- Wrap all async route handlers with the `h()` helper to centralize error handling

### Intelligence Service (Python)
- **FastAPI** + **Pydantic** for API and validation
- **pandas** + **numpy** for data manipulation
- **scikit-learn** for ML models (GBR, quantile regression)
- **PuLP** for linear programming / optimization
- Type-annotate all function signatures
- Use `data.load()` to read processed data — never read raw CSVs directly in model files

---

## 2. What NOT To Use / Do

### Never
- ❌ Do NOT automatically enforce water cuts — every plan requires human approval
- ❌ Do NOT expose raw database errors to the frontend (use `h()` wrapper in routes)
- ❌ Do NOT use `any` type annotations in Python (use proper Pydantic models)
- ❌ Do NOT add new npm packages without checking if an existing one covers the need
- ❌ Do NOT call the intelligence service directly from the frontend (always go through backend)
- ❌ Do NOT hardcode credentials, API keys, or secrets in source code (use `.env`)
- ❌ Do NOT allow unauthenticated access to any route except `/api/auth/login` and `/api/health`
- ❌ Do NOT present synthetic/simulated data as real-world accuracy

### Frontend
- ❌ No inline styles for layout (use CSS classes)
- ❌ No `useState` for data fetching — use the `useAsync` hook from `ui.jsx`
- ❌ No `class` attribute — use `className`
- ❌ Do not mutate state directly

### Backend
- ❌ No raw SQL string interpolation (use parameterized queries with `$1, $2...`)
- ❌ No synchronous file I/O in route handlers
- ❌ No skipping role checks for destructive operations (use `requireRole('operator')`)

### Python
- ❌ No global mutable state (use function parameters / dependency injection)
- ❌ No `print()` for logging in production (use `logging` module)
- ❌ Do not re-train models on every request (train once on startup, cache)

---

## 3. Error Handling Boundaries

```
Frontend          Backend            Intelligence Service
   │                 │                      │
   │  fetch error    │   pg error           │  model error
   │ → show Msg      │ → h() catches        │ → raise HTTPException
   │   kind="err"    │ → res.status(5xx)    │ → FastAPI returns 4xx/5xx
   │                 │ → never stack trace  │
```

- Frontend: always wrap API calls in try/catch, show `<Msg kind="err">` for failures
- Backend: only log at `console.error` for 500-level errors; 400/404/409 are expected
- Python: `HTTPException(status_code, detail)` for all user-facing errors

---

## 4. Data Honesty Rules

- All synthetic/simulated data must be clearly labelled as `source: 'synthetic'` or `quality_flag: 'SIMULATED'`
- Charts sourced from synthetic data must show the source label (see Dashboard reservoir chart)
- ML metrics reported from backtest must state holdout period and data source
- The system must never claim to make real-world allocation decisions on synthetic data

---

## 5. Security Boundaries

- JWT tokens expire in 8 hours
- Roles: `admin` > `operator` > `viewer` (read-only)
- Only `operator` and `admin` can generate or approve plans
- Only `admin` can modify policy parameters
- All destructive operations are written to the audit log

---

## 6. AI / Optimization Constraints

- The LP must always satisfy protected minimums for hospitals (`min_frac = 0.95`)
- Reserve water must never drop below `reserve_days × expected_city_demand_mcm`
- Fairness debt must be updated after every approved plan
- No zone may be rationed for more than `max_cut_days` consecutive days without a flag
- Scarcity stages 0–5 must map deterministically to the thresholds defined in `config.py`

---

## 7. Libraries Summary

| Purpose | Package | Where |
|---------|---------|-------|
| Charts | recharts | Frontend |
| Routing | react-router-dom | Frontend |
| HTTP client | native fetch (via api.js) | Frontend |
| Auth | jsonwebtoken | Backend |
| DB | pg | Backend |
| LP solver | PuLP | Intelligence |
| ML | scikit-learn | Intelligence |
| Data | pandas, numpy | Intelligence |
| API server | FastAPI + uvicorn | Intelligence |
