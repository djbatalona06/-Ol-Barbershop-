-- The Ol' Barbershop — canonical schema
-- Mirrors the in-browser table registry in index.html one-for-one.
-- Written portable: valid SQLite, and valid Postgres after the noted swaps.
--
-- Postgres migration: TEXT PRIMARY KEY -> UUID PRIMARY KEY DEFAULT gen_random_uuid(),
-- INTEGER 0/1 booleans -> BOOLEAN, and TEXT timestamps -> TIMESTAMPTZ.
-- No other change is required. The column names and relationships are identical.

PRAGMA foreign_keys = ON;

-- Staff / barber roster. Seeded with Katherine only; she adds others from admin.
CREATE TABLE staff (
  id            TEXT PRIMARY KEY,
  display_name  TEXT    NOT NULL,
  title         TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  accent_color  TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1
);

-- Service menu. Prices in cents to avoid float money.
-- needs_review flags rows seeded from public listings rather than confirmed by Katherine.
CREATE TABLE services (
  id            TEXT PRIMARY KEY,
  name          TEXT    NOT NULL,
  category      TEXT    NOT NULL DEFAULT 'Cuts',
  description   TEXT,
  price_cents   INTEGER NOT NULL DEFAULT 0,
  duration_min  INTEGER NOT NULL DEFAULT 30,
  buffer_min    INTEGER NOT NULL DEFAULT 0,
  is_addon      INTEGER NOT NULL DEFAULT 0,
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  needs_review  INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1
);

-- Client records. Column names follow GlossGenius export headers so CSV round-trips.
CREATE TABLE clients (
  id                  TEXT PRIMARY KEY,
  first_name          TEXT NOT NULL,
  last_name           TEXT,
  phone               TEXT,
  email               TEXT,
  birthday            TEXT,
  client_since        TEXT,
  source              TEXT NOT NULL DEFAULT 'web',
  tags                TEXT,
  notes               TEXT,
  sms_opt_in          INTEGER NOT NULL DEFAULT 0,
  email_opt_in        INTEGER NOT NULL DEFAULT 0,
  total_visits        INTEGER NOT NULL DEFAULT 0,
  lifetime_value_cents INTEGER NOT NULL DEFAULT 0,
  last_visit_at       TEXT,
  created_at          TEXT NOT NULL
);
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_last_visit ON clients(last_visit_at);

-- Recurring weekly hours. weekday: 0=Sunday .. 6=Saturday. Times are local "HH:MM".
CREATE TABLE schedule_rules (
  id         TEXT PRIMARY KEY,
  staff_id   TEXT    NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  weekday    INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT    NOT NULL,
  end_time   TEXT    NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_rules_staff_day ON schedule_rules(staff_id, weekday);

-- One-off overrides: holidays, vacation, early close. Beats editing weekly hours.
-- kind 'closed' ignores the time columns; kind 'custom' replaces that day's hours.
CREATE TABLE schedule_exceptions (
  id         TEXT PRIMARY KEY,
  staff_id   TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('closed','custom')),
  start_time TEXT,
  end_time   TEXT,
  reason     TEXT
);
CREATE INDEX idx_exceptions_staff_date ON schedule_exceptions(staff_id, date);

-- The book. status drives both the calendar and the CRM pipeline auto-advance.
CREATE TABLE appointments (
  id                 TEXT PRIMARY KEY,
  client_id          TEXT REFERENCES clients(id) ON DELETE SET NULL,
  staff_id           TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id         TEXT NOT NULL REFERENCES services(id),
  starts_at          TEXT NOT NULL,
  ends_at            TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'requested'
                     CHECK (status IN ('requested','booked','confirmed','completed','no_show','cancelled')),
  price_cents        INTEGER NOT NULL DEFAULT 0,
  deposit_paid_cents INTEGER NOT NULL DEFAULT 0,
  source             TEXT NOT NULL DEFAULT 'web'
                     CHECK (source IN ('web','walkin','phone','glossgenius')),
  notes              TEXT,
  created_at         TEXT NOT NULL
);
CREATE INDEX idx_appt_staff_start ON appointments(staff_id, starts_at);
CREATE INDEX idx_appt_client ON appointments(client_id);
CREATE INDEX idx_appt_status ON appointments(status);

CREATE TABLE pipeline_stages (
  id         TEXT PRIMARY KEY,
  name       TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color      TEXT,
  is_lane    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE pipeline_cards (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  stage_id        TEXT NOT NULL REFERENCES pipeline_stages(id),
  value_cents     INTEGER NOT NULL DEFAULT 0,
  next_action     TEXT,
  next_action_at  TEXT,
  owner_staff_id  TEXT REFERENCES staff(id) ON DELETE SET NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX idx_cards_stage ON pipeline_cards(stage_id);

-- CCPA / CEMA / TCPA evidence trail. Records the exact policy version consented to,
-- because "we have consent" is worth nothing without the wording and the timestamp.
CREATE TABLE consent_log (
  id        TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL CHECK (kind IN ('tos','privacy','sms','email','sale_optout')),
  version   TEXT NOT NULL,
  granted   INTEGER NOT NULL,
  ts        TEXT NOT NULL
);
CREATE INDEX idx_consent_client ON consent_log(client_id, kind);

-- CCPA data subject access requests. due_at is requested_at + 45 days.
CREATE TABLE dsar_requests (
  id           TEXT PRIMARY KEY,
  requester    TEXT NOT NULL,
  contact      TEXT,
  kind         TEXT NOT NULL CHECK (kind IN ('access','delete','correct','optout','limit_sensitive')),
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','verifying','completed','denied')),
  detail       TEXT,
  requested_at TEXT NOT NULL,
  due_at       TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX idx_dsar_status ON dsar_requests(status, due_at);

CREATE TABLE audit_log (
  id        TEXT PRIMARY KEY,
  actor     TEXT NOT NULL,
  action    TEXT NOT NULL,
  entity    TEXT,
  entity_id TEXT,
  detail    TEXT,
  ts        TEXT NOT NULL
);
CREATE INDEX idx_audit_ts ON audit_log(ts);
