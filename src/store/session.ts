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

/** An unfinished round, saved after every answer so it can be resumed. */
export interface SavedRound {
  /** Which quiz this is, e.g. a chapter. One unfinished round is kept per key. */
  key: string;
  roundId: string;
  title: string;
  questionIds: string[];
  attempts: Attempt[];
  xp: number;
  streak: number;
  bestStreak: number;
  elapsedMs: number;
  updatedAt: number;
}

interface SessionState {
  /** Resume key (chapter or mixed practice); null for one-off sets that are not resumed. */
  key: string | null;
  roundId: string;
  /** Shown on the scoreboard, e.g. the chapter name. */
  title: string;
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

  start: (questions: Question[], title: string, key?: string | null) => void;
  /** Continues a saved round; `questions` are its questions, in order. */
  resume: (saved: SavedRound, questions: Question[]) => void;
  setResponse: (r: AnyResponse) => void;
  revealHint: () => void;
  /** Grades the current response; `skip` records it as unanswered. */
  check: (skip?: boolean) => Attempt;
  next: () => void;
}

export const useSession = create<SessionState>()((set, get) => ({
  key: null,
  roundId: "",
  title: "",
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

  start: (questions, title, key = null) => {
    const now = Date.now();
    set({
      key,
      roundId: crypto.randomUUID(),
      title,
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

  resume: (saved, questions) => {
    const now = Date.now();
    const done = saved.attempts.length >= questions.length;
    // All answered but not yet finished: reopen the last question's feedback so "Finish" is one tap away.
    const index = done ? questions.length - 1 : saved.attempts.length;
    set({
      key: saved.key,
      roundId: saved.roundId,
      title: saved.title,
      questions,
      index,
      phase: done ? "feedback" : "answering",
      response: done ? saved.attempts[index].response : initialResponse(questions[index]),
      usedHint: false,
      attempts: saved.attempts,
      xp: saved.xp,
      streak: saved.streak,
      bestStreak: saved.bestStreak,
      // The clock continues from where it stopped, not from when the round first began.
      startedAt: now - saved.elapsedMs,
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
