import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemePref = "system" | "light" | "dark";

interface ProfileState {
  totalXp: number;
  bestStreak: number;
  sessions: number;
  soundOn: boolean;
  theme: ThemePref;
  recordSession: (xp: number, bestStreak: number) => void;
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
      soundOn: true,
      theme: "system",
      recordSession: (xp, streak) =>
        set((s) => ({
          totalXp: s.totalXp + xp,
          bestStreak: Math.max(s.bestStreak, streak),
          sessions: s.sessions + 1,
        })),
      toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "prepquest-profile", storage: createJSONStorage(() => localStorage) },
  ),
);
