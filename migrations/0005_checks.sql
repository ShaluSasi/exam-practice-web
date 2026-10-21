-- The first answer a signed-in student has checked for each question of a
-- round (worker/questions.ts). Saved rounds and progress are graded from
-- these rows, not from the answers the app sends later, so learning the
-- answer key from /api/answers/check and then "answering" does not pay.

CREATE TABLE checks (
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  round_id    TEXT NOT NULL,
  question_id TEXT NOT NULL,
  -- What the student picked (JSON); NULL for a skip.
  response    TEXT,
  checked_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, round_id, question_id)
);
