import { create } from "zustand";
import type { AnyResponse, Question } from "../content/schema";
import { initialResponse, isCorrect, xpFor } from "../engine/scoring";

export interface Attempt {
  questionId: string;
  response: AnyResponse | undefined;
  correct: boolean;
  usedHint: boolean;
  xp: number;
  timeMs: number;
}

interface SessionState {
  questions: Question[];
  index: number;
  phase: "answering" | "feedback";
  response: AnyResponse | undefined;
  usedHint: boolean;
  attempts: Attempt[];
  xp: number;
  streak: number;
  bestStreak: number;
  startedAt: number;
  finishedAt: number | null;
  questionStartedAt: number;

  start: (questions: Question[]) => void;
  setResponse: (r: AnyResponse) => void;
  revealHint: () => void;
  /** Grades the current response; `skip` records it as unanswered. */
  check: (skip?: boolean) => Attempt;
  next: () => void;
}

export const useSession = create<SessionState>()((set, get) => ({
  questions: [],
  index: 0,
  phase: "answering",
  response: undefined,
  usedHint: false,
  attempts: [],
  xp: 0,
  streak: 0,
  bestStreak: 0,
  startedAt: 0,
  finishedAt: null,
  questionStartedAt: 0,

  start: (questions) => {
    const now = Date.now();
    set({
      questions,
      index: 0,
      phase: "answering",
      response: questions[0] ? initialResponse(questions[0]) : undefined,
      usedHint: false,
      attempts: [],
      xp: 0,
      streak: 0,
      bestStreak: 0,
      startedAt: now,
      finishedAt: null,
      questionStartedAt: now,
    });
  },

  setResponse: (response) => {
    if (get().phase === "answering") set({ response });
  },

  revealHint: () => set({ usedHint: true }),

  check: (skip = false) => {
    const s = get();
    const q = s.questions[s.index];
    const correct = !skip && isCorrect(q, s.response);
    const streak = correct ? s.streak + 1 : 0;
    const xp = correct ? xpFor(q, { streak, usedHint: s.usedHint }) : 0;
    const attempt: Attempt = {
      questionId: q.id,
      response: skip ? undefined : s.response,
      correct,
      usedHint: s.usedHint,
      xp,
      timeMs: Date.now() - s.questionStartedAt,
    };
    set({
      phase: "feedback",
      attempts: [...s.attempts, attempt],
      xp: s.xp + xp,
      streak,
      bestStreak: Math.max(s.bestStreak, streak),
    });
    return attempt;
  },

  next: () => {
    const s = get();
    const index = s.index + 1;
    if (index >= s.questions.length) {
      set({ finishedAt: Date.now() });
      return;
    }
    set({
      index,
      phase: "answering",
      response: initialResponse(s.questions[index]),
      usedHint: false,
      questionStartedAt: Date.now(),
    });
  },
}));
