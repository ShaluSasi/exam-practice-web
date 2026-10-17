import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { Question } from "./content/schema";
import { useApplyTheme } from "./lib/theme";
import { HomeScreen } from "./screens/HomeScreen";
import { PracticeScreen } from "./screens/PracticeScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { useProfile } from "./store/profile";
import { useSession } from "./store/session";

type Screen = "home" | "practice" | "results";

export default function App() {
  useApplyTheme();
  const [screen, setScreen] = useState<Screen>("home");
  const start = useSession((s) => s.start);
  const finishedAt = useSession((s) => s.finishedAt);

  const begin = (qs: Question[]) => {
    start(qs);
    setScreen("practice");
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    if (finishedAt && screen === "practice") {
      const { xp, bestStreak } = useSession.getState();
      useProfile.getState().recordSession(xp, bestStreak);
      setScreen("results");
      window.scrollTo({ top: 0 });
    }
  }, [finishedAt, screen]);

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
          {screen === "practice" && <PracticeScreen onExit={() => setScreen("home")} />}
          {screen === "results" && <ResultsScreen onHome={() => setScreen("home")} onRetry={begin} />}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
