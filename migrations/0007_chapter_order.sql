-- The order an admin set for a chapter's questions on the configuration page
-- (worker/admin.ts). A chapter round still draws its questions at random,
-- but shows them in this order. Chapters without a row keep the default:
-- easy questions first, then moderate, then hard.

CREATE TABLE chapter_order (
  -- `${subject}|${grade}|${chapter}`, as in the catalog.
  chapter_key  TEXT PRIMARY KEY,
  -- JSON array of question IDs, first to last.
  question_ids TEXT NOT NULL,
  -- Email of the admin who last changed it.
  updated_by   TEXT NOT NULL,
  updated_at   INTEGER NOT NULL
);
