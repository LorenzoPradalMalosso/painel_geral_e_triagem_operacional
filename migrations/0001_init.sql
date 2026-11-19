CREATE TABLE IF NOT EXISTS setup_state (id INTEGER PRIMARY KEY CHECK(id = 1), complete INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO setup_state (id, complete) VALUES (1, 0);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('solicitante','executor','gestor','admin')),
  sector TEXT NOT NULL,
  salt TEXT NOT NULL,
  password TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, version INTEGER NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, data TEXT NOT NULL);
INSERT OR IGNORE INTO categories (id, data) VALUES
 ('eletrica','{"id":"eletrica","name":"Manutenção elétrica","sector":"Manutenção","priority":"Normal"}'),
 ('predial','{"id":"predial","name":"Manutenção predial","sector":"Manutenção","priority":"Normal"}'),
 ('limpeza','{"id":"limpeza","name":"Limpeza e conservação","sector":"Zeladoria","priority":"Normal"}'),
 ('acesso','{"id":"acesso","name":"Acesso e segurança","sector":"Vigilância","priority":"Alta"}'),
 ('administrativa','{"id":"administrativa","name":"Solicitação administrativa","sector":"Administração","priority":"Normal"}'),
 ('risco','{"id":"risco","name":"Risco de acidente","sector":"Manutenção","priority":"Máxima"}'),
 ('outro','{"id":"outro","name":"Outros serviços","sector":"Administração","priority":"Normal"}');
