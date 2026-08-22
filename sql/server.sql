-- The Ol' Barbershop — server-side tables (Cloudflare D1)
--
-- Deliberately separate from schema.sql. That file mirrors the in-browser table
-- registry one for one and describes Katherine's own records, which stay encrypted
-- on her device and never reach a server. Nothing in this file is hers.
--
-- What lives here is only what cannot work on one device: customer identities from
-- a sign-in provider, the requests those customers send, and the state of the
-- shop's own subscription. Her book remains the system of record; booking_requests
-- is an inbox she empties into it.

PRAGMA foreign_keys = ON;

-- One row per person per provider. id is 'provider:subject', which is stable for
-- the life of the account and is the only handle used elsewhere.
-- No password column: there is no password to store, which is most of the point.
CREATE TABLE IF NOT EXISTS customer_identities (
  id             TEXT PRIMARY KEY,
  provider       TEXT    NOT NULL CHECK (provider IN ('google','apple')),
  subject        TEXT    NOT NULL,
  email          TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  display_name   TEXT,
  created_at     TEXT    NOT NULL,
  last_seen_at   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_provider_subject
  ON customer_identities(provider, subject);
CREATE INDEX IF NOT EXISTS idx_identity_email ON customer_identities(email);

-- A request, never a booking. Katherine confirms each one herself.
-- status: 'pending' until she pulls it into her vault, then 'pulled'.
-- note is capped and stripped at the route. Washington's My Health My Data Act
-- reaches free text like "sensitive scalp", so the form asks people to leave
-- health details out and nothing here invites them back in.
CREATE TABLE IF NOT EXISTS booking_requests (
  id             TEXT PRIMARY KEY,
  customer_id    TEXT    NOT NULL REFERENCES customer_identities(id) ON DELETE CASCADE,
  name           TEXT,
  phone          TEXT,
  email          TEXT,
  service_id     TEXT,
  service_name   TEXT    NOT NULL,
  requested_date TEXT    NOT NULL,
  requested_time TEXT    NOT NULL,
  note           TEXT,
  status         TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','pulled')),
  created_at     TEXT    NOT NULL,
  pulled_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON booking_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_requests_customer ON booking_requests(customer_id);

-- Exactly one row, id 'shop'. The shop's subscription for the website itself,
-- not anything to do with haircuts: GlossGenius takes those payments.
-- Nothing reads this to decide whether to serve the site. It drives a badge.
CREATE TABLE IF NOT EXISTS billing_state (
  id                     TEXT PRIMARY KEY CHECK (id = 'shop'),
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  status                 TEXT,
  current_period_end     TEXT,
  last_event             TEXT,
  updated_at             TEXT
);
