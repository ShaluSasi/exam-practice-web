-- Difficulty set by an admin on the configuration page (worker/admin.ts).
-- It replaces the difficulty in the question bank files (src/content/data)
-- everywhere: round order, XP and what students see. A question set back to
-- its file's difficulty has no row here.

CREATE TABLE question_difficulty (
  question_id TEXT PRIMARY KEY,
  difficulty  TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  -- Email of the admin who last changed it.
  updated_by  TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);
