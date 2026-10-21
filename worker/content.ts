/**
 * The question banks (src/content/data/*.json), bundled into the Worker so a
 * fix reaches every student as soon as it is deployed. They are checked
 * against the schema at build time (vite.config.ts), so they are trusted here.
 *
 * Students get questions without their answers (`publicQuestion`); the answer
 * key comes back only once a question has been answered or skipped.
 */
import { isCorrect, scoreSession, xpFor } from "../src/engine/scoring";
import type { ChapterInfo } from "../src/content/api";
import { KEY_FIELDS, type AnswerKey, type AnyResponse, type ClientQuestion, type Question } from "../src/content/schema";

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

async function build(): Promise<Bank> {
  const banks = await Promise.all(
    Object.entries(files)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, load]) => load()),
  );
  const all = banks.flat();
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

let bank: Promise<Bank> | null = null;

/** Loaded once per Worker instance, on the first request that needs it. */
export function loadBank(): Promise<Bank> {
  bank ??= build().catch((e: unknown) => {
    bank = null;
    throw e;
  });
  return bank;
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
      return strings(r);
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

/**
 * Re-grades a round's answers here, in order, with the same rules the app
 * shows (streak bonus, half XP with a hint), so saved scores never depend on
 * what the app reports. Questions removed since the round was played are left out.
 */
export function gradeRound(bank: Bank, questionIds: string[], attempts: AttemptIn[]) {
  const questions = questionIds.map((id) => bank.byId.get(id)).filter((q): q is Question => !!q);
  let streak = 0;
  let bestStreak = 0;
  let xp = 0;
  const graded = attempts.flatMap((a) => {
    const q = bank.byId.get(a.questionId);
    if (!q) return [];
    const correct = grade(q, a.response);
    streak = correct ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
    const gained = correct ? xpFor(q, { streak, usedHint: a.usedHint }) : 0;
    xp += gained;
    return [{ questionId: q.id, correct, xp: gained, response: (a.response ?? undefined) as AnyResponse | undefined }];
  });
  const score = scoreSession(questions, graded);
  return { graded, score, xp, bestStreak, total: questions.length };
}
