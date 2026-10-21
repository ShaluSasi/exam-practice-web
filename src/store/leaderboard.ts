import { create } from "zustand";
import { ApiError, api, markSignedOut, useAuth } from "./auth";
import { flushScores } from "./scoreSync";

export type Period = "week" | "month" | "all";

/** Mirrors worker/leaderboard.ts. Only "global" is enabled on the server today. */
export type ScopeKind = "global" | "grade" | "group" | "quiz";

export interface Entry {
  pid: string;
  name: string;
  xp: number;
  rounds: number;
  accuracy: number;
  bestStreak: number;
  rank: number;
  isMe: boolean;
}

export interface Board {
  period: Period;
  participants: number;
  top: Entry[];
  around: Entry[];
  me: Entry | null;
}

interface Loaded {
  board: Board;
  /** Places gained (+) or lost (-) since this device last showed this board. */
  moved: number;
  at: number;
}

interface LeaderboardState {
  boards: Partial<Record<string, Loaded>>;
  loading: Partial<Record<string, boolean>>;
  error: string | null;
  load: (period: Period, scope?: ScopeKind) => Promise<void>;
}

const FRESH_MS = 30_000;
const boardId = (scope: ScopeKind, period: Period) => `${scope}:${period}`;

function lastRankKey(userId: string, id: string) {
  return `prepquest-rank:${userId}:${id}`;
}

/** Compares with the rank shown last time, then remembers the new one. */
function movement(userId: string, id: string, rank: number | undefined): number {
  if (rank === undefined) return 0;
  try {
    const key = lastRankKey(userId, id);
    const before = Number(localStorage.getItem(key)) || 0;
    localStorage.setItem(key, String(rank));
    return before ? before - rank : 0;
  } catch {
    return 0;
  }
}

export const useLeaderboard = create<LeaderboardState>()((set, get) => ({
  boards: {},
  loading: {},
  error: null,
  load: async (period, scope = "global") => {
    const id = boardId(scope, period);
    const cached = get().boards[id];
    if (get().loading[id] || (cached && Date.now() - cached.at < FRESH_MS)) return;
    set((s) => ({ loading: { ...s.loading, [id]: true }, error: null }));
    try {
      // A just-finished round may still be on its way to the server.
      await flushScores().catch(() => undefined);
      const board = await api<Board>(`/api/leaderboard?period=${period}&scope=${scope}`);
      const userId = useAuth.getState().user?.id ?? "";
      set((s) => ({ boards: { ...s.boards, [id]: { board, moved: movement(userId, id, board.me?.rank), at: Date.now() } } }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) markSignedOut();
      set({ error: "Couldn't load the leaderboard. Check your connection and try again." });
    } finally {
      set((s) => ({ loading: { ...s.loading, [id]: false } }));
    }
  },
}));

export function useBoard(period: Period, scope: ScopeKind = "global") {
  const id = boardId(scope, period);
  return {
    loaded: useLeaderboard((s) => s.boards[id]),
    loading: useLeaderboard((s) => !!s.loading[id]),
  };
}

/** Forget cached boards (e.g. after finishing a round, so the new XP shows). */
export function invalidateBoards() {
  useLeaderboard.setState({ boards: {} });
}
