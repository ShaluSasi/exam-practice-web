import type { AnyResponse, Question, ResponseFor } from "../content/schema";

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function isAnswered(q: Question, r: AnyResponse | undefined): boolean {
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
export function initialResponse(q: Question): AnyResponse | undefined {
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

export interface ScoreSummary {
  correct: number;
  wrong: number;
  skipped: number;
  answered: number;
  marks: number;
  maxMarks: number;
  /** Percent of attempted questions answered correctly. */
  accuracy: number;
}

/** Scoreboard numbers for a round so far. Wrong answers cost `negativeMarks`; skips cost nothing. */
export function scoreSession(
  questions: readonly Question[],
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
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
  };
}

const BASE_XP = { easy: 10, medium: 15, hard: 20 } as const;

export function xpFor(q: Question, opts: { streak: number; usedHint: boolean }): number {
  let xp: number = BASE_XP[q.difficulty];
  if (opts.usedHint) xp = Math.round(xp / 2);
  if (opts.streak >= 3) xp += 5;
  return xp;
}
