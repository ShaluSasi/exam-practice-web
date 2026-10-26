import type { AnyResponse, ClientQuestion, Question, ResponseFor } from "../content/schema";

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function isAnswered(q: ClientQuestion, r: AnyResponse | undefined): boolean {
  if (r === undefined) return false;
  switch (q.type) {
    case "mcq":
    case "assertion_reason":
    case "hotspot":
      return (r as string) !== "";
    case "numeric":
      return (r as string).trim() !== "" && Number.isFinite(Number(r));
    case "multi":
      return (r as string[]).length > 0;
    case "match":
      return Object.keys(r as Record<string, string>).length === q.left.length;
    case "order":
      return true; // any arrangement is a valid answer
  }
}

/** Grading needs the answer, so it runs on the server (worker/content.ts). */
export function isCorrect(q: Question, r: AnyResponse | undefined): boolean {
  if (!isAnswered(q, r)) return false;
  switch (q.type) {
    case "mcq":
    case "assertion_reason":
    case "hotspot":
      return r === q.answer;
    case "numeric":
      return Math.abs(Number(r) - q.answer) <= (q.tolerance ?? 0) + 1e-9;
    case "multi":
      return sameSet(r as string[], q.answers);
    case "match": {
      const m = r as ResponseFor<"match">;
      return Object.entries(q.pairs).every(([l, rt]) => m[l] === rt);
    }
    case "order":
      return (r as string[]).every((id, i) => q.answer[i] === id);
  }
}

/** Starting response so "order" questions begin in the authored order. */
export function initialResponse(q: ClientQuestion): AnyResponse | undefined {
  return q.type === "order" ? q.items.map((i) => i.id) : undefined;
}

/** Number of questions drawn for one practice round. */
export const ROUND_SIZE = 20;

/** A random sample of up to `n` items (Fisher–Yates on a copy). */
export function pickRandom<T>(items: readonly T[], n = ROUND_SIZE): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

const LEVELS = ["easy", "medium", "hard"] as const;
type Level = (typeof LEVELS)[number];

/** Share of a round at each difficulty: a gentle start, a solid middle and only a few hard questions to finish. */
export const ROUND_MIX: Record<Level, number> = { easy: 0.35, medium: 0.45, hard: 0.2 };

/** Where a level's missing questions come from when a pool runs short: the nearest level first. */
const FALLBACK: Record<Level, Level[]> = { easy: ["medium", "hard"], medium: ["easy", "hard"], hard: ["medium", "easy"] };

/** Questions easiest first; the order within each level is kept. */
export function byDifficulty<T extends { difficulty: Level }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => LEVELS.indexOf(a.difficulty) - LEVELS.indexOf(b.difficulty));
}

/**
 * A random round of up to `n` questions that ramps up: easy questions first,
 * then medium, with the few hard ones at the end. Aims for `ROUND_MIX`; a
 * level the pool is short of is made up from the nearest other level.
 */
export function pickRound<T extends { difficulty: Level }>(pool: readonly T[], n = ROUND_SIZE): T[] {
  const shuffled = Object.fromEntries(LEVELS.map((l) => [l, pickRandom(pool.filter((q) => q.difficulty === l), Infinity)])) as Record<Level, T[]>;
  const size = Math.min(n, pool.length);
  const want = { easy: Math.round(size * ROUND_MIX.easy), hard: Math.round(size * ROUND_MIX.hard), medium: 0 };
  want.medium = size - want.easy - want.hard;
  const take = Object.fromEntries(LEVELS.map((l) => [l, Math.min(want[l], shuffled[l].length)])) as Record<Level, number>;
  for (const l of LEVELS) {
    // Only the pool's own shortfall counts: a level that has already lent questions to another is not short.
    let short = Math.max(0, want[l] - Math.min(want[l], shuffled[l].length));
    for (const from of FALLBACK[l]) {
      if (short === 0) break;
      const extra = Math.min(short, shuffled[from].length - take[from]);
      take[from] += extra;
      short -= extra;
    }
  }
  return LEVELS.flatMap((l) => shuffled[l].slice(0, take[l]));
}

export interface ScoreSummary {
  correct: number;
  wrong: number;
  skipped: number;
  /** Questions done so far, skips included. */
  answered: number;
  marks: number;
  maxMarks: number;
  /**
   * Percent of the questions done so far that were answered correctly; a skip
   * is not a correct answer. Once the round is over this is its score, saved as
   * the round's `accuracy` and used for best scores, mastery and challenges, so
   * skipping never raises it.
   */
  percent: number;
  /** Percent of the questions tried (skips left out) that were right; null until one has been tried. */
  accuracy: number | null;
}

/** Scoreboard numbers for a round so far. Wrong answers cost `negativeMarks`; skips cost nothing and count as neither right nor wrong. */
export function scoreSession(
  questions: readonly Pick<Question, "id" | "marks" | "negativeMarks">[],
  attempts: readonly { questionId: string; correct: boolean; response: AnyResponse | undefined }[],
): ScoreSummary {
  const byId = new Map(questions.map((q) => [q.id, q]));
  let correct = 0, wrong = 0, skipped = 0, marks = 0;
  for (const a of attempts) {
    const q = byId.get(a.questionId);
    if (!q) continue;
    if (a.correct) {
      correct++;
      marks += q.marks;
    } else if (a.response === undefined) skipped++;
    else {
      wrong++;
      marks -= q.negativeMarks ?? 0;
    }
  }
  const answered = attempts.length;
  return {
    correct,
    wrong,
    skipped,
    answered,
    marks,
    maxMarks: questions.reduce((n, q) => n + q.marks, 0),
    percent: answered ? Math.round((correct / answered) * 100) : 0,
    accuracy: correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : null,
  };
}

/** The streak after an answer: a right one adds to it, a wrong one ends it and a skip leaves it as it was. */
export function nextStreak(streak: number, correct: boolean, skipped: boolean): number {
  return correct ? streak + 1 : skipped ? streak : 0;
}

const BASE_XP = { easy: 10, medium: 15, hard: 20 } as const;

export function xpFor(q: Pick<Question, "difficulty">, opts: { streak: number; usedHint: boolean }): number {
  let xp: number = BASE_XP[q.difficulty];
  if (opts.usedHint) xp = Math.round(xp / 2);
  if (opts.streak >= 3) xp += 5;
  return xp;
}
