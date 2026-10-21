import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { AppConfig } from "./content/api";
import { scoreSession } from "./engine/scoring";
import { APP_BUILD, isNative } from "./lib/platform";
import { useApplyTheme } from "./lib/theme";
import { api, useAuth } from "./store/auth";
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
import { getSavedRound, startProgressSync } from "./store/progress";
import { recordRound, startScoreSync } from "./store/scoreSync";
import { useSession } from "./store/session";

const RELOADED_KEY = "prepquest-reloaded-for";

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
  /** A round that could not be loaded (offline): retried from the offline screen. */
  const [failedStart, setFailedStart] = useState<(() => void) | null>(null);

  useEffect(() => {
    void checkAppVersion();
    void useContent.getState().load();
    void useAuth.getState().init();
    const stopScores = startScoreSync();
    const stopProgress = startProgressSync();
    const stopGames = startGameScoreSync();
    return () => {
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
        const saved = key ? getSavedRound(key) : undefined;
        if (saved) {
          // Answered questions come with their keys, so their feedback and review still show.
          const { questions, missing } = await fetchQuestions(saved.questionIds, saved.attempts.map((a) => a.questionId));
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
      } catch {
        setFailedStart(() => () => void begin(source, title, key));
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
          timeMs: finishedAt - startedAt,
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
  if (failedStart) return <OfflineScreen onRetry={failedStart} onBack={() => setFailedStart(null)} />;
  if (starting) return <LoadingScreen />;
  // Home lists the chapters, which come from the server.
  if (screen === "home" && contentStatus !== "ready") {
    return contentStatus === "failed" ? <OfflineScreen onRetry={() => void useContent.getState().load()} /> : <LoadingScreen />;
  }

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
