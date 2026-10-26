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
  /**
   * One per question done, in the order they were done (not question order).
   * A skipped question that is answered later has its skip replaced by the answer, at the end.
   */
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
  /** The question on screen. Earlier questions can be gone back to; later ones only once reached. */
  index: number;
  /**
   * `checking`: waiting for the server to grade the answer. `feedback`: just answered.
   * `review`: an earlier answered question, looked at again; nothing about it can change.
   */
  phase: "answering" | "checking" | "feedback" | "review";
  /** The last check could not reach the server; the answer is kept so it can be tried again. */
  checkFailed: boolean;
  /** One-off message for the current question, e.g. that a question was removed from the round. */
  notice: string | null;
  response: AnyResponse | undefined;
  usedHint: boolean;
  /** Questions whose hint was shown this round, so leaving and coming back keeps the hint's cost. */
  hinted: string[];
  attempts: Attempt[];
  xp: number;
  streak: number;
  bestStreak: number;
  startedAt: number;
  finishedAt: number | null;
  questionStartedAt: number;
  /** Every question is done but some were skipped: asks whether to answer them before finishing. */
  endPrompt: boolean;
  /** Fetching the answers to skipped questions before the results show. */
  finishing: boolean;

  start: (questions: ClientQuestion[], title: string, key?: string | null) => void;
  /** Continues a saved round; `questions` are its questions, in order (answered ones with their keys). */
  resume: (saved: SavedRound, questions: ClientQuestion[]) => void;
  setResponse: (r: AnyResponse) => void;
  revealHint: () => void;
  /** Grades the current response on the server. Null if the server could not be reached. */
  check: () => Promise<Attempt | null>;
  /** Leaves the question unanswered for now (no answer is shown, so it can be answered later) and moves on. */
  skip: () => void;
  /** From feedback: on to the next question still to answer. From review: the next question. */
  next: () => void;
  /** Shows question `i`; only questions already reached can be opened. */
  goTo: (i: number) => void;
  /** Opens the next skipped question after the current one, wrapping round to the first. */
  nextSkipped: () => void;
  closeEndPrompt: () => void;
  /** Ends the round, fetching the answers to any questions left skipped so the results can show them. */
  finish: () => Promise<void>;
}

export function attemptFor(attempts: readonly Attempt[], questionId: string): Attempt | undefined {
  return attempts.find((a) => a.questionId === questionId);
}

/** Whether the answer key has arrived (after answering, or when a skipped question's answer was shown). */
export function hasKey(q: ClientQuestion): boolean {
  return "answer" in q || "answers" in q || "pairs" in q;
}

/** A skipped question can still be answered as long as its answer has not been shown. */
export function canAnswerLater(q: ClientQuestion, a: Attempt | undefined): boolean {
  return !!a && a.response === undefined && !hasKey(q);
}

type Data = Pick<SessionState, "questions" | "attempts">;

/** Not answered yet: never reached, or skipped and still answerable. */
export const isPending = (s: Data, i: number) => {
  const a = attemptFor(s.attempts, s.questions[i].id);
  return !a || canAnswerLater(s.questions[i], a);
};

/** The furthest question reached: the first one never tried, or the last question once all have been. */
export function frontier(s: Data): number {
  const i = s.questions.findIndex((q) => !attemptFor(s.attempts, q.id));
  return i < 0 ? s.questions.length - 1 : i;
}

/** Skipped questions that can still be answered, in question order. */
export function skippedIndexes(s: Data): number[] {
  return s.questions.flatMap((q, i) => (canAnswerLater(q, attemptFor(s.attempts, q.id)) ? [i] : []));
}

/** What showing question `i` looks like; `hinted` from the round so far. */
function view(s: Data & Pick<SessionState, "hinted">, i: number): Partial<SessionState> {
  const q = s.questions[i];
  const a = attemptFor(s.attempts, q.id);
  const answering = isPending(s, i);
  return {
    index: i,
    phase: answering ? "answering" : "review",
    checkFailed: false,
    notice: null,
    response: answering ? initialResponse(q) : a?.response,
    usedHint: s.hinted.includes(q.id),
    questionStartedAt: Date.now(),
  };
}

