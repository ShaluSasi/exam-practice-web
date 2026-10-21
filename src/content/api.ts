import type { AnswerKey, ClientQuestion, QuestionType, SubjectId } from "./schema";

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
