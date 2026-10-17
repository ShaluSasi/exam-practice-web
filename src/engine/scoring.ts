import type { AnyResponse, Question, ResponseFor } from "../content/schema";

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function isAnswered(q: Question, r: AnyResponse | undefined): boolean {
  if (r === undefined) return false;
  switch (q.type) {
    case "mcq":
    case "assertion_reason":
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

const BASE_XP = { easy: 10, medium: 15, hard: 20 } as const;

export function xpFor(q: Question, opts: { streak: number; usedHint: boolean }): number {
  let xp: number = BASE_XP[q.difficulty];
  if (opts.usedHint) xp = Math.round(xp / 2);
  if (opts.streak >= 3) xp += 5;
  return xp;
}
