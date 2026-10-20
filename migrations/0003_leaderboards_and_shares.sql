-- Leaderboards and shareable achievements.
--
-- Leaderboards rank students by XP within a *scope* and a *period*
-- (worker/leaderboard.ts). Only the "global" scope is enabled today; the
-- columns and tables below are what the planned scopes filter on:
--   grade   -> users.grade                  ("Class 10 leaderboard")
--   group   -> groups + group_members       (school, class division/section, any custom group)
--   quiz    -> rounds.quiz_key              (chapter-wise leaderboard)

-- Which quiz a finished round belongs to: a chapter key such as
-- "physics|9|Motion", or "mixed". NULL for one-off sets.
ALTER TABLE rounds ADD COLUMN quiz_key TEXT;
CREATE INDEX rounds_played ON rounds (played_at);
CREATE INDEX rounds_quiz_played ON rounds (quiz_key, played_at);

-- The student's class (9-12), once they tell us (planned).
ALTER TABLE users ADD COLUMN grade INTEGER;

-- Schools, class divisions (e.g. "10-B") and any other grouping, as a tree:
-- a section's parent is its school.
CREATE TABLE groups (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('school', 'section', 'custom')),
  name       TEXT NOT NULL,
  parent_id  TEXT REFERENCES groups (id) ON DELETE CASCADE,
  grade      INTEGER,
  -- Students join with this code (planned).
  join_code  TEXT UNIQUE,
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX groups_parent ON groups (parent_id);

CREATE TABLE group_members (
  group_id  TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_members_user ON group_members (user_id);

-- A shared achievement: a finished round ("I scored 95%, beat me on the
-- same questions") or a leaderboard rank. `data` is a snapshot taken when
-- shared, so the link keeps showing what was bragged about.
CREATE TABLE shares (
  code       TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('round', 'rank')),
  round_id   TEXT,
  data       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  -- How many times the link was opened, and how many friends took the challenge.
  visits     INTEGER NOT NULL DEFAULT 0,
  plays      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX shares_user ON shares (user_id, created_at DESC);
CREATE UNIQUE INDEX shares_user_round ON shares (user_id, round_id) WHERE round_id IS NOT NULL;
