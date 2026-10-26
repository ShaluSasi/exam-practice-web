import type { AnswerKey, ClientQuestion, Question, QuestionType, SubjectId } from "./schema";

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
