import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
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
}

const MAX_ROUNDS = 30;

interface ProfileState {
  totalXp: number;
  bestStreak: number;
  sessions: number;
  rounds: Round[];
  soundOn: boolean;
  theme: ThemePref;
  /** Subject tab last opened on the home screen. */
  lastSubject: SubjectId | null;
  setLastSubject: (s: SubjectId) => void;
  recordSession: (round: Round, bestStreak: number) => void;
  toggleSound: () => void;
  setTheme: (t: ThemePref) => void;
}

/** Per-device profile. Moves to the API (D1) once accounts exist. */
export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      totalXp: 0,
      bestStreak: 0,
      sessions: 0,
      rounds: [],
      soundOn: true,
      theme: "system",
      lastSubject: null,
      setLastSubject: (lastSubject) => set({ lastSubject }),
      recordSession: (round, streak) =>
        set((s) => ({
          totalXp: s.totalXp + round.xp,
          bestStreak: Math.max(s.bestStreak, streak),
          sessions: s.sessions + 1,
          rounds: [round, ...s.rounds].slice(0, MAX_ROUNDS),
        })),
      toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "prepquest-profile", storage: createJSONStorage(() => localStorage) },
  ),
);

/** Rounds sorted best first: accuracy, then marks, then faster time. */
export function rankRounds(rounds: readonly Round[]): Round[] {
  return [...rounds].sort((a, b) => b.accuracy - a.accuracy || b.marks - a.marks || a.timeMs - b.timeMs);
}
