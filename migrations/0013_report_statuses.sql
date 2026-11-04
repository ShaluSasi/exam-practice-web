-- Reports now move through a workflow an admin sets by hand (worker/reports.ts):
-- new, accepted, rejected, fixed, reviewed or closed. SQLite cannot change a
-- CHECK constraint, so the table is rebuilt. Open reports become new and
-- approved ones fixed: approving is what marked a report as dealt with.

CREATE TABLE question_reports_new (
  id          TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- wrong_answer | question_error | unclear | image | other
  reason      TEXT NOT NULL,
  remark      TEXT NOT NULL,
  -- The student's suggested fix (QuestionEdit JSON), or NULL.
  proposal    TEXT,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'accepted', 'rejected', 'fixed', 'reviewed', 'closed')),
  created_at  INTEGER NOT NULL,
  -- Email of the admin who last set the status, when, why, and the edit applied (QuestionEdit JSON) if any.
  resolved_by TEXT,
  resolved_at INTEGER,
  admin_note  TEXT,
  applied     TEXT
);

INSERT INTO question_reports_new (id, question_id, user_id, reason, remark, proposal, status, created_at, resolved_by, resolved_at, admin_note, applied)
SELECT id, question_id, user_id, reason, remark, proposal,
       CASE status WHEN 'open' THEN 'new' WHEN 'approved' THEN 'fixed' ELSE status END,
       created_at, resolved_by, resolved_at, admin_note, applied
FROM question_reports;

DROP TABLE question_reports;
ALTER TABLE question_reports_new RENAME TO question_reports;

CREATE INDEX question_reports_status ON question_reports (status, created_at);
CREATE INDEX question_reports_user ON question_reports (user_id, created_at);
