-- Scheduled quizzes (worker/quizzes.ts). An admin creates a quiz from the
-- question banks with a start time, an end time and a time limit; signed-in
-- students take it once inside that window. Those who reach the pass mark get
-- a certificate of achievement.

CREATE TABLE quizzes (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  -- The window students can start in (ms since epoch).
  starts_at    INTEGER NOT NULL,
  ends_at      INTEGER NOT NULL,
  -- Time each student gets from starting, in minutes (never past ends_at).
  duration_min INTEGER NOT NULL,
  pass_percent INTEGER NOT NULL,
  -- Question IDs from the banks (JSON array), in the order they are asked.
  question_ids TEXT NOT NULL,
  created_by   TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX quizzes_window ON quizzes (ends_at, starts_at);

-- One attempt per student per quiz. Answers are saved as they are picked;
-- the attempt is graded on submit, or once its deadline has passed.
CREATE TABLE quiz_attempts (
  quiz_id        TEXT NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  started_at     INTEGER NOT NULL,
  deadline       INTEGER NOT NULL,
  -- { questionId: response } (JSON).
  answers        TEXT NOT NULL DEFAULT '{}',
  submitted_at   INTEGER,
  correct        INTEGER,
  total          INTEGER,
  percent        INTEGER,
  passed         INTEGER,
  -- Set for passed attempts: the code printed on the certificate.
  certificate_id TEXT UNIQUE,
  PRIMARY KEY (quiz_id, user_id)
);

CREATE INDEX quiz_attempts_rank ON quiz_attempts (quiz_id, percent);
CREATE INDEX quiz_attempts_user ON quiz_attempts (user_id);
