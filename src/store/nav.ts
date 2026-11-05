import { create } from "zustand";
import { App as NativeApp } from "@capacitor/app";
import { SITE_ORIGIN, isNative } from "../lib/platform";
import type { GameId } from "./games";
import { useSession } from "./session";

export type Screen = "home" | "practice" | "results" | "board" | "challenge" | "game" | "gamelist" | "progress" | "admin" | "difficulty" | "sequence" | "reports" | "preview" | "myreports" | "quizzes" | "quizadmin";

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
  /** Opens the game list from a round, which waits: Back returns to it as it was. */
  openGameList: () => void;
}

/**
 * What one browser history entry shows, so the browser's (and the phone's) back
 * button steps back through the app's screens instead of leaving the site.
 */
interface Entry {
  screen: Screen;
  game: GameId | null;
  gameMode: string | null;
  /** Entries the app added before this one; 0 is the page the visit started on. */
  depth: number;
}

const GAME_IDS: GameId[] = ["galaxy", "rush", "match", "balance", "facts", "elements"];

const fromLink = /^\/s\/([A-Za-z0-9]{8})\/?$/.exec(window.location.pathname)?.[1] ?? null;
const gameLink = /^\/games\/([a-z]+)\/?$/.exec(window.location.pathname)?.[1] as GameId | undefined;
const linkedGame = gameLink && GAME_IDS.includes(gameLink) ? gameLink : null;
const progressLink = /^\/progress\/?$/.test(window.location.pathname);
const adminLink = /^\/admin\/?$/.test(window.location.pathname);
const difficultyLink = /^\/admin\/difficulty\/?$/.test(window.location.pathname);
const sequenceLink = /^\/admin\/sequence\/?$/.test(window.location.pathname);
const reportsLink = /^\/admin\/reports\/?$/.test(window.location.pathname);
const myReportsLink = /^\/my-reported-questions\/?$/.test(window.location.pathname);
/** Question ID from a /admin/preview/<id> link, opened in its own window from the reports page. A malformed address is no ID. */
export const previewQuestionId = (() => {
  try {
    return decodeURIComponent(/^\/admin\/preview\/([^/]+)\/?$/.exec(window.location.pathname)?.[1] ?? "");
  } catch {
    return "";
  }
})();
const quizLink = /^\/quiz(?:\/([A-Za-z0-9-]{1,100}))?\/?$/.exec(window.location.pathname);
const quizzesLink = !!quizLink;
/** Quiz ID from a shared /quiz/<id> link this visit started on, until the quiz page has opened it. */
let linkedQuiz: string | null = quizLink?.[1] ?? null;
export function takeLinkedQuiz(): string | null {
  const id = linkedQuiz;
  linkedQuiz = null;
  return id;
}

/** Opens one quiz's page (its lobby, or the student's result from there). */
export function openQuiz(id: string) {
  linkedQuiz = id;
  useNav.getState().go("quizzes");
}

/** The address students are sent to join a quiz. */
export const quizUrl = (id: string) => `${SITE_ORIGIN}/quiz/${id}`;
const quizAdminLink = /^\/admin\/quizzes\/?$/.test(window.location.pathname);

/** The game's own address, so the address bar can be copied and shared. */
export function gameUrl(id: GameId, mode?: string | null): string {
  return `${SITE_ORIGIN}/games/${id}${mode ? `?mode=${encodeURIComponent(mode)}` : ""}`;
}

function pathOf(entry: Omit<Entry, "depth">): string {
  if (entry.screen === "progress") return "/progress";
  if (entry.screen === "admin") return "/admin";
  if (entry.screen === "difficulty") return "/admin/difficulty";
  if (entry.screen === "sequence") return "/admin/sequence";
  if (entry.screen === "reports") return "/admin/reports";
  if (entry.screen === "myreports") return "/my-reported-questions";
  if (entry.screen === "quizzes") return "/quiz";
  if (entry.screen === "quizadmin") return "/admin/quizzes";
  if (entry.screen !== "game" || !entry.game) return "/";
  const url = new URL(gameUrl(entry.game, entry.gameMode));
  return url.pathname + url.search;
}

function currentEntry(): Entry | null {
  const s = window.history.state as Partial<Entry> | null;
  return s && typeof s.screen === "string" && typeof s.depth === "number" ? (s as Entry) : null;
}

const depthNow = () => currentEntry()?.depth ?? 0;

/** Keeps the address bar on the open game (and mode), without adding history entries. */
export function showGameUrl(id: GameId, mode?: string | null) {
  const entry: Entry = { screen: "game", game: id, gameMode: mode ?? null, depth: depthNow() };
  const path = pathOf(entry);
  if (window.location.pathname + window.location.search !== path) window.history.replaceState(entry, "", path);
}

