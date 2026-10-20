import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type GameId = "galaxy" | "rush" | "balance" | "facts";

export interface GameRecord {
  best: number;
  plays: number;
  lastAt: number;
}

interface GamesState {
  records: Partial<Record<GameId, GameRecord>>;
  /** Best stars (1–3) per Balance It level, by equation id. */
  stars: Record<string, number>;
  /** Questions answered correctly across all games, shown as "problems solved". */
  solved: number;
  /** Local date (YYYY-MM-DD) a game was last played, and how many days in a row games were played. */
  lastDay: string | null;
  dayStreak: number;
  /** Saves a finished game. Returns true when the score beats the previous best. */
  finish: (id: GameId, score: number, correct: number) => boolean;
  /** Saves a solved Balance It level. Returns true when it earns more stars than before. */
  completeLevel: (levelId: string, stars: number) => boolean;
}

const dayKey = (d: Date) => d.toLocaleDateString("en-CA");

function nextStreak(lastDay: string | null, streak: number) {
  const now = new Date();
  if (lastDay === dayKey(now)) return streak;
  now.setDate(now.getDate() - 1);
  return lastDay === dayKey(now) ? streak + 1 : 1;
}

export const useGames = create<GamesState>()(
  persist(
    (set, get) => ({
      records: {},
      stars: {},
      solved: 0,
      lastDay: null,
      dayStreak: 0,
      finish: (id, score, correct) => {
        const s = get();
        const prev = s.records[id];
        const newBest = score > 0 && score > (prev?.best ?? 0);
        set({
          records: {
            ...s.records,
            [id]: { best: Math.max(score, prev?.best ?? 0), plays: (prev?.plays ?? 0) + 1, lastAt: Date.now() },
          },
          solved: s.solved + correct,
          dayStreak: nextStreak(s.lastDay, s.dayStreak),
          lastDay: dayKey(new Date()),
        });
        return newBest;
      },
      completeLevel: (levelId, stars) => {
        const s = get();
        const better = stars > (s.stars[levelId] ?? 0);
        const all = { ...s.stars, [levelId]: Math.max(stars, s.stars[levelId] ?? 0) };
        const total = Object.values(all).reduce((a, b) => a + b, 0);
        const prev = s.records.balance;
        set({
          stars: all,
          records: { ...s.records, balance: { best: total, plays: (prev?.plays ?? 0) + 1, lastAt: Date.now() } },
          solved: s.solved + 1,
          dayStreak: nextStreak(s.lastDay, s.dayStreak),
          lastDay: dayKey(new Date()),
        });
        return better;
      },
    }),
    { name: "prepquest-games", storage: createJSONStorage(() => localStorage) },
  ),
);

/** Days in a row with at least one game, or 0 once a day has been missed. */
export function useGameStreak(): number {
  return useGames((s) => {
    if (!s.lastDay) return 0;
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return s.lastDay === dayKey(new Date()) || s.lastDay === dayKey(y) ? s.dayStreak : 0;
  });
}
