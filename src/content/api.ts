import type { CertificateFormat } from "./certificate";
import type { QuestionEdit } from "./edit";
import type { AnswerKey, AnyResponse, ClientQuestion, Question, QuestionType, SubjectId } from "./schema";

/**
 * Shapes of the content API (worker/questions.ts). Questions, answers and
 * images all come from the server, so a fix reaches every student on their
 * next request. Each chapter carries a `version` (a hash of its questions):
 * unused for now, it is there so the app can later cache chapters and
 * re-download only the ones whose version changed.
 */

export interface ChapterInfo {
  /** `${subject}|${grade}|${chapter}`, also used for resuming rounds and chapter leaderboards. */
  key: string;
  title: string;
  no?: number;
  subject: SubjectId;
  grade: number;
  count: number;
  /** Absolute URL of the first question image, shown on the chapter card. */
  cover?: string;
  version: string;
}

/** GET /api/catalog */
export interface Catalog {
  version: string;
  chapters: ChapterInfo[];
  types: QuestionType[];
}

/** GET /api/questions. `missing`: requested IDs that no longer exist. */
export interface QuestionsResponse {
  questions: ClientQuestion[];
  missing: string[];
}

/** POST /api/answers/check */
export interface CheckResponse {
  correct: boolean;
  key: AnswerKey;
}

/** GET /api/config */
export interface AppConfig {
  /** Oldest app build the server still supports; older apps must update. */
  minBuild: number;
}

// ---------- Admin configuration (worker/admin.ts) ----------

export type Difficulty = Question["difficulty"];

/** GET /api/admin/chapters: every chapter, with how many questions it has at each difficulty. */
export interface AdminChapter extends Omit<ChapterInfo, "cover" | "version"> {
  difficulty: Record<Difficulty, number>;
  /** Questions whose difficulty an admin has changed from the bank file's. */
  changed: number;
  /** An admin has set the order its questions are shown in. */
  ordered: boolean;
}

/** A question in full (answer included), with its difficulty in the bank file and who last changed it. */
export interface AdminQuestion {
  question: Question;
  fileDifficulty: Difficulty;
  changedBy?: string;
  changedAt?: number;
}

/** GET /api/admin/questions?chapter=<key> */
export interface AdminQuestions {
  chapter: AdminChapter;
  /** In bank file order. */
  questions: AdminQuestion[];
  /** The order an admin set (question IDs, first to last), if any. */
  order?: { ids: string[]; updatedBy: string; updatedAt: number };
}

/** POST /api/admin/order: every question of the chapter, first to last; `ids: null` goes back to the default order. */
export interface ChapterOrderIn {
  chapter: string;
  ids: string[] | null;
}

/** POST /api/admin/difficulty */
export interface DifficultyChanges {
  changes: { id: string; difficulty: Difficulty }[];
}

// ---------- Reported questions (worker/reports.ts) ----------

export type ReportReason = "wrong_answer" | "question_error" | "unclear" | "image" | "other";
export type ReportStatus = "open" | "approved" | "rejected";

/** POST /api/reports: a signed-in student reports a problem with a question they have answered. */
export interface ReportIn {
  questionId: string;
  reason: ReportReason;
  remark: string;
  /** The fix the student suggests, if any. */
  proposal?: QuestionEdit;
}

export interface AdminReport {
  id: string;
  reason: ReportReason;
  remark: string;
  proposal?: QuestionEdit;
  status: ReportStatus;
  createdAt: number;
  reporter: { name: string; email: string };
  resolvedBy?: string;
  resolvedAt?: number;
  adminNote?: string;
  /** The edit an admin applied when approving, if any. */
  applied?: QuestionEdit;
}

/** The reports about one question. `question` is null if it has since been removed from the bank. */
export interface AdminReportGroup {
  questionId: string;
  question: Question | null;
  /** An admin has already edited this question. */
  edited: boolean;
  reports: AdminReport[];
}

/** GET /api/admin/reports?status=<status> */
export interface AdminReports {
  groups: AdminReportGroup[];
  counts: Record<ReportStatus, number>;
}

/** POST /api/admin/reports/resolve. Approving with an `edit` changes the question for everyone. */
export interface ResolveReportIn {
  id: string;
  action: "approve" | "reject";
  edit?: QuestionEdit;
  note?: string;
}

// ---------- Quizzes (worker/quizzes.ts) ----------

/** A scheduled quiz as students see it. Times are ms since epoch. */
export interface QuizInfo {
  id: string;
  title: string;
  description: string;
  startsAt: number;
  endsAt: number;
  /** Minutes each student gets from starting (cut short by the end of the window). */
  durationMin: number;
  passPercent: number;
  questionCount: number;
  /** Students who have started it. */
  participants: number;
  /** The signed-in student's attempt, if any. */
  mine?: { status: "in_progress" | "submitted"; deadline: number; percent?: number; passed?: boolean; certificateId?: string };
}

/** GET /api/quizzes: quizzes not yet over, and those that ended in the last 30 days. `now` is the server's clock. */
export interface QuizList {
  quizzes: QuizInfo[];
  now: number;
}

/** POST /api/quizzes/start: the questions (without answers) and the answers saved so far. */
export interface QuizSession {
  quiz: QuizInfo;
  questions: ClientQuestion[];
  answers: Record<string, AnyResponse>;
  deadline: number;
  now: number;
}

/** POST /api/quizzes/answer. `response: null` clears it. */
export interface QuizAnswerIn {
  quizId: string;
  questionId: string;
  response: AnyResponse | null;
}

export interface Certificate {
  id: string;
  name: string;
  quizTitle: string;
  percent: number;
  issuedAt: number;
  /** The quiz's wording and look, as an admin set them. */
  format: CertificateFormat;
}

/** POST /api/quizzes/submit, GET /api/quizzes/result?quiz=<id>. `review` arrives once the quiz has ended. */
export interface QuizResult {
  quiz: QuizInfo;
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  timeTakenMs: number;
  /** Position among everyone who has finished so far. */
  rank: number;
  finished: number;
  certificate?: Certificate;
  review?: { question: ClientQuestion; response?: AnyResponse; correct: boolean }[];
}

/** GET /api/quizzes/board?quiz=<id>: the top scorers, once the quiz has ended. */
export interface QuizBoard {
  entries: { rank: number; name: string; picture: string | null; percent: number; timeTakenMs: number; passed: boolean; isMe: boolean }[];
  finished: number;
}

/** A quiz with what only admins see. */
export interface AdminQuiz extends QuizInfo {
  questionIds: string[];
  createdBy: string;
  passedCount: number;
  certificate: CertificateFormat;
}

/** POST /api/admin/quizzes/certificate: the quiz's certificate format; `format: null` goes back to the default. */
export interface CertificateIn {
  id: string;
  format: CertificateFormat | null;
}

/** POST /api/admin/quizzes/save: creates a quiz (no `id`) or changes one. */
export interface QuizIn {
  id?: string;
  title: string;
  description: string;
  startsAt: number;
  endsAt: number;
  durationMin: number;
  passPercent: number;
  questionIds: string[];
}

/** GET /api/admin/quizzes/results?quiz=<id> */
export interface AdminQuizResults {
  rows: { name: string; email: string; status: "in_progress" | "submitted"; percent: number | null; passed: boolean; startedAt: number; submittedAt: number | null; certificateId: string | null }[];
}
