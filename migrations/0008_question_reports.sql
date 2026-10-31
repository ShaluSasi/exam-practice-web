-- Problems students report with a question (worker/reports.ts), each with a
-- remark and, optionally, the fix they suggest (a QuestionEdit, see
-- src/content/edit.ts). Admins approve, modify or reject them on the
-- configuration page.

CREATE TABLE question_reports (
  id          TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- wrong_answer | question_error | unclear | image | other
  reason      TEXT NOT NULL,
  remark      TEXT NOT NULL,
  -- The student's suggested fix (QuestionEdit JSON), or NULL.
  proposal    TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected')),
  created_at  INTEGER NOT NULL,
  -- Email of the admin who approved or rejected it, when, why, and the edit applied (QuestionEdit JSON) if any.
  resolved_by TEXT,
  resolved_at INTEGER,
  admin_note  TEXT,
  applied     TEXT
);

CREATE INDEX question_reports_status ON question_reports (status, created_at);
CREATE INDEX question_reports_user ON question_reports (user_id, created_at);

-- Question text and answers changed by an admin (from a report). Applied over
-- the question bank files everywhere, like question_difficulty. `edit` holds
-- every change made so far (QuestionEdit JSON), relative to the file.

CREATE TABLE question_edits (
  question_id TEXT PRIMARY KEY,
  edit        TEXT NOT NULL,
  updated_by  TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);
