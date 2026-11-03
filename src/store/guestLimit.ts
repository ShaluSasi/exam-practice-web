/**
 * Guests play one round free, then sign in (also free) to keep practising.
 *
 * - The allowance is one round's worth of questions on this device, counted
 *   across chapters, so switching chapters doesn't reset it.
 * - It is checked when a new round starts, never in the middle of one, and a
 *   round already started can always be finished.
 * - The server also caps the new rounds guests draw from one network each day
 *   (worker/questions.ts), so clearing the browser's data or opening a private
 *   window doesn't give endless free rounds.
 * - Games: a guest opens them FREE_GAMES times, then signs in too.
 * - Challenge links and shared game links stay open to everyone: they are how
 *   friends find the app.
 * - When sign-in isn't available (not configured), nobody is stopped. When the
 *   sign-in check failed (a bad connection), it is asked again before deciding.
 */
import { create } from "zustand";
import { ROUND_SIZE } from "../engine/scoring";
import type { GameId } from "./games";
import { useAuth } from "./auth";
import { useNav } from "./nav";
import { useProfile } from "./profile";
import { useSession } from "./session";

export const FREE_QUESTIONS = ROUND_SIZE;
/** Times a guest may open a game from the home screen. */
export const FREE_GAMES = 3;
/** The server's answer to a guest round past its daily cap. */
export const GUEST_LIMIT = 401;

export type GateReason = "round" | "game";

/** The sign-in sheet (SignInGate in App.tsx): `retry` runs once the guest has signed in. */
export const useSignInGate = create<{ reason: GateReason; retry: (() => void) | null }>()(() => ({ reason: "round", retry: null }));

export function askSignIn(reason: GateReason, retry: () => void) {
  useSignInGate.setState({ reason, retry });
}

export function closeSignInGate() {
  useSignInGate.setState({ retry: null });
}

/** Whether this guest has used the free round. Rounds finished before this rule existed count too. */
export function freeRoundUsed(): boolean {
  const p = useProfile.getState();
  return p.guestAnswered >= FREE_QUESTIONS || p.sessions > 0;
}

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
  if (!freeRoundUsed()) return false;
  await settledAuth();
  return useAuth.getState().status === "signedOut";
}

/** Opens a game from the home screen; a guest past the free games is asked to sign in first. */
export async function openGame(id: GameId): Promise<void> {
  const play = () => useNav.getState().playGame(id);
  const p = useProfile.getState();
  if (p.guestGames >= FREE_GAMES) {
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
