/**
 * Keeps signed-in scores on the server.
 *
 * - Guests: rounds stay on this device only (as before).
 * - Signed in: each round shows straight away, is queued in `pending`, and is
 *   sent to the server; failed sends are retried on the next round, sign-in,
 *   reload, or when the device comes back online.
 * - First sign-in of an account: the device's guest progress is copied in
 *   once. A device copies its progress into one account only.
 */
import { serialized } from "../lib/serial";
import { ApiError, api, markSignedOut, useAuth, type User } from "./auth";
import { addRound, useProfile, type AccountStats, type Round, type RoundAnswers, type Stats } from "./profile";

interface Summary {
  totalXp: number;
  sessions: number;
  bestStreak: number;
  recent: Round[];
  bests: Round[];
}

const BATCH = 50;
const IMPORT_LIMIT = 100;

function toAccount(userId: string, s: Summary): AccountStats {
  const byId = new Map<string, Round>();
  for (const r of [...s.recent, ...s.bests]) byId.set(r.id, r);
  let stats: Stats = {
    totalXp: s.totalXp,
    bestStreak: s.bestStreak,
    sessions: s.sessions,
    rounds: [...byId.values()].sort((a, b) => b.at - a.at),
  };
  // Rounds not yet saved still count on screen.
  for (const p of useProfile.getState().pending) {
    if (p.userId === userId && !byId.has(p.round.id)) stats = addRound(stats, p.round, p.round.streak ?? 0);
  }
  return { userId, ...stats };
}

/** Shows a server summary, unless someone else has signed in meanwhile. */
function apply(userId: string, s: Summary) {
  if (useAuth.getState().user?.id === userId) useProfile.getState().setAccount(toAccount(userId, s));
}

function handleError(e: unknown) {
  if (e instanceof ApiError && e.status === 401) markSignedOut();
  // Anything else (offline, server error): rounds stay queued and are retried later.
}

async function sendPending(userId: string): Promise<void> {
  for (;;) {
    const batch = useProfile
      .getState()
      .pending.filter((p) => p.userId === userId)
      .slice(0, BATCH);
    if (batch.length === 0) return;
    const ids = batch.map((p) => p.round.id);
    try {
      // The server grades each round from its answers; the numbers in `round` are only shown until then.
      const summary = await api<Summary>("/api/scores/rounds", { rounds: batch.map((p) => ({ ...p.round, ...p.answers })) });
      useProfile.getState().removePending(ids);
      apply(userId, summary);
    } catch (e) {
      // The server will never accept these (bad data): drop them instead of retrying forever.
      if (e instanceof ApiError && e.status === 400) useProfile.getState().removePending(ids);
      else throw e;
    }
  }
}

/** Sends this user's queued rounds to the server, one send at a time. */
const flush = serialized(sendPending);

async function load(user: User, canImport: boolean) {
  const profile = useProfile.getState();
  if (profile.account && profile.account.userId !== user.id) profile.setAccount(null);
  try {
    if (canImport) {
      // Always called on an account's first sign-in, so it counts as "first" even with nothing to copy.
      const ownProgress = profile.importedTo === null && profile.sessions > 0;
      const res = await api<Summary & { imported: boolean }>(
        "/api/scores/import",
        ownProgress
          ? {
              totalXp: profile.totalXp,
              bestStreak: profile.bestStreak,
              sessions: profile.sessions,
              rounds: profile.rounds.slice(0, IMPORT_LIMIT),
            }
          : { totalXp: 0, bestStreak: 0, sessions: 0, rounds: [] },
      );
      if (res.imported && ownProgress) useProfile.getState().setImportedTo(user.id);
      useAuth.setState({ canImport: false });
      apply(user.id, res);
    }
    await flush(user.id);
    apply(user.id, await api<Summary>("/api/scores"));
  } catch (e) {
    handleError(e);
  }
}

/** Waits until the signed-in student's finished rounds are on the server (e.g. before sharing one). */
export function flushScores(): Promise<void> {
  const user = useAuth.getState().user;
  return user ? flush(user.id) : Promise.resolve();
}

/** Saves a finished round: on the server when signed in, on this device otherwise. */
export function recordRound(round: Round, bestStreak: number, answers: RoundAnswers) {
  const user = useAuth.getState().user;
  if (!user) {
    useProfile.getState().recordSession(round, bestStreak);
    return;
  }
  useProfile.getState().recordAccountRound(user.id, { ...round, streak: bestStreak }, answers);
  flush(user.id).catch(handleError);
}

/** Starts syncing; call once when the app mounts. Returns a cleanup function. */
export function startScoreSync(): () => void {
  let lastUserId: string | null | undefined;
  const onAuth = (s: ReturnType<typeof useAuth.getState>) => {
    if (s.status === "loading") return;
    const id = s.user?.id ?? null;
    if (id === lastUserId) return;
    lastUserId = id;
    if (s.user) void load(s.user, s.canImport);
    else useProfile.getState().setAccount(null);
  };
  const unsubscribe = useAuth.subscribe(onAuth);
  onAuth(useAuth.getState());

  const retry = () => {
    const user = useAuth.getState().user;
    if (user) flush(user.id).catch(handleError);
  };
  window.addEventListener("online", retry);
  return () => {
    unsubscribe();
    window.removeEventListener("online", retry);
  };
}
