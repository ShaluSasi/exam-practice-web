/**
 * Keeps a signed-in player's Galaxy Guardian progress (stardust, upgrades,
 * lasers, badges, lifetime totals, missions, best levels) on their account
 * (worker/games.ts, game_state), so it follows them to every device and admins
 * can see it.
 *
 * - On sign-in the account's saved progress is loaded and shown. An account
 *   with none yet takes this device's guest progress (as scores do on first
 *   sign-in); another account's progress left on the device is never copied.
 * - Changes made while signed in are saved a moment later; a failed save is
 *   retried on the next change, sign-in or when the connection comes back.
 * - Signing out leaves a fresh game for the next guest on this device.
 */
import { serialized } from "../../lib/serial";
import { ApiError, api, markSignedOut, useAuth } from "../../store/auth";
import { freshGalaxy, savedPart, useGalaxy, type SavedGalaxy } from "./progress";

const GAME = "galaxy";
const SAVE_DELAY_MS = 1500;

/** Bumped on every change, so a save that finishes after a newer change doesn't mark it saved. */
let version = 0;
/** Set while the account's progress is being put on screen: that is not a change to save. */
let applying = false;
let timer = 0;

const SAVED_KEYS = Object.keys(freshGalaxy()) as (keyof SavedGalaxy)[];

function apply(patch: Partial<ReturnType<typeof useGalaxy.getState>>) {
  applying = true;
  try {
    useGalaxy.setState(patch);
  } finally {
    applying = false;
  }
}

function handleError(e: unknown) {
  if (e instanceof ApiError && e.status === 401) markSignedOut();
  // Anything else (offline, server error): it stays unsaved and is tried again later.
}

const save = serialized(async (userId: string) => {
  const s = useGalaxy.getState();
  if (s.owner !== userId || !s.dirty || useAuth.getState().user?.id !== userId) return;
  const sent = version;
  await api("/api/games/state", { game: GAME, state: savedPart(s) });
  if (version === sent && useGalaxy.getState().owner === userId) apply({ dirty: false });
});

function saveSoon(userId: string) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => save(userId).catch(handleError), SAVE_DELAY_MS);
}

/** Shows the account's saved progress, or gives the account this device's guest progress if it has none. */
async function load(userId: string) {
  const { state } = await api<{ state: SavedGalaxy | null }>(`/api/games/state?game=${GAME}`);
  if (useAuth.getState().user?.id !== userId) return;
  const local = useGalaxy.getState();
  if (local.owner === userId && local.dirty) {
    // Played here while signed in and not saved yet (e.g. offline): this device is ahead of the account.
    await save(userId);
  } else if (state) {
    apply({ ...freshGalaxy(), ...state, owner: userId, dirty: false });
  } else if (local.owner === null || local.owner === userId) {
    apply({ owner: userId, dirty: true });
    version++;
    await save(userId);
  } else {
    apply({ ...freshGalaxy(), owner: userId, dirty: false });
  }
}

/** Starts syncing; call once when the app mounts. Returns a cleanup function. */
export function startGalaxySync(): () => void {
  let lastUser: string | null | undefined;
  const onAuth = (a: ReturnType<typeof useAuth.getState>) => {
    if (a.status === "signedIn" && a.user && a.user.id !== lastUser) {
      lastUser = a.user.id;
      load(a.user.id).catch(handleError);
    } else if (a.status === "signedOut" && lastUser !== null) {
      lastUser = null;
      window.clearTimeout(timer);
      if (useGalaxy.getState().owner !== null) apply({ ...freshGalaxy(), owner: null, dirty: false });
    }
  };
  const stopAuth = useAuth.subscribe(onAuth);
  onAuth(useAuth.getState());

  const stopChanges = useGalaxy.subscribe((s, prev) => {
    if (applying || !SAVED_KEYS.some((k) => s[k] !== prev[k])) return;
    version++;
    const userId = useAuth.getState().user?.id;
    if (!userId || s.owner !== userId) return;
    if (!s.dirty) apply({ dirty: true });
    saveSoon(userId);
  });

  const retry = () => {
    const userId = useAuth.getState().user?.id;
    if (userId && useGalaxy.getState().dirty) save(userId).catch(handleError);
  };
  window.addEventListener("online", retry);
  return () => {
    stopAuth();
    stopChanges();
    window.removeEventListener("online", retry);
    window.clearTimeout(timer);
  };
}
