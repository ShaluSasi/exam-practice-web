/**
 * Guests practise free for a while, then sign in (also free) to keep practising.
 * The limits are the Worker's settings (wrangler.jsonc), sent in /api/config; -1 means unlimited.
 *
 * - The allowance is a number of questions on this device, counted across
 *   chapters, so switching chapters doesn't reset it.
 * - It is checked when a new round starts, never in the middle of one, and a
 *   round already started can always be finished.
 * - The server also caps the new rounds guests draw from one network each day
 *   (worker/questions.ts), so clearing the browser's data or opening a private
 *   window doesn't give endless free rounds.
 * - Games: a guest opens them a limited number of times, then signs in too.
 * - Challenge links and shared game links stay open to everyone: they are how
 *   friends find the app.
 * - When sign-in isn't available (not configured), nobody is stopped. When the
 *   sign-in check failed (a bad connection), it is asked again before deciding.
 */
import { create } from "zustand";
import type { AppConfig } from "../content/api";
import { GUEST_LIMITS, ROUND_SIZE } from "../engine/scoring";
import type { GameId } from "./games";
import { useAuth } from "./auth";
import { useNav } from "./nav";
import { useProfile } from "./profile";
import { useSession } from "./session";

/** The server's answer to a guest round past its daily cap. */
export const GUEST_LIMIT = 401;

/** Questions and game opens a guest gets; the defaults until the server has said, or if it can't be reached. */
let limits: AppConfig["guest"] = GUEST_LIMITS;
let limitsSettled: () => void;
const limitsReady = new Promise<void>((resolve) => {
  limitsSettled = resolve;
});

/** Called with the server's limits at start-up, or with nothing if it could not be reached. */
export function settleGuestLimits(fromServer?: AppConfig["guest"]) {
  if (fromServer) limits = fromServer;
  limitsSettled();
}

export type GateReason = "round" | "game";

/** The sign-in sheet (SignInGate in App.tsx): `retry` runs once the guest has signed in. */
export const useSignInGate = create<{ reason: GateReason; retry: (() => void) | null }>()(() => ({ reason: "round", retry: null }));

export function askSignIn(reason: GateReason, retry: () => void) {
  useSignInGate.setState({ reason, retry });
}

export function closeSignInGate() {
  useSignInGate.setState({ retry: null });
}

/** Whether this guest has used the free questions. A device that finished rounds before answers were counted has used a round's worth. */
export function freeRoundUsed(): boolean {
  const p = useProfile.getState();
  const answered = p.guestAnswered || (p.sessions > 0 ? ROUND_SIZE : 0);
  return limits.questions >= 0 && answered >= limits.questions;
}

/** How long a new round waits for the server's limits before using the defaults, so a slow connection does not hold up Start. */
const LIMITS_WAIT_MS = 1500;
const limitsOrDefaults = () => Promise.race([limitsReady, new Promise<void>((resolve) => setTimeout(resolve, LIMITS_WAIT_MS))]);

/**
 * Whether the sign-in check is settled. Still loading, or failed on a bad
 * connection ("unavailable"), it is asked again, so a guest isn't let through
 * just because the first check didn't get an answer.
 */
async function settledAuth(): Promise<void> {
  const { status, init } = useAuth.getState();
  if (status === "loading" || status === "unavailable") await init();
}

/** Whether a new round must wait for sign-in. */
export async function mustSignIn(): Promise<boolean> {
  await limitsOrDefaults();
  if (!freeRoundUsed()) return false;
  await settledAuth();
  return useAuth.getState().status === "signedOut";
}

/** Opens a game from the home screen; a guest past the free games is asked to sign in first. */
export async function openGame(id: GameId): Promise<void> {
  const play = () => useNav.getState().playGame(id);
  await limitsOrDefaults();
  const p = useProfile.getState();
  if (limits.games >= 0 && p.guestGames >= limits.games) {
    await settledAuth();
    if (useAuth.getState().status === "signedOut") return askSignIn("game", play);
  }
  if (!useAuth.getState().user) p.countGuestGame();
  play();
}

/** Counts every answer given without an account. Call once on mount; returns cleanup. */
export function startGuestCount(): () => void {
  return useSession.subscribe((s, prev) => {
    if (s.roundId === prev.roundId && s.attempts.length > prev.attempts.length && !useAuth.getState().user) {
      useProfile.getState().countGuestAnswer();
    }
  });
}
