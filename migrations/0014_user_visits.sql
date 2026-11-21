-- Who used the app on which day, for the admin Users page (worker/users.ts).
-- One row per account per day (India time, src/lib/day.ts). A sign-in counts,
-- and so does opening the app while already signed in (GET /api/auth/me), since
-- a session lasts 30 days and most visits never sign in again.

CREATE TABLE user_visits (
  user_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- YYYY-MM-DD in India time.
  day      TEXT NOT NULL,
  first_at INTEGER NOT NULL,
  last_at  INTEGER NOT NULL,
  -- Times the app was opened (or signed in to) that day.
  visits   INTEGER NOT NULL DEFAULT 1,
  sign_ins INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX user_visits_day ON user_visits (day);

-- History from before this table, as well as it can be known: the day each
-- account was made, the day it last signed in, and each day it finished a round.
INSERT OR IGNORE INTO user_visits (user_id, day, first_at, last_at, visits, sign_ins)
SELECT id, date(created_at / 1000, 'unixepoch', '+330 minutes'), created_at, created_at, 1, 1 FROM users;

INSERT INTO user_visits (user_id, day, first_at, last_at, visits, sign_ins)
SELECT id, date(last_login_at / 1000, 'unixepoch', '+330 minutes'), last_login_at, last_login_at, 1, 1 FROM users WHERE true
ON CONFLICT (user_id, day) DO UPDATE SET last_at = max(last_at, excluded.last_at), first_at = min(first_at, excluded.first_at);

INSERT INTO user_visits (user_id, day, first_at, last_at, visits, sign_ins)
SELECT user_id, date(played_at / 1000, 'unixepoch', '+330 minutes'), min(played_at), max(played_at), 1, 0
FROM rounds WHERE source = 'live' GROUP BY user_id, date(played_at / 1000, 'unixepoch', '+330 minutes')
ON CONFLICT (user_id, day) DO UPDATE SET last_at = max(last_at, excluded.last_at), first_at = min(first_at, excluded.first_at);
