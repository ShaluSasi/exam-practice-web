import { create } from "zustand";
import type { AnyResponse, ClientQuestion } from "../content/schema";
import { initialResponse, nextStreak, xpFor } from "../engine/scoring";
import { ApiError, OFFLINE } from "./auth";
import { checkAnswer } from "./content";

/** Longest time the server accepts for one question (worker/progress.ts). */
const MAX_QUESTION_MS = 86_400_000;

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
  /** Each question gets its answer key once checked (or when resumed already answered). */
  questions: ClientQuestion[];
  index: number;
  /** `checking`: waiting for the server to grade the answer. */
  phase: "answering" | "checking" | "feedback";
  /** The last check could not reach the server; the answer is kept so it can be tried again. */
  checkFailed: boolean;
  /** One-off message for the current question, e.g. that a question was removed from the round. */
  notice: string | null;
  response: AnyResponse | undefined;
  usedHint: boolean;
  attempts: Attempt[];
  xp: number;
  streak: number;
  bestStreak: number;
  startedAt: number;
  finishedAt: number | null;
  questionStartedAt: number;

  start: (questions: ClientQuestion[], title: string, key?: string | null) => void;
  /** Continues a saved round; `questions` are its questions, in order (answered ones with their keys). */
  resume: (saved: SavedRound, questions: ClientQuestion[]) => void;
  setResponse: (r: AnyResponse) => void;
  revealHint: () => void;
  /** Grades the current response on the server; `skip` records it as unanswered. Null if the server could not be reached. */
  check: (skip?: boolean) => Promise<Attempt | null>;
  next: () => void;
}

export const useSession = create<SessionState>()((set, get) => ({
  key: null,
  roundId: "",
  title: "",
  questions: [],
  index: 0,
  phase: "answering",
  checkFailed: false,
  notice: null,
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
      checkFailed: false,
      notice: null,
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
      checkFailed: false,
      notice: null,
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

  check: async (skip = false) => {
    const s = get();
    if (s.phase !== "answering") return null;
    const q = s.questions[s.index];
    const response = skip ? undefined : s.response;
    set({ phase: "checking", checkFailed: false });
    let result;
    try {
      result = await checkAnswer(s.roundId, q.id, response);
    } catch (e) {
      if (get().roundId !== s.roundId || get().index !== s.index) return null;
      // Offline or a server problem: keep the answer so it can be tried again.
      const rejected = e instanceof ApiError && e.status !== OFFLINE && e.status !== 426 && e.status < 500;
      if (!rejected) {
        set({ phase: "answering", checkFailed: true });
        return null;
      }
      // The question was changed or removed since the round began: take it out of the round and move on.
      const questions = s.questions.filter((_, i) => i !== s.index);
      if (s.index >= questions.length) {
        set({ questions, phase: "answering", checkFailed: false, finishedAt: Date.now() });
        return null;
      }
      set({
        questions,
        phase: "answering",
        checkFailed: false,
        notice: "That question was updated, so it has been removed from this round.",
        response: initialResponse(questions[s.index]),
        usedHint: false,
        questionStartedAt: Date.now(),
      });
      return null;
    }
    // The student left or restarted the round while it was being checked.
    if (get().roundId !== s.roundId || get().index !== s.index) return null;
    const correct = result.correct;
    const streak = nextStreak(s.streak, correct, skip);
    const xp = correct ? xpFor(q, { streak, usedHint: s.usedHint }) : 0;
    const attempt: Attempt = {
      questionId: q.id,
      response,
      correct,
      usedHint: s.usedHint,
      xp,
      timeMs: Math.min(MAX_QUESTION_MS, Date.now() - s.questionStartedAt),
    };
    set({
      phase: "feedback",
      questions: s.questions.map((x, i) => (i === s.index ? ({ ...x, ...result.key } as ClientQuestion) : x)),
      attempts: [...s.attempts, attempt],
      xp: s.xp + xp,
      streak,
      bestStreak: Math.max(s.bestStreak, streak),
    });
    return attempt;
  },

  next: () => {
    const s = get();
    // Only from feedback: a double tap on "Continue" must not skip a question.
    if (s.phase !== "feedback") return;
    const index = s.index + 1;
    if (index >= s.questions.length) {
      set({ finishedAt: Date.now() });
      return;
    }
    set({
      index,
      phase: "answering",
      checkFailed: false,
      notice: null,
      response: initialResponse(s.questions[index]),
      usedHint: false,
      questionStartedAt: Date.now(),
    });
  },
}));
