/**
 * Unfinished rounds, saved after every answer so a chapter resumes where the
 * student left off.
 *
 * - Guests: kept on this device.
 * - Signed in: saved to the server (so it resumes on any device). Each save is
 *   queued in `unsent` first and retried if the network fails.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { serialized } from "../lib/serial";
import { ApiError, api, markSignedOut, useAuth } from "./auth";
import { useSession, type SavedRound } from "./session";

type Rounds = Record<string, SavedRound>;

interface Unsent {
  userId: string;
  key: string;
  /** Bumped on every change, so a send only clears the entry if nothing newer arrived meanwhile. */
  v: number;
  /** `final`: the round's last unsent save, sent before clearing so every answer is logged. */
  op: { save: SavedRound } | { clear: string; final?: SavedRound };
}

interface ProgressState {
  guest: Rounds;
  /** The signed-in student's unfinished rounds, as last loaded from the server plus unsent changes. */
  account: { userId: string; rounds: Rounds } | null;
  unsent: Record<string, Unsent>;
}

export const useProgress = create<ProgressState>()(
  persist((): ProgressState => ({ guest: {}, account: null, unsent: {} }), {
    name: "prepquest-progress",
    storage: createJSONStorage(() => localStorage),
  }),
);

const set = useProgress.setState;
const unsentId = (userId: string, key: string) => `${userId}\n${key}`;

/** The unfinished round for `key` (signed-in account or this device's guest), if any. */
export function getSavedRound(key: string): SavedRound | undefined {
  const s = useProgress.getState();
  return s.account ? s.account.rounds[key] : s.guest[key];
}

export function useSavedRound(key: string): SavedRound | undefined {
  return useProgress((s) => (s.account ? s.account.rounds[key] : s.guest[key]));
}

function queue(userId: string, key: string, op: Unsent["op"]) {
  const id = unsentId(userId, key);
  set((s) => ({ unsent: { ...s.unsent, [id]: { userId, key, op, v: (s.unsent[id]?.v ?? 0) + 1 } } }));
  push(userId).catch(handleError);
}

function save(round: SavedRound) {
  const user = useAuth.getState().user;
  if (!user) {
    set((s) => ({ guest: { ...s.guest, [round.key]: round } }));
    return;
  }
  set((s) => {
    const rounds = s.account?.userId === user.id ? s.account.rounds : {};
    return { account: { userId: user.id, rounds: { ...rounds, [round.key]: round } } };
  });
  queue(user.id, round.key, { save: round });
}

/** Forgets the unfinished round `roundId` of `key` (finished or started over). */
export function discardSavedRound(key: string, roundId: string) {
  const user = useAuth.getState().user;
  const without = (rounds: Rounds) => {
    if (rounds[key]?.roundId !== roundId) return rounds;
    const { [key]: _, ...rest } = rounds;
    return rest;
  };
  if (!user) {
    set((s) => ({ guest: without(s.guest) }));
    return;
  }
  set((s) => (s.account?.userId === user.id ? { account: { userId: user.id, rounds: without(s.account.rounds) } } : {}));
  const pending = useProgress.getState().unsent[unsentId(user.id, key)]?.op;
  const final = pending && "save" in pending && pending.save.roundId === roundId ? pending.save : undefined;
  queue(user.id, key, { clear: roundId, final });
}

function handleError(e: unknown) {
  if (e instanceof ApiError && e.status === 401) markSignedOut();
  // Offline or server error: the change stays in `unsent` and is retried later.
}

/** Set while an account's first sign-in copies this device's guest rounds in (store/scoreSync.ts). */
let hold: { userId: string; done: Promise<unknown> } | null = null;

/**
 * Makes this account's saves and loads wait for `done`, so a round started as
 * a guest reaches the server with its guest answers before anything else is
 * saved for it. Must be called before the sign-in reaches `startProgressSync`.
 */
export function holdProgressSync(userId: string, done: Promise<unknown>) {
  hold = { userId, done: done.catch(() => undefined) };
}

/** Unfinished rounds this device played as a guest, to copy into a new account. */
export function guestRounds(): SavedRound[] {
  return Object.values(useProgress.getState().guest);
}

/** Forgets guest rounds once they have been copied into an account. */
export function forgetGuestRounds(roundIds: string[]) {
  set((s) => ({ guest: Object.fromEntries(Object.entries(s.guest).filter(([, r]) => !roundIds.includes(r.roundId))) }));
}

