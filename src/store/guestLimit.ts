/**
 * Guests play one round free, then sign in (also free) to keep practising.
 *
 * - The allowance is one round's worth of questions on this device, counted
 *   across chapters, so switching chapters doesn't reset it.
 * - It is checked when a new round starts, never in the middle of one, and a
 *   round already started can always be finished.
 * - Challenge links and the games stay open to everyone.
 * - When sign-in isn't available (not configured, or the server can't be
 *   reached), nobody is stopped.
 */
import { ROUND_SIZE } from "../engine/scoring";
import { useAuth } from "./auth";
import { useProfile } from "./profile";
import { useSession } from "./session";

export const FREE_QUESTIONS = ROUND_SIZE;

/** Whether this guest has used the free round. Rounds finished before this rule existed count too. */
export function freeRoundUsed(): boolean {
  const p = useProfile.getState();
  return p.guestAnswered >= FREE_QUESTIONS || p.sessions > 0;
}

/** Whether a new round must wait for sign-in. */
export function mustSignIn(): boolean {
  return useAuth.getState().status === "signedOut" && freeRoundUsed();
}

/** Counts every answer given without an account. Call once on mount; returns cleanup. */
export function startGuestCount(): () => void {
  return useSession.subscribe((s, prev) => {
    if (s.roundId === prev.roundId && s.attempts.length > prev.attempts.length && !useAuth.getState().user) {
      useProfile.getState().countGuestAnswer();
    }
  });
}
