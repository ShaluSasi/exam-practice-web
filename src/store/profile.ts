import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { SubjectId } from "../content/schema";

export type ThemePref = "system" | "light" | "dark";

/** One finished practice round, as shown on the scoreboard. */
export interface Round {
  id: string;
  at: number;
  title: string;
  correct: number;
  total: number;
  marks: number;
  maxMarks: number;
  accuracy: number;
  xp: number;
  timeMs: number;
  /** Best answer streak in this round. Missing on rounds saved before accounts existed. */
  streak?: number;
  /** Chapter key or "mixed"; missing for one-off sets. */
  quizKey?: string;
}

export interface Stats {
  totalXp: number;
  bestStreak: number;
  sessions: number;
  rounds: Round[];
}

/** A signed-in student's scores, as last loaded from the server. */
export interface AccountStats extends Stats {
  userId: string;
}

const MAX_ROUNDS = 30;

/**
 * The top-level stats are this device's guest progress (playing without
 * signing in). Signed-in progress lives on the server; `account` is the
 * copy shown on screen and `pending` holds rounds not yet saved there.
 */
interface ProfileState extends Stats {
  account: AccountStats | null;
  pending: { userId: string; round: Round }[];
  /** Account this device's guest progress was copied into, so it is copied only once. */
  importedTo: string | null;
  soundOn: boolean;
  theme: ThemePref;
  /** Subject tab last opened on the home screen. */
  lastSubject: SubjectId | null;
  setLastSubject: (s: SubjectId) => void;
  /** Class tab last opened on the home screen. */
  lastGrade: number | null;
  setLastGrade: (g: number) => void;
  recordSession: (round: Round, bestStreak: number) => void;
  /** Shows a signed-in round straight away and queues it for the server. */
  recordAccountRound: (userId: string, round: Round) => void;
  setAccount: (account: AccountStats | null) => void;
  removePending: (roundIds: string[]) => void;
  setImportedTo: (userId: string) => void;
  toggleSound: () => void;
  setTheme: (t: ThemePref) => void;
}

/** Adds a round to a set of stats, keeping at most `keep` rounds (newest first). */
export function addRound(stats: Stats, round: Round, streak: number, keep = Infinity): Stats {
  return {
    totalXp: stats.totalXp + round.xp,
    bestStreak: Math.max(stats.bestStreak, streak),
    sessions: stats.sessions + 1,
    rounds: [round, ...stats.rounds.filter((r) => r.id !== round.id)].slice(0, keep),
  };
}

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      totalXp: 0,
      bestStreak: 0,
      sessions: 0,
      rounds: [],
      account: null,
      pending: [],
      importedTo: null,
      soundOn: true,
      theme: "system",
      lastSubject: null,
      setLastSubject: (lastSubject) => set({ lastSubject }),
      lastGrade: null,
      setLastGrade: (lastGrade) => set({ lastGrade }),
      recordSession: (round, streak) => set((s) => addRound(s, round, streak, MAX_ROUNDS)),
      recordAccountRound: (userId, round) =>
        set((s) => ({
          account: { userId, ...addRound(s.account?.userId === userId ? s.account : emptyStats(), round, round.streak ?? 0) },
          pending: [...s.pending, { userId, round }],
        })),
      setAccount: (account) => set({ account }),
      removePending: (ids) => set((s) => ({ pending: s.pending.filter((p) => !ids.includes(p.round.id)) })),
      setImportedTo: (importedTo) => set({ importedTo }),
      toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "prepquest-profile", storage: createJSONStorage(() => localStorage) },
  ),
);

export function emptyStats(): Stats {
  return { totalXp: 0, bestStreak: 0, sessions: 0, rounds: [] };
}

/** The stats to show: the signed-in student's account, or this device's guest progress. */
export function useStats(): Stats {
  return useProfile(
    useShallow((s) =>
      s.account
        ? { totalXp: s.account.totalXp, bestStreak: s.account.bestStreak, sessions: s.account.sessions, rounds: s.account.rounds }
        : { totalXp: s.totalXp, bestStreak: s.bestStreak, sessions: s.sessions, rounds: s.rounds },
    ),
  );
}

/** Rounds sorted best first: accuracy, then marks, then faster time. */
export function rankRounds(rounds: readonly Round[]): Round[] {
  return [...rounds].sort((a, b) => b.accuracy - a.accuracy || b.marks - a.marks || a.timeMs - b.timeMs);
}
