-- GOVARD Gateway — D1-Schema v1
-- Regel: Jede operative Tabelle trägt org_id. Ohne Ausnahme.
-- D1 hat kein RLS — Mandantentrennung wird in src/db/repository.ts erzwungen.

CREATE TABLE orgs (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ---------------------------------------------------------------
-- AUTH: API-Keys, nur als SHA-256-Hash gespeichert.
-- role: agent | approver | admin — ein Agent-Key kann nie selbst freigeben.
-- ---------------------------------------------------------------
CREATE TABLE api_keys (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  actor_id   TEXT NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'agent',
  key_hash   TEXT NOT NULL UNIQUE,
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_api_keys_org ON api_keys (org_id);

-- ---------------------------------------------------------------
-- POLICIES: mutierbarer Kopf + unveränderliche Versionen.
-- Evidence referenziert NIE policies.id allein — immer eine Version.
-- ---------------------------------------------------------------
CREATE TABLE policies (
  id                 TEXT PRIMARY KEY,
  org_id             TEXT NOT NULL,
  name               TEXT NOT NULL,
  current_version_id TEXT,
  enabled            INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL
);
CREATE INDEX idx_policies_org ON policies (org_id, enabled);

CREATE TABLE policy_versions (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  policy_id  TEXT NOT NULL,
  version    INTEGER NOT NULL,
  name       TEXT NOT NULL,
  rule       TEXT NOT NULL,   -- JSON, vor dem Hashing kanonisiert
  action     TEXT NOT NULL,   -- DENY | REQUIRE_APPROVAL | WARN
  rule_hash  TEXT NOT NULL,   -- sha256 der kanonischen Regel
  created_at TEXT NOT NULL,
  created_by TEXT,
  UNIQUE (org_id, policy_id, version)
);
-- policy_versions-Zeilen sind append-only. Nie UPDATE, nie DELETE.

-- ---------------------------------------------------------------
-- COMMANDS
-- ---------------------------------------------------------------
CREATE TABLE commands (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL,
  actor_id        TEXT NOT NULL,
  source          TEXT NOT NULL,   -- n8n | openai | claude | zapier | ui | api
  intent          TEXT NOT NULL,
  payload         TEXT NOT NULL,
  payload_hash    TEXT NOT NULL,
  state           TEXT NOT NULL,
  evaluation_hash TEXT,            -- bindet den Command an genau eine Evaluation
  failure_reason  TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  completed_at    TEXT
);
CREATE INDEX idx_commands_org_state ON commands (org_id, state, created_at DESC);

CREATE TABLE command_transitions (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL,
  command_id   TEXT NOT NULL,
  from_state   TEXT NOT NULL,
  to_state     TEXT NOT NULL,
  actor_id     TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_transitions_cmd ON command_transitions (org_id, command_id, created_at);

-- ---------------------------------------------------------------
-- APPROVALS
-- evaluation_hash bindet die Freigabe an den exakt evaluierten Payload.
-- Payload ändert sich -> Hash ändert sich -> Freigabe gilt nicht mehr.
-- ---------------------------------------------------------------
CREATE TABLE approvals (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL,
  command_id      TEXT NOT NULL,
  evaluation_hash TEXT NOT NULL,
  status          TEXT NOT NULL,   -- PENDING | APPROVED | DENIED | EXPIRED
  requested_by    TEXT NOT NULL,
  decided_by      TEXT,
  decided_at      TEXT,
  reason          TEXT,
  expires_at      TEXT,
  created_at      TEXT NOT NULL
);
-- Höchstens eine offene Freigabe pro Command.
CREATE UNIQUE INDEX idx_approvals_open
  ON approvals (org_id, command_id) WHERE status = 'PENDING';
CREATE INDEX idx_approvals_inbox
  ON approvals (org_id, status, created_at DESC);

-- ---------------------------------------------------------------
-- EVIDENCE — Projektion der Durable-Object-Chain.
-- Das DO ist Quelle der Wahrheit; diese Tabelle ist der abfragbare Spiegel.
-- ---------------------------------------------------------------
CREATE TABLE evidence_events (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  sequence      INTEGER NOT NULL,
  command_id    TEXT,
  actor_id      TEXT,
  event_type    TEXT NOT NULL,
  payload       TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  event_hash    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  UNIQUE (org_id, sequence)
);
CREATE INDEX idx_evidence_cmd ON evidence_events (org_id, command_id, sequence);

-- Periodisches Siegel des Chain-Heads (täglich -> R2, optional verankert).
CREATE TABLE evidence_seals (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL,
  sequence     INTEGER NOT NULL,
  head_hash    TEXT NOT NULL,
  r2_key       TEXT,
  anchor_ref   TEXT,             -- spätere externe Verankerung (CreatorSeal)
  created_at   TEXT NOT NULL,
  UNIQUE (org_id, sequence)
);

-- ---------------------------------------------------------------
-- IDEMPOTENZ — Key wird VOR der Verarbeitung reserviert; zwei gleich-
-- zeitige Requests mit demselben Key erzeugen höchstens EINEN Command.
-- ---------------------------------------------------------------
CREATE TABLE idempotency_keys (
  org_id       TEXT NOT NULL,
  key          TEXT NOT NULL,
  request_hash TEXT NOT NULL,   -- gleicher Key mit anderem Body wird abgelehnt
  command_id   TEXT NOT NULL,
  response     TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (org_id, key)
);
