import { useEffect } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { questionBank } from "./content";
import type { Question } from "./content/schema";
import { scoreSession } from "./engine/scoring";
import { useApplyTheme } from "./lib/theme";
import { useAuth } from "./store/auth";
import { ChallengeScreen } from "./screens/ChallengeScreen";
import { GameScreen } from "./screens/GameScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LeaderboardScreen } from "./screens/LeaderboardScreen";
import { PracticeScreen } from "./screens/PracticeScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { startGameScoreSync } from "./store/gameBoard";
import { invalidateBoards } from "./store/leaderboard";
import { useNav } from "./store/nav";
import { getSavedRound, startProgressSync } from "./store/progress";
import { recordRound, startScoreSync } from "./store/scoreSync";
import { useSession, type SavedRound } from "./store/session";

const questionsById = new Map(questionBank.map((q) => [q.id, q]));

/** A saved round's questions, or null if any of them no longer exists. */
function questionsOf(saved: SavedRound): Question[] | null {
  const qs = saved.questionIds.map((id) => questionsById.get(id));
  return qs.every((q) => q !== undefined) ? qs : null;
}

export default function App() {
  useApplyTheme();
  const screen = useNav((s) => s.screen);
  const go = useNav((s) => s.go);
  const start = useSession((s) => s.start);
  const resume = useSession((s) => s.resume);
  const finishedAt = useSession((s) => s.finishedAt);

  useEffect(() => {
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

  /** Starts a round; with a `key` (chapter or mixed practice), continues its unfinished round instead. */
  const begin = (qs: Question[], title: string, key?: string) => {
    const saved = key ? getSavedRound(key) : undefined;
    const savedQuestions = saved && questionsOf(saved);
    if (saved && savedQuestions) resume(saved, savedQuestions);
    else start(qs, title, key);
    go("practice");
  };

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
      );
      invalidateBoards();
      go("results");
    }
  }, [finishedAt, screen, go]);

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
              onRetry={(qs, title) => {
                useNav.getState().setOpponent(null);
                begin(qs, title);
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
