-- Quizzes are shown to students only once an admin releases them
-- (worker/quizzes.ts). 'draft': new or cloned, never released; 'released':
-- public; 'withheld': taken back from students, can be released again.
-- Quizzes made before this were already public, so they start released.
ALTER TABLE quizzes ADD COLUMN status TEXT NOT NULL DEFAULT 'released';
