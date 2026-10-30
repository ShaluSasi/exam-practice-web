/**
 * The question banks (src/content/data/*.json), bundled into the Worker so a
 * fix reaches every student as soon as it is deployed. They are checked
 * against the schema at build time (vite.config.ts), so they are trusted here.
 *
 * Students get questions without their answers (`publicQuestion`); the answer
 * key comes back only once a question has been answered or skipped.
 */
import { isCorrect, nextStreak, scoreSession, xpFor } from "../src/engine/scoring";
import type { ChapterInfo, Difficulty } from "../src/content/api";
import { KEY_FIELDS, type AnswerKey, type AnyResponse, type ClientQuestion, type Question } from "../src/content/schema";
import type { Env } from "./http";

const files = import.meta.glob<Question[]>("../src/content/data/*.json", { import: "default" });

interface Chapter extends Omit<ChapterInfo, "count" | "cover"> {
  questions: Question[];
  cover?: string;
}

export interface Bank {
  chapters: Map<string, Chapter>;
  byId: Map<string, Question>;
  all: Question[];
  version: string;
}

async function hash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(digest).slice(0, 6)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const chapterKey = (q: Question) => `${q.subject}|${q.grade}|${q.chapter}`;

let files$: Promise<Question[]> | null = null;

/** Every question as it is in the bank files, before any admin change. Loaded once per Worker instance. */
export function fileQuestions(): Promise<Question[]> {
  files$ ??= Promise.all(
    Object.entries(files)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, load]) => load()),
  )
    .then((banks) => banks.flat())
    .catch((e: unknown) => {
      files$ = null;
      throw e;
    });
  return files$;
}

/** How long an instance keeps admin changes before asking D1 again; the admin's own instance sees them at once. */
const CHANGES_TTL_MS = 30_000;

/**
 * Admin changes kept in a D1 table, cached per instance. `forget` (after an
 * admin saves) makes this instance read them again on the next request.
 */
function adminChanges<T>(read: (env: Env) => Promise<T>, none: () => T) {
  let cache: { at: number; rows: Promise<T> } | null = null;
  return {
    get(env: Env): Promise<T> {
      if (!cache || Date.now() - cache.at > CHANGES_TTL_MS) {
        cache = {
          at: Date.now(),
          // Without the table (e.g. the migration has not run yet) students still get the bank files as they are.
          rows: read(env).catch((e: unknown) => {
            console.error(e);
            cache = null;
            return none();
          }),
        };
      }
      return cache.rows;
    },
    forget() {
      cache = null;
    },
  };
}

/** Difficulties admins have set (table question_difficulty), by question ID. */
export const difficultyChanges = adminChanges(
  async (env) => {
    const { results } = await env.DB.prepare("SELECT question_id, difficulty FROM question_difficulty ORDER BY question_id").all<{
      question_id: string;
      difficulty: Difficulty;
    }>();
    return new Map(results.map((r) => [r.question_id, r.difficulty]));
  },
  () => new Map<string, Difficulty>(),
);

/** Question order admins have set (table chapter_order): question IDs, first to last, by chapter key. */
export const chapterOrders = adminChanges(
  async (env) => {
    const { results } = await env.DB.prepare("SELECT chapter_key, question_ids FROM chapter_order").all<{ chapter_key: string; question_ids: string }>();
    return new Map(results.map((r) => [r.chapter_key, JSON.parse(r.question_ids) as string[]]));
  },
  () => new Map<string, string[]>(),
);

/** `questions` in the admin's `order`; ones it does not list (added since) follow in their current order. */
export function inOrder<T extends { id: string }>(questions: readonly T[], order: readonly string[]): T[] {
  const at = new Map(order.map((id, i) => [id, i]));
  return [...questions].sort((a, b) => (at.get(a.id) ?? order.length) - (at.get(b.id) ?? order.length));
}

async function build(all: Question[]): Promise<Bank> {
  const chapters = new Map<string, Chapter>();
  for (const q of all) {
    const key = chapterKey(q);
    let c = chapters.get(key);
    if (!c) {
      c = { key, title: q.chapter, no: q.chapterNo, subject: q.subject, grade: q.grade, questions: [], version: "" };
      chapters.set(key, c);
    }
    c.questions.push(q);
    c.cover ??= q.image?.src;
  }
  for (const c of chapters.values()) c.version = await hash(c.questions);
  return { chapters, byId: new Map(all.map((q) => [q.id, q])), all, version: await hash([...chapters.values()].map((c) => c.version)) };
}

let bank: { changes: string; bank: Promise<Bank> } | null = null;

/** The bank files with the admins' difficulty changes applied; rebuilt only when those change. */
export async function loadBank(env: Env): Promise<Bank> {
  const [questions, changed] = await Promise.all([fileQuestions(), difficultyChanges.get(env)]);
  const key = JSON.stringify([...changed]);
  if (bank?.changes !== key) {
    const built = build(questions.map((q) => (changed.has(q.id) ? { ...q, difficulty: changed.get(q.id)! } : q))).catch((e: unknown) => {
      bank = null;
      throw e;
    });
    bank = { changes: key, bank: built };
  }
  return bank.bank;
}