/** Set while stepping back to the visit's first entry, which then becomes home. */
let returningHome = false;

/** Goes back to the visit's first history entry and shows home there, so Back from home leaves the site. */
function returnHome() {
  const depth = depthNow();
  const home: Entry = { screen: "home", game: null, gameMode: null, depth: 0 };
  if (depth > 0) {
    returningHome = true;
    window.history.go(-depth);
  } else {
    window.history.replaceState(home, "", "/");
  }
}

export const useNav = create<NavState>()((set, get) => ({
  screen: fromLink ? "challenge" : linkedGame ? "game" : progressLink ? "progress" : adminLink ? "admin" : difficultyLink ? "difficulty" : sequenceLink ? "sequence" : reportsLink ? "reports" : previewQuestionId ? "preview" : myReportsLink ? "myreports" : quizzesLink ? "quizzes" : quizAdminLink ? "quizadmin" : "home",
  challengeCode: fromLink,
  opponent: null,
  game: linkedGame,
  gameMode: linkedGame ? new URLSearchParams(window.location.search).get("mode") : null,
  landing: false,
  go: (screen) => {
    if (screen === "home") {
      returnHome();
    } else {
      const from = get().screen;
      const entry: Entry = { screen, game: null, gameMode: null, depth: depthNow() };
      // A round that was left, or a result whose round was replaced by a new one, is not returned to.
      if (from === "practice" || (from === "results" && screen === "practice")) {
        window.history.replaceState(entry, "", "/");
      } else {
        window.history.pushState({ ...entry, depth: entry.depth + 1 }, "", pathOf(entry));
      }
    }
    set({ screen, landing: false });
    window.scrollTo({ top: 0 });
  },
  goLanding: () => {
    returnHome();
    set({ screen: "home", landing: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  },
  setOpponent: (opponent) => set({ opponent }),
  playGame: (game) => {
    const entry: Entry = { screen: "game", game, gameMode: null, depth: depthNow() + 1 };
    window.history.pushState(entry, "", pathOf(entry));
    set({ screen: "game", game, gameMode: null });
    window.scrollTo({ top: 0 });
  },
  openGameList: () => {
    useSession.getState().pauseClock();
    const entry: Entry = { screen: "gamelist", game: null, gameMode: null, depth: depthNow() + 1 };
    window.history.pushState(entry, "", pathOf(entry));
    set({ screen: "gamelist", game: null, gameMode: null });
    window.scrollTo({ top: 0 });
  },
}));

/** Turns the current history entry into home, e.g. once a challenge link has been used. */
export function forgetLink() {
  const entry: Entry = { screen: "home", game: null, gameMode: null, depth: depthNow() };
  window.history.replaceState(entry, "", "/");
}

// The first entry shows what the address asked for. After a reload, it keeps its place in the history.
{
  const { screen, game, gameMode } = useNav.getState();
  const entry: Entry = { screen, game, gameMode, depth: depthNow() };
  window.history.replaceState(entry, "", window.location.pathname + window.location.search);
  // Screens open at the top; the browser must not scroll them to where an earlier visit was.
  window.history.scrollRestoration = "manual";
}

window.addEventListener("popstate", () => {
  const entry = currentEntry() ?? { screen: "home", game: null, gameMode: null, depth: 0 };
  if (returningHome) {
    returningHome = false;
    // Home is already showing; only the entry still needs to say so.
    window.history.replaceState({ ...entry, screen: "home", game: null, gameMode: null }, "", "/");
    return;
  }
  let { screen } = entry;
  const { questions, finishedAt } = useSession.getState();
  // A round can't be stepped back into once it is over (it would be recorded again), nor a result without one.
  if ((screen === "practice" || screen === "gamelist") && (finishedAt || questions.length === 0)) screen = "home";
  if (screen === "practice") useSession.getState().resumeClock();
  if (screen === "results" && !finishedAt) screen = "home";
  // A challenge link is only shown until it has been used.
  if (screen === "challenge" && !useNav.getState().challengeCode) screen = "home";
  if (screen !== entry.screen) window.history.replaceState({ ...entry, screen, game: null, gameMode: null }, "", "/");
  useNav.setState({ screen, game: entry.game, gameMode: entry.gameMode, landing: false });
  window.scrollTo({ top: 0 });
});

// The phone's back button steps back through the app's screens; on the first one it closes the app.
if (isNative) {
  void NativeApp.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void NativeApp.exitApp();
  });
}
