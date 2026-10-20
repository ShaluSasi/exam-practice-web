-- Accounts and saved practice rounds.
--
-- Apply locally:      npm run db:migrate:local
-- Apply to Cloudflare: npm run db:migrate:remote

-- One row per Google account. `id` is Google's permanent user ID ("sub");
-- email is kept up to date on every sign-in and is what teachers search by.
CREATE TABLE users (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL COLLATE NOCASE,
  name             TEXT NOT NULL,
  picture          TEXT,
  -- Teacher/admin view (planned): grant with
  --   UPDATE users SET role = 'admin' WHERE email = 'someone@gmail.com';
  role             TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  created_at       INTEGER NOT NULL,
  last_login_at    INTEGER NOT NULL,
  -- Device scores are copied in once, on the account's first sign-in.
  -- The device only keeps its last 30 rounds, so totals from older rounds
  -- are carried here and added to the sums over `rounds`.
  imported_at      INTEGER,
  base_xp          INTEGER NOT NULL DEFAULT 0,
  base_rounds      INTEGER NOT NULL DEFAULT 0,
  base_best_streak INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX users_email ON users (email);
CREATE INDEX users_role ON users (role);

-- One row per finished practice round.
CREATE TABLE rounds (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Email at the time the round was played, so scores are filed by email.
  email       TEXT NOT NULL COLLATE NOCASE,
  -- ID made by the browser; makes retries after a network error safe.
  client_id   TEXT NOT NULL,
  title       TEXT NOT NULL,
  correct     INTEGER NOT NULL,
  total       INTEGER NOT NULL,
  marks       REAL NOT NULL,
  max_marks   REAL NOT NULL,
  accuracy    INTEGER NOT NULL,
  xp          INTEGER NOT NULL,
  best_streak INTEGER,
  time_ms     INTEGER NOT NULL,
  played_at   INTEGER NOT NULL,
  source      TEXT NOT NULL DEFAULT 'live' CHECK (source IN ('live', 'imported')),
  created_at  INTEGER NOT NULL,
  UNIQUE (user_id, client_id)
);
CREATE INDEX rounds_user_played ON rounds (user_id, played_at DESC);
CREATE INDEX rounds_user_title ON rounds (user_id, title);
CREATE INDEX rounds_email ON rounds (email);