/** Sends this user's queued changes, oldest key first, until none are left. */
const push = serialized(async (userId) => {
  if (hold?.userId === userId) await hold.done;
  for (;;) {
    const entry = Object.values(useProgress.getState().unsent).find((u) => u.userId === userId);
    if (!entry) return;
    try {
      if ("save" in entry.op) await api("/api/progress/save", entry.op.save);
      else {
        if (entry.op.final) await api("/api/progress/save", entry.op.final);
        await api("/api/progress/clear", { key: entry.key, roundId: entry.op.clear });
      }
    } catch (e) {
      // Rejected data will never be accepted: drop it instead of retrying forever.
      const rejected = e instanceof ApiError && (e.status === 400 || e.status === 413);
      if (!rejected) throw e;
    }
    const id = unsentId(userId, entry.key);
    set((s) => {
      if (s.unsent[id]?.v !== entry.v) return {};
      const { [id]: _, ...rest } = s.unsent;
      return { unsent: rest };
    });
  }
});

/** The load in progress (or last done) for the signed-in student, and whether it failed. */
let loading: { userId: string; done: Promise<void>; failed: boolean } | null = null;

/**
 * Resolves once the signed-in student's unfinished rounds are known, so a
 * chapter started on a new device continues the round from the other device
 * instead of starting over it. Resolves at once for guests or after a failed load.
 */
export function progressReady(): Promise<void> {
  const user = useAuth.getState().user;
  return user && loading?.userId === user.id ? loading.done : Promise.resolve();
}

function load(userId: string) {
  const entry = { userId, done: Promise.resolve(), failed: false };
  entry.done = loadRounds(userId).then(
    () => undefined,
    () => {
      entry.failed = true;
    },
  );
  loading = entry;
  return entry.done;
}

/** Loads the signed-in student's unfinished rounds, after sending anything still queued. */
async function loadRounds(userId: string) {
  if (useProgress.getState().account?.userId !== userId) set({ account: { userId, rounds: {} } });
  try {
    await push(userId);
    const { rounds } = await api<{ rounds: SavedRound[] }>("/api/progress");
    if (useAuth.getState().user?.id !== userId) return;
    const merged: Rounds = Object.fromEntries(rounds.map((r) => [r.key, r]));
    // Changes made since the push started win over what the server sent back.
    for (const u of Object.values(useProgress.getState().unsent)) {
      if (u.userId !== userId) continue;
      if ("save" in u.op) merged[u.key] = u.op.save;
      else if (merged[u.key]?.roundId === u.op.clear) delete merged[u.key];
    }
    set({ account: { userId, rounds: merged } });
  } catch (e) {
    handleError(e);
    throw e;
  }
}

function snapshot(s: ReturnType<typeof useSession.getState>): SavedRound {
  return {
    key: s.key!,
    roundId: s.roundId,
    title: s.title,
    questionIds: s.questions.map((q) => q.id),
    attempts: s.attempts,
    xp: s.xp,
    streak: s.streak,
    bestStreak: s.bestStreak,
    elapsedMs: Date.now() - s.startedAt,
    updatedAt: Date.now(),
  };
}

/** Saves after every answer and clears when a round finishes. Call once on mount; returns cleanup. */
export function startProgressSync(): () => void {
  const offSession = useSession.subscribe((s, prev) => {
    if (!s.key) return;
    if (s.finishedAt && !prev.finishedAt) discardSavedRound(s.key, s.roundId);
    // A new answer, or a skipped question answered later (which replaces its skip).
    else if (s.roundId === prev.roundId && s.attempts !== prev.attempts && s.attempts.length >= prev.attempts.length) save(snapshot(s));
  });

  let lastUserId: string | null | undefined;
  const onAuth = (s: ReturnType<typeof useAuth.getState>) => {
    if (s.status === "loading") return;
    const id = s.user?.id ?? null;
    if (id === lastUserId) return;
    lastUserId = id;
    if (id) void load(id);
    else set({ account: null });
  };
  const offAuth = useAuth.subscribe(onAuth);
  onAuth(useAuth.getState());

  const retry = () => {
    const user = useAuth.getState().user;
    if (!user) return;
    // A load that failed offline is repeated, not just the queued saves.
    if (loading?.userId === user.id && loading.failed) void load(user.id);
    else push(user.id).catch(handleError);
  };
  window.addEventListener("online", retry);
  return () => {
    offSession();
    offAuth();
    window.removeEventListener("online", retry);
  };
}
