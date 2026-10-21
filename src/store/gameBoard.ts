/**
 * Game scoreboards (worker/games.ts).
 *
 * Signed-in students' finished runs are queued in `pending` (kept on the
 * device) and sent to the server; failed sends are retried on the next run,
 * sign-in, reload or when the device comes back online. Guests' runs stay on
 * the device only.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { serialized } from "../lib/serial";
import { ApiError, api, markSignedOut, useAuth } from "./auth";
import type { Period } from "./leaderboard";

export interface GameRun {
  id: string;
  game: "galaxy";
  section: string;
  at: number;
  score: number;
  wave: number;
  level: number;
  correct: number;
  answered: number;
  bestCombo: number;
}

export interface GameEntry {
  pid: string;
  name: string;
  score: number;
  level: number;
  wave: number;
  runs: number;
  accuracy: number;
  sections: number;
  rank: number;
  isMe: boolean;
}

export interface GameBoard {
  section: string;
  period: Period;
  participants: number;
  top: GameEntry[];
  around: GameEntry[];
  me: GameEntry | null;
}

export interface MyRank {
  score: number;
  rank: number;
  participants: number;
}

export const OVERALL = "overall";
const FRESH_MS = 30_000;
const BATCH = 50;

interface Cached<T> {
  data: T;
  at: number;
}

interface GameBoardState {
  pending: { userId: string; run: GameRun }[];
  boards: Partial<Record<string, Cached<GameBoard>>>;
  ranks: Partial<Record<string, Cached<Record<string, MyRank>>>>;
  loading: Partial<Record<string, boolean>>;
  error: string | null;
}

export const useGameBoard = create<GameBoardState>()(
  persist(() => ({ pending: [], boards: {}, ranks: {}, loading: {}, error: null }) as GameBoardState, {
    name: "prepquest-game-scores",
    storage: createJSONStorage(() => localStorage),
    partialize: (s) => ({ pending: s.pending }),
  }),
);

const boardKey = (game: string, section: string, period: Period) => `${game}:${section}:${period}`;
const ranksKey = (game: string, period: Period) => `${game}:${period}`;

function handleError(e: unknown) {
  if (e instanceof ApiError && e.status === 401) markSignedOut();
}

async function sendPending(userId: string): Promise<void> {
  for (;;) {
    const batch = useGameBoard
      .getState()
      .pending.filter((p) => p.userId === userId)
      .slice(0, BATCH);
    if (batch.length === 0) return;
    const ids = new Set(batch.map((p) => p.run.id));
    const drop = () => useGameBoard.setState((s) => ({ pending: s.pending.filter((p) => !ids.has(p.run.id)) }));
    try {
      await api("/api/games/runs", { runs: batch.map((p) => p.run) });
      drop();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 400)) throw e;
      // The server will never accept bad data, so it is dropped rather than retried forever; but one
      // bad run must not take the whole batch with it, so the rest are sent singly. The rejection is
      // still reported, so the UI does not claim the run was saved.
      if (batch.length === 1) {
        drop();
        throw e;
      }
      let rejected: unknown = null;
      for (const p of batch) {
        try {
          await api("/api/games/runs", { runs: [p.run] });
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 400)) throw err;
          rejected = err;
        }
        useGameBoard.setState((s) => ({ pending: s.pending.filter((x) => x.run.id !== p.run.id) }));
      }
      if (rejected) throw rejected;
    }
  }
}

const flush = serialized(sendPending);

/** Forget cached boards, so new scores show. */
export function invalidateGameBoards() {
  useGameBoard.setState({ boards: {}, ranks: {} });
}

/**
 * Saves a finished run for the scoreboard. Resolves once it is on the server
 * (signed in), or straight away for guests. Never rejects.
 */
export async function submitGameRun(run: GameRun): Promise<boolean> {
  const user = useAuth.getState().user;
  if (!user) return false;
  useGameBoard.setState((s) => ({ pending: [...s.pending, { userId: user.id, run }] }));
  try {
    await flush(user.id);
    invalidateGameBoards();
    return true;
  } catch (e) {
    handleError(e);
    return false;
  }
}

/** Requests in flight, so a forced refresh waits for the current one instead of being dropped. */
const inflight = new Map<string, Promise<void>>();

async function load<T>(key: string, path: string, slot: "boards" | "ranks", force: boolean, pick: (data: unknown) => T) {
  const id = `${slot}:${key}`;
  const running = inflight.get(id);
  if (running) {
    if (!force) return;
    await running.catch(() => undefined);
  }
  const cached = useGameBoard.getState()[slot][key];
  if (!force && cached && Date.now() - cached.at < FRESH_MS) return;
  const run = fetchInto(id, key, path, slot, pick);
  inflight.set(id, run);
  try {
    await run;
  } finally {
    if (inflight.get(id) === run) inflight.delete(id);
  }
}

async function fetchInto<T>(id: string, key: string, path: string, slot: "boards" | "ranks", pick: (data: unknown) => T) {
  useGameBoard.setState((st) => ({ loading: { ...st.loading, [id]: true }, error: null }));
  try {
    const user = useAuth.getState().user;
    if (user) await flush(user.id).catch(() => undefined);
    const data = pick(await api<unknown>(path));
    useGameBoard.setState((st) => ({ [slot]: { ...st[slot], [key]: { data, at: Date.now() } } }));
  } catch (e) {
    handleError(e);
    useGameBoard.setState({ error: "Couldn't load the scoreboard. Check your connection and try again." });
  } finally {
    useGameBoard.setState((st) => ({ loading: { ...st.loading, [id]: false } }));
  }
}

export function loadGameBoard(game: string, section: string, period: Period, force = false) {
  return load(boardKey(game, section, period), `/api/games/board?game=${game}&section=${section}&period=${period}`, "boards", force, (d) => d as GameBoard);
}

export function loadGameRanks(game: string, period: Period, force = false) {
  return load(ranksKey(game, period), `/api/games/ranks?game=${game}&period=${period}`, "ranks", force, (d) => (d as { ranks: Record<string, MyRank> }).ranks);
}

export function useGameBoardData(game: string, section: string, period: Period) {
  const key = boardKey(game, section, period);
  return {
    board: useGameBoard((s) => s.boards[key]?.data),
    loading: useGameBoard((s) => !!s.loading[`boards:${key}`]),
  };
}

export function useMyGameRanks(game: string, period: Period) {
  return useGameBoard((s) => s.ranks[ranksKey(game, period)]?.data);
}

/** Starts sending queued runs; call once when the app mounts. Returns a cleanup function. */
export function startGameScoreSync(): () => void {
  const retry = () => {
    const user = useAuth.getState().user;
    if (user) flush(user.id).catch(handleError);
  };
  let last: string | null = null;
  const unsubscribe = useAuth.subscribe((s) => {
    const id = s.user?.id ?? null;
    if (id !== last) {
      last = id;
      invalidateGameBoards();
      retry();
    }
  });
  retry();
  window.addEventListener("online", retry);
  return () => {
    unsubscribe();
    window.removeEventListener("online", retry);
  };
}
