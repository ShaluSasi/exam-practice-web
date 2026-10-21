import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { AppConfig } from "./content/api";
import { scoreSession } from "./engine/scoring";
import { APP_BUILD, isNative } from "./lib/platform";
import { useApplyTheme } from "./lib/theme";
import { ApiError, OFFLINE, api, useAuth } from "./store/auth";
import { useConnection } from "./store/connection";
import { fetchQuestions, fetchRound, useContent, type RoundSource } from "./store/content";
import { ChallengeScreen } from "./screens/ChallengeScreen";
import { GameScreen } from "./screens/GameScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LeaderboardScreen } from "./screens/LeaderboardScreen";
import { PracticeScreen } from "./screens/PracticeScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { LoadingScreen, OfflineScreen, UpdateScreen } from "./screens/StatusScreens";
import { startGameScoreSync } from "./store/gameBoard";
import { invalidateBoards } from "./store/leaderboard";
import { useNav } from "./store/nav";
import { getSavedRound, progressReady, startProgressSync } from "./store/progress";
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

  useEffect(() => {
    startup();
    window.addEventListener("online", startup);
    const stopScores = startScoreSync();
    const stopProgress = startProgressSync();
    const stopGames = startGameScoreSync();
    return () => {
      window.removeEventListener("online", startup);
      stopScores();
      stopProgress();
      stopGames();
    };
  }, []);

  /** Loads a round from the server and starts it; with a `key` (chapter or mixed practice), continues its unfinished round instead. */
  const begin = useCallback(
    async (source: RoundSource, title: string, key?: string) => {
      setStarting(true);
      setFailedStart(null);
      try {
        // A signed-in student's unfinished rounds may still be loading from another device.
        if (key) await progressReady();
        const saved = key ? getSavedRound(key) : undefined;
        if (saved) {
          // Answered questions come with their keys, so their feedback and review still show.
          const { questions, missing } = await fetchQuestions(
            saved.questionIds,
            saved.attempts.map((a) => a.questionId),
            saved.roundId,
          );
          // A question was removed since: start a fresh round instead.
          if (missing.length === 0) {
            resume(saved, questions);
            go("practice");
            return;
          }
        }
        const questions = await fetchRound(source);
        if (questions.length === 0) throw new Error("No questions");
        start(questions, title, key);
        go("practice");
      } catch (e) {
        setFailedStart({ retry: () => void begin(source, title, key), problem: problemOf(e) });
      } finally {
        setStarting(false);
      }
    },
    [go, resume, start],
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
          accuracy: score.accuracy,
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
  // Home lists the chapters, which come from the server; until they arrive (or fail), a spinner.
  // After a failure home still opens, so the games (which need no connection) can be played.
  if (screen === "home" && contentStatus === "loading") return <LoadingScreen />;

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
          {screen === "practice" && <PracticeScreen onExit={leaveResults} />}
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
          {screen === "challenge" && <ChallengeScreen onStart={begin} />}
          {screen === "game" && <GameScreen />}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