export const useSession = create<SessionState>()((set, get) => {
  /** On from question `from`: the next question still to answer, else the end of the round. */
  const advance = (from: number) => {
    const s = get();
    const later = s.questions.findIndex((_, i) => i > from && isPending(s, i));
    if (later >= 0) set(view(s, later));
    else if (skippedIndexes(s).length > 0) set({ endPrompt: true });
    else void get().finish();
  };

  return {
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
    hinted: [],
    attempts: [],
    xp: 0,
    streak: 0,
    bestStreak: 0,
    startedAt: 0,
    finishedAt: null,
    questionStartedAt: 0,
    endPrompt: false,
    finishing: false,

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
        hinted: [],
        attempts: [],
        xp: 0,
        streak: 0,
        bestStreak: 0,
        startedAt: now,
        finishedAt: null,
        questionStartedAt: now,
        endPrompt: false,
        finishing: false,
      });
    },

    resume: (saved, questions) => {
      const data = { questions, attempts: saved.attempts, hinted: [] };
      const fresh = questions.findIndex((q) => !attemptFor(saved.attempts, q.id));
      const skipped = skippedIndexes(data);
      // Every question tried: offer the skipped ones, or reopen the last question so "See results" is one tap away.
      const index = fresh >= 0 ? fresh : (skipped[0] ?? questions.length - 1);
      set({
        key: saved.key,
        roundId: saved.roundId,
        title: saved.title,
        questions,
        hinted: [],
        attempts: saved.attempts,
        xp: saved.xp,
        streak: saved.streak,
        bestStreak: saved.bestStreak,
        // The clock continues from where it stopped, not from when the round first began.
        startedAt: Date.now() - saved.elapsedMs,
        finishedAt: null,
        endPrompt: fresh < 0 && skipped.length > 0,
        finishing: false,
        ...view(data, index),
      });
    },

    setResponse: (response) => {
      if (get().phase === "answering") set({ response });
    },

    revealHint: () => {
      const s = get();
      const id = s.questions[s.index].id;
      set({ usedHint: true, hinted: s.hinted.includes(id) ? s.hinted : [...s.hinted, id] });
    },

    check: async () => {
      const s = get();
      if (s.phase !== "answering") return null;
      const q = s.questions[s.index];
      set({ phase: "checking", checkFailed: false });
      let result;
      try {
        result = await checkAnswer(s.roundId, q.id, s.response);
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
        const attempts = s.attempts.filter((a) => a.questionId !== q.id);
        if (questions.length === 0) {
          set({ questions, attempts, phase: "answering", checkFailed: false, finishedAt: Date.now() });
          return null;
        }
        // The question after it now sits at the same index; if that one is already done, on to the next one to answer.
        const data = { questions, attempts, hinted: s.hinted };
        const at = Math.min(s.index, questions.length - 1);
        set({ questions, attempts, ...view(data, at), notice: "That question was updated, so it has been removed from this round." });
        if (!isPending(data, at)) advance(at);
        return null;
      }
      // The student left or restarted the round while it was being checked.
      if (get().roundId !== s.roundId || get().index !== s.index) return null;
      const correct = result.correct;
      const streak = nextStreak(s.streak, correct, false);
      const xp = correct ? xpFor(q, { streak, usedHint: s.usedHint }) : 0;
      // A skipped question answered now: its skip is replaced by the answer, which goes last as the newest.
      const skippedBefore = attemptFor(s.attempts, q.id);
      const attempt: Attempt = {
        questionId: q.id,
        response: s.response,
        correct,
        usedHint: s.usedHint,
        xp,
        timeMs: Math.min(MAX_QUESTION_MS, (skippedBefore?.timeMs ?? 0) + Date.now() - s.questionStartedAt),
      };
      set({
        phase: "feedback",
        notice: null,
        questions: s.questions.map((x, i) => (i === s.index ? ({ ...x, ...result.key } as ClientQuestion) : x)),
        attempts: [...s.attempts.filter((a) => a !== skippedBefore), attempt],
        xp: s.xp + xp,
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
      });
      return attempt;
    },

    skip: () => {
      const s = get();
      if (s.phase !== "answering") return;
      const q = s.questions[s.index];
      // Only the first skip is recorded; skipping again later changes nothing. A skip leaves the streak as it was.
      if (!attemptFor(s.attempts, q.id)) {
        const attempt: Attempt = {
          questionId: q.id,
          response: undefined,
          correct: false,
          usedHint: s.usedHint,
          xp: 0,
          timeMs: Math.min(MAX_QUESTION_MS, Date.now() - s.questionStartedAt),
        };
        set({ attempts: [...s.attempts, attempt] });
      }
      advance(s.index);
    },

    next: () => {
      const s = get();
      // Only from feedback or review: a double tap on "Continue" must not skip a question.
      if (s.phase === "feedback") advance(s.index);
      else if (s.phase === "review") {
        if (s.index + 1 <= frontier(s) && s.index + 1 < s.questions.length) set(view(s, s.index + 1));
        else advance(s.index);
      }
    },

    goTo: (i) => {
      const s = get();
      if (s.phase === "checking" || s.finishing || i === s.index || i < 0 || i > frontier(s)) return;
      set({ ...view(s, i), endPrompt: false });
    },

    nextSkipped: () => {
      const s = get();
      const skipped = skippedIndexes(s);
      const i = skipped.find((x) => x > s.index) ?? skipped[0];
      if (i === undefined || s.phase === "checking") return;
      set({ ...view(s, i), endPrompt: false });
    },

    closeEndPrompt: () => set({ endPrompt: false }),

    finish: async () => {
      const s = get();
      if (s.finishing || s.finishedAt) return;
      set({ finishing: true, endPrompt: false });
      // Skipped questions are checked as skips only now, which also brings their answers for the results.
      const open = s.questions.filter((q) => canAnswerLater(q, attemptFor(s.attempts, q.id)));
      const keys = await Promise.allSettled(open.map((q) => checkAnswer(s.roundId, q.id, undefined)));
      if (get().roundId !== s.roundId) return;
      const byId = new Map(open.flatMap((q, i) => (keys[i].status === "fulfilled" ? [[q.id, keys[i].value.key] as const] : [])));
      set({
        questions: get().questions.map((q) => (byId.has(q.id) ? ({ ...q, ...byId.get(q.id) } as ClientQuestion) : q)),
        finishing: false,
        finishedAt: Date.now(),
      });
    },
  };
});
