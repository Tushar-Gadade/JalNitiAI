-- JalNiti AI schema (PostgreSQL 14+)
CREATE TABLE IF NOT EXISTS reservoir (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, state TEXT, capacity_mcm NUMERIC NOT NULL,
  dead_storage_mcm NUMERIC DEFAULT 0, city_share NUMERIC NOT NULL, reserve_policy JSONB DEFAULT '{}');
CREATE TABLE IF NOT EXISTS reservoir_reading (
  id SERIAL PRIMARY KEY, reservoir_id INT REFERENCES reservoir(id), ts DATE NOT NULL, storage_mcm NUMERIC NOT NULL,
  inflow_mcm NUMERIC DEFAULT 0, source TEXT DEFAULT 'manual', quality_flag TEXT DEFAULT 'OK',
  UNIQUE (reservoir_id, ts));
CREATE TABLE IF NOT EXISTS demand_zone (
  id INT PRIMARY KEY, code TEXT UNIQUE, name TEXT NOT NULL, type TEXT NOT NULL, population INT DEFAULT 0,
  base_mld NUMERIC, min_mld NUMERIC, vulnerability_score NUMERIC, criticality_score NUMERIC, priority NUMERIC,
  max_cut_days INT, capacity_mld NUMERIC, loss NUMERIC);
CREATE TABLE IF NOT EXISTS critical_facility (
  id SERIAL PRIMARY KEY, zone_id INT REFERENCES demand_zone(id), facility_type TEXT, minimum_need_mld NUMERIC, operating_hours TEXT);
CREATE TABLE IF NOT EXISTS demand_reading (
  id SERIAL PRIMARY KEY, zone_id INT REFERENCES demand_zone(id), ts DATE NOT NULL, requested_mld NUMERIC,
  actual_consumed_mld NUMERIC, actual_delivered_mld NUMERIC, source TEXT DEFAULT 'import', UNIQUE (zone_id, ts));
CREATE TABLE IF NOT EXISTS forecast_run (
  id SERIAL PRIMARY KEY, model_version TEXT, horizon INT, created_at TIMESTAMPTZ DEFAULT now(), metrics JSONB, uncertainty_method TEXT);
CREATE TABLE IF NOT EXISTS demand_forecast (
  id SERIAL PRIMARY KEY, forecast_run_id INT REFERENCES forecast_run(id) ON DELETE CASCADE, zone_id INT, ts DATE,
  lower NUMERIC, predicted NUMERIC, upper NUMERIC);
CREATE TABLE IF NOT EXISTS policy_rule (
  id SERIAL PRIMARY KEY, version INT NOT NULL, params JSONB NOT NULL, active BOOLEAN DEFAULT TRUE,
  effective_from TIMESTAMPTZ DEFAULT now(), changed_by TEXT);
CREATE TABLE IF NOT EXISTS optimization_run (
  id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT now(), created_by TEXT, horizon INT, params JSONB, policy_version INT,
  model_version TEXT, solver_status TEXT, objective_values JSONB, runtime_s NUMERIC, kpis JSONB, twin JSONB,
  counterfactuals JSONB, storage_paths JSONB, status TEXT DEFAULT 'pending');
CREATE TABLE IF NOT EXISTS allocation_decision (
  id SERIAL PRIMARY KEY, run_id INT REFERENCES optimization_run(id) ON DELETE CASCADE, zone_id INT, day INT, ts DATE,
  demand_mld NUMERIC, allocated_mld NUMERIC, approved_mld NUMERIC, shortage_mld NUMERIC, satisfaction NUMERIC,
  ration_stage INT, ration_level TEXT, reason_code TEXT, explanation TEXT);
CREATE INDEX IF NOT EXISTS idx_alloc_run ON allocation_decision(run_id);
CREATE TABLE IF NOT EXISTS fairness_state (
  zone_id INT PRIMARY KEY REFERENCES demand_zone(id), debt_score NUMERIC DEFAULT 0, consecutive_ration_days INT DEFAULT 0,
  last_ratio NUMERIC, updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS approval (
  id SERIAL PRIMARY KEY, run_id INT REFERENCES optimization_run(id), operator TEXT, decision TEXT, comment TEXT,
  overrides JSONB, ts TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY, actor TEXT, action TEXT, entity TEXT, entity_id TEXT, old_value JSONB, new_value JSONB, ts TIMESTAMPTZ DEFAULT now());
