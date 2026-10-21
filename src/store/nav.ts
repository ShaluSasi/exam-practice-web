import { create } from "zustand";
import { SITE_ORIGIN } from "../lib/platform";
import type { GameId } from "./games";

export type Screen = "home" | "practice" | "results" | "board" | "challenge" | "game";

/** Who the student is playing against, when they accepted a friend's challenge link. */
export interface Opponent {
  code: string;
  name: string;
  accuracy: number;
  marks: number;
  maxMarks: number;
  timeMs: number;
}

interface NavState {
  screen: Screen;
  /** Share code from a /s/<code> link this visit started on. */
  challengeCode: string | null;
  opponent: Opponent | null;
  /** Game open on the "game" screen. */
  game: GameId | null;
  /** Game mode from a shared /games/<id>?mode=<mode> link, e.g. a Galaxy Guardian mission. */
  gameMode: string | null;
  /** Show the full landing page on home, even for returning students (set by the logo). */
  landing: boolean;
  go: (screen: Screen) => void;
  /** Opens the landing page at the top. */
  goLanding: () => void;
  setOpponent: (o: Opponent | null) => void;
  playGame: (id: GameId) => void;
}

const GAME_IDS: GameId[] = ["galaxy", "rush", "balance", "facts"];

const fromLink = /^\/s\/([A-Za-z0-9]{8})\/?$/.exec(window.location.pathname)?.[1] ?? null;
const gameLink = /^\/games\/([a-z]+)\/?$/.exec(window.location.pathname)?.[1] as GameId | undefined;
const linkedGame = gameLink && GAME_IDS.includes(gameLink) ? gameLink : null;

/** The game's own address, so the address bar can be copied and shared. */
export function gameUrl(id: GameId, mode?: string | null): string {
  return `${SITE_ORIGIN}/games/${id}${mode ? `?mode=${encodeURIComponent(mode)}` : ""}`;
}

/** Keeps the address bar on the open game (and mode), without adding history entries. */
export function showGameUrl(id: GameId, mode?: string | null) {
  const url = new URL(gameUrl(id, mode));
  if (window.location.pathname + window.location.search !== url.pathname + url.search) {
    window.history.replaceState(null, "", url.pathname + url.search);
  }
}

export const useNav = create<NavState>()((set) => ({
  screen: fromLink ? "challenge" : linkedGame ? "game" : "home",
  challengeCode: fromLink,
  opponent: null,
  game: linkedGame,
  gameMode: linkedGame ? new URLSearchParams(window.location.search).get("mode") : null,
  landing: false,
  go: (screen) => {
    if (screen !== "game" && window.location.pathname.startsWith("/games/")) window.history.replaceState(null, "", "/");
    set({ screen, landing: false });
    window.scrollTo({ top: 0 });
  },
  goLanding: () => {
    set({ screen: "home", landing: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  },
  setOpponent: (opponent) => set({ opponent }),
  playGame: (game) => {
    showGameUrl(game);
    set({ screen: "game", game, gameMode: null });
    window.scrollTo({ top: 0 });
  },
}));
