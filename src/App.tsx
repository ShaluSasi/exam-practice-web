import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { AppConfig } from "./content/api";
import { scoreSession } from "./engine/scoring";
import { APP_BUILD, isNative } from "./lib/platform";
import { useApplyTheme } from "./lib/theme";
import { ApiError, OFFLINE, api, useAuth } from "./store/auth";
import { useConnection } from "./store/connection";
import { SignInGate } from "./components/SignInPrompt";
import { mustSignIn, startGuestCount } from "./store/guestLimit";
import { fetchQuestions, fetchRound, useContent, type RoundSource } from "./store/content";
import { ADMIN_SCREENS, AdminScreen, useAdminGuard, useNotAdmin } from "./screens/AdminScreen";
import { ChallengeScreen } from "./screens/ChallengeScreen";
import { DifficultyScreen } from "./screens/DifficultyScreen";
import { QuizAdminScreen } from "./screens/QuizAdminScreen";
import { QuizScreen } from "./screens/QuizScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { SequenceScreen } from "./screens/SequenceScreen";
import { GameScreen } from "./screens/GameScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LeaderboardScreen } from "./screens/LeaderboardScreen";
import { PracticeScreen } from "./screens/PracticeScreen";
import { ProgressScreen } from "./screens/ProgressScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { LoadingScreen, OfflineScreen, UpdateScreen } from "./screens/StatusScreens";
import { startGameScoreSync } from "./store/gameBoard";
import { invalidateBoards } from "./store/leaderboard";
import { useNav } from "./store/nav";
import { discardSavedRound, getSavedRound, progressReady, startProgressSync } from "./store/progress";
import { useProfile } from "./store/profile";
import { recordRound, startScoreSync } from "./store/scoreSync";
import { useSession } from "./store/session";

const RELOADED_KEY = "prepquest-reloaded-for";
/** Longest round time the server accepts (worker/scores.ts). */
const MAX_ROUND_MS = 7 * 86_400_000;

/** Everything the app asks the server at start-up; repeated when the connection comes back. */
function startup() {
  void checkAppVersion();
  void useContent.getState().load();
  // Sign-in is checked again too: a failed first check would otherwise leave a signed-in student as a guest.
  const auth = useAuth.getState();
  if (auth.status !== "signedIn") void auth.init();
}

/** Why a round could not start: a connection problem (null) or something the server reported. */
function problemOf(e: unknown): string | null {
  if (e instanceof ApiError && e.status === OFFLINE) return null;
  if (e instanceof ApiError) return e.message;
  return e instanceof Error && e.message === "No questions" ? "There are no questions for that choice yet." : "Couldn't load the questions. Please try again.";
}

/** Asks the server which builds it still supports. An outdated website reloads itself once; the app asks to be updated. */
async function checkAppVersion() {
  const { minBuild } = await api<AppConfig>("/api/config").catch(() => ({ minBuild: 0 }));
  if (APP_BUILD >= minBuild) return;
  try {
    if (!isNative && sessionStorage.getItem(RELOADED_KEY) !== String(minBuild)) {
      sessionStorage.setItem(RELOADED_KEY, String(minBuild));
      window.location.reload();
      return;
    }
  } catch {
    // No session storage: show the update screen instead of risking a reload loop.
  }
  useConnection.setState({ updateRequired: true });
}

