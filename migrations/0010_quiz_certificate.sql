-- The certificate's wording, signature and colours for each quiz, set by an
-- admin (CertificateFormat JSON, src/content/certificate.ts). NULL: the default.

ALTER TABLE quizzes ADD COLUMN certificate TEXT;
