-- Unfinished rounds (so a chapter resumes where the student left off) and a
-- permanent log of every answer (for the planned teacher/admin view).

-- One unfinished round per student per chapter (or "mixed"). Saved after
-- every answer; deleted when the round is finished or started over.
CREATE TABLE active_rounds (
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  email      TEXT NOT NULL COLLATE NOCASE,
  round_id   TEXT NOT NULL,
  title      TEXT NOT NULL,
  -- JSON: question IDs in order, answers so far, XP, streaks, time spent.
  state      TEXT NOT NULL,
  answered   INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  xp         INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);

-- Every answer attempt, kept after the round ends. `round_id` matches
-- rounds.client_id once the round is finished.
CREATE TABLE answers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  email       TEXT NOT NULL COLLATE NOCASE,
  round_id    TEXT NOT NULL,
  round_title TEXT NOT NULL,
  question_id TEXT NOT NULL,
  correct     INTEGER NOT NULL,
  skipped     INTEGER NOT NULL,
  used_hint   INTEGER NOT NULL,
  xp          INTEGER NOT NULL,
  time_ms     INTEGER NOT NULL,
  -- What the student picked (JSON), for reviewing mistakes.
  response    TEXT,
  answered_at INTEGER NOT NULL,
  UNIQUE (user_id, round_id, question_id)
);
CREATE INDEX answers_user_question ON answers (user_id, question_id);
CREATE INDEX answers_email ON answers (email);
CREATE INDEX answers_question ON answers (question_id);