export default function App() {
  useApplyTheme();
  const screen = useNav((s) => s.screen);
  const go = useNav((s) => s.go);
  const start = useSession((s) => s.start);
  const resume = useSession((s) => s.resume);
  const finishedAt = useSession((s) => s.finishedAt);
  const updateRequired = useConnection((s) => s.updateRequired);
  const contentStatus = useContent((s) => s.status);
  const [starting, setStarting] = useState(false);
  /** A round that could not be loaded: retried from the offline screen. `problem` when it was not a connection issue. */
  const [failedStart, setFailedStart] = useState<{ retry: () => void; problem: string | null } | null>(null);
  /** A round waiting for the guest to sign in; it starts once they have. */
  const [gate, setGate] = useState<{ retry: () => void } | null>(null);
  const authStatus = useAuth((s) => s.status);
  /** How the round on screen was started, so "Start over" can load a fresh one the same way. */
  const lastRound = useRef<{ source: RoundSource; title: string; key?: string; free: boolean } | null>(null);
  const notAdmin = useNotAdmin();
  useAdminGuard(screen);

  useEffect(() => {
    if (gate && authStatus === "signedIn") {
      setGate(null);
      gate.retry();
    }
  }, [gate, authStatus]);

  useEffect(() => {
    startup();
    window.addEventListener("online", startup);
    const stopScores = startScoreSync();
    const stopProgress = startProgressSync();
    const stopGames = startGameScoreSync();
    const stopGuestCount = startGuestCount();
    return () => {
      stopGuestCount();
      window.removeEventListener("online", startup);
      stopScores();
      stopProgress();
      stopGames();
    };
  }, []);

  /**
   * Loads a round from the server and starts it; with a `key` (chapter or mixed practice), continues its unfinished round instead.
   * `fresh` starts over: a new round replaces the unfinished one, which is dropped only once the new one has loaded.
   */
  const begin = useCallback(
    async (source: RoundSource, title: string, key?: string, free = false, fresh = false) => {
      // A guest past the free round signs in first; a round they already started can still be finished, but not started over.
      if (!free && mustSignIn() && (fresh || !(key && getSavedRound(key)))) {
        setGate({ retry: () => void begin(source, title, key, free, fresh) });
        return;
      }
      lastRound.current = { source, title, key, free };
      setStarting(true);
      setFailedStart(null);
      try {
        // A signed-in student's unfinished rounds may still be loading from another device.
        if (key) await progressReady();
        const saved = key ? getSavedRound(key) : undefined;
        if (saved && !fresh) {
          // Answered questions come with their keys, so their feedback and review still show. Skipped ones stay without,
          // so they can still be answered; for a signed-in student the server reveals only those it saw checked.
          const signedIn = useAuth.getState().user !== null;
          const { questions, missing } = await fetchQuestions(
            saved.questionIds,
            saved.attempts.filter((a) => signedIn || a.response !== undefined).map((a) => a.questionId),
            saved.roundId,
          );
          // A question was removed since: start a fresh round instead.
          if (missing.length === 0) {
            resume(saved, questions);
            go("practice");
            return;
          }
        }
        // Admin-only, for testing: a chapter round can draw fewer (or more) than the usual ROUND_SIZE questions.
        const count = "chapter" in source && !notAdmin ? useProfile.getState().adminRoundSize ?? undefined : undefined;
        const questions = await fetchRound(source, count);
        if (questions.length === 0) throw new Error("No questions");
        start(questions, title, key);
        if (fresh && key && saved) discardSavedRound(key, saved.roundId);
        go("practice");
      } catch (e) {
        setFailedStart({ retry: () => void begin(source, title, key, free, fresh), problem: problemOf(e) });
      } finally {
        setStarting(false);
      }
    },
    [go, resume, start, notAdmin],
  );

  const leaveResults = () => {
    useNav.getState().setOpponent(null);
    go("home");
  };

  useEffect(() => {
    if (finishedAt && screen === "practice") {
      const { roundId, key, xp, bestStreak, title, questions, attempts, startedAt } = useSession.getState();
      // Every question of the round was removed while it was being played: nothing to record.
      if (questions.length === 0) {
        go("home");
        return;
      }
      const score = scoreSession(questions, attempts);
      recordRound(
        {
          // Same ID as the round's saved answers, so they can be linked.
          id: roundId,
          at: finishedAt,
          title,
          correct: score.correct,
          total: questions.length,
          marks: score.marks,
          maxMarks: score.maxMarks,
          accuracy: score.percent,
          xp,
          timeMs: Math.min(MAX_ROUND_MS, finishedAt - startedAt),
          ...(key ? { quizKey: key } : {}),
        },
        bestStreak,
        {
          questionIds: questions.map((q) => q.id),
          attempts: attempts.map((a) => ({ questionId: a.questionId, response: a.response, usedHint: a.usedHint })),
        },
      );
      invalidateBoards();
      go("results");
    }
  }, [finishedAt, screen, go]);

  if (updateRequired) return <UpdateScreen />;
  if (failedStart) {
    const back = () => {
      setFailedStart(null);
      // A challenge that failed to start has already been left; there is nothing to go back to but home.
      if (screen === "challenge") leaveResults();
    };
    return <OfflineScreen onRetry={failedStart.retry} onBack={back} problem={failedStart.problem ?? undefined} />;
  }
  if (starting) return <LoadingScreen />;
  // Home and progress list the chapters, which come from the server; until they arrive (or fail), a spinner.
  // After a failure home still opens, so the games (which need no connection) can be played.
  if ((screen === "home" || screen === "progress") && contentStatus === "loading") return <LoadingScreen />;
  // Admin pages wait for the sign-in check; non-admins are sent home (useAdminGuard) and never see them.
  if (ADMIN_SCREENS.includes(screen) && (authStatus === "loading" || notAdmin)) return <LoadingScreen />;

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          {screen === "home" && <HomeScreen onStart={begin} />}
          {screen === "practice" && (
            <PracticeScreen
              onExit={leaveResults}
              onRestart={
                lastRound.current
                  ? () => {
                      const r = lastRound.current!;
                      void begin(r.source, r.title, r.key, r.free, true);
                    }
                  : undefined
              }
            />
          )}
          {screen === "results" && (
            <ResultsScreen
              onHome={leaveResults}
              onRetry={(ids, title) => {
                useNav.getState().setOpponent(null);
                void begin({ ids }, title);
              }}
            />
          )}
          {screen === "board" && <LeaderboardScreen />}
          {screen === "progress" && <ProgressScreen onStart={begin} />}
          {/* Challenge links stay free, so a friend can always play the challenge they were sent. */}
          {screen === "challenge" && <ChallengeScreen onStart={(source, title) => void begin(source, title, undefined, true)} />}
          {screen === "game" && <GameScreen />}
          {screen === "admin" && <AdminScreen />}
          {screen === "difficulty" && <DifficultyScreen />}
          {screen === "sequence" && <SequenceScreen />}
          {screen === "reports" && <ReportsScreen />}
          {screen === "quizzes" && <QuizScreen />}
          {screen === "quizadmin" && <QuizAdminScreen />}
        </motion.div>
      </AnimatePresence>
      <SignInGate open={gate !== null} onClose={() => setGate(null)} />
    </MotionConfig>
  );
}