/** Image paths in the banks are site-relative; the app (served from the phone) needs full URLs. */
export function absoluteImages<T>(value: T, origin: string): T {
  return JSON.parse(JSON.stringify(value), (k, v: unknown) =>
    k === "src" && typeof v === "string" && v.startsWith("/") ? origin + v : v,
  ) as T;
}

export function chapterInfo(c: Chapter, origin: string): ChapterInfo {
  const { questions, cover, ...rest } = c;
  return { ...rest, count: questions.length, ...(cover ? { cover: origin + cover } : {}) };
}

/** The question without anything that gives its answer away. */
export function publicQuestion(q: Question, origin: string): ClientQuestion {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(q)) if (!(KEY_FIELDS as readonly string[]).includes(k)) out[k] = v;
  if (q.type === "hotspot") out.spots = q.spots.map(({ label: _, ...spot }) => spot);
  return absoluteImages(out as ClientQuestion, origin);
}

export function answerKey(q: Question): AnswerKey {
  const key: AnswerKey = {};
  for (const [k, v] of Object.entries(q)) if ((KEY_FIELDS as readonly string[]).includes(k)) key[k as keyof AnswerKey] = v as never;
  if (q.type === "hotspot") key.spots = q.spots;
  return key;
}

/** Whether `r` has the right shape for the question's type (the grading code assumes it does). */
export function isResponseFor(q: Question, r: unknown): r is AnyResponse {
  const strings = (a: unknown) => Array.isArray(a) && a.every((x) => typeof x === "string");
  switch (q.type) {
    case "mcq":
    case "assertion_reason":
    case "hotspot":
    case "numeric":
      return typeof r === "string";
    case "multi":
      // No repeats: the grading compares lengths, so ["a", "a"] would pass for answers ["a", "b"].
      return strings(r) && new Set(r as string[]).size === (r as string[]).length;
    case "order":
      return strings(r) && (r as string[]).length === q.items.length;
    case "match":
      return typeof r === "object" && r !== null && !Array.isArray(r) && Object.values(r).every((x) => typeof x === "string");
  }
}

/** Grades one answer; anything malformed counts as wrong. `undefined` is a skip. */
export function grade(q: Question, r: unknown): boolean {
  return r !== undefined && r !== null && isResponseFor(q, r) && isCorrect(q, r);
}

export interface AttemptIn {
  questionId: string;
  response?: unknown;
  usedHint: boolean;
}

/** The answers a signed-in student checked for a round (table `checks`), by question. */
export async function recordedChecks(env: Env, userId: string, roundId: string): Promise<Map<string, unknown>> {
  const { results } = await env.DB.prepare("SELECT question_id, response FROM checks WHERE user_id = ? AND round_id = ?")
    .bind(userId, roundId)
    .all<{ question_id: string; response: string | null }>();
  return new Map(results.map((r) => [r.question_id, r.response === null ? undefined : (JSON.parse(r.response) as unknown)]));
}

/**
 * Replaces each attempt's answer with the one the server saw checked, so a
 * saved round is graded from what the student really answered first. An
 * attempt the server never saw checked counts as skipped.
 */
export function fromRecorded<T extends AttemptIn>(attempts: T[], recorded: Map<string, unknown>): T[] {
  return attempts.map((a) => ({ ...a, response: recorded.get(a.questionId) }));
}

/**
 * Re-grades a round's answers here, in order, with the same rules the app
 * shows (streak bonus, half XP with a hint), so saved scores never depend on
 * what the app reports. Questions removed since the round was played are left out.
 */
export function gradeRound(bank: Bank, questionIds: string[], attempts: AttemptIn[]) {
  const questions = [...new Set(questionIds)].map((id) => bank.byId.get(id)).filter((q): q is Question => !!q);
  const inRound = new Set(questions.map((q) => q.id));
  let streak = 0;
  let bestStreak = 0;
  let xp = 0;
  // Only the round's own questions count, and each at most once (the first attempt).
  const seen = new Set<string>();
  const graded = attempts.flatMap((a) => {
    const q = bank.byId.get(a.questionId);
    if (!q || !inRound.has(q.id) || seen.has(q.id)) return [];
    seen.add(q.id);
    const correct = grade(q, a.response);
    streak = nextStreak(streak, correct, a.response === undefined || a.response === null);
    bestStreak = Math.max(bestStreak, streak);
    const gained = correct ? xpFor(q, { streak, usedHint: a.usedHint }) : 0;
    xp += gained;
    return [{ questionId: q.id, correct, xp: gained, response: (a.response ?? undefined) as AnyResponse | undefined }];
  });
  const score = scoreSession(questions, graded);
  return { graded, score, xp, bestStreak, total: questions.length };
}
