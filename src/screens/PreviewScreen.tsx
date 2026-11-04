import { useCallback, useEffect, useState } from "react";
import { Problem } from "../components/AdminParts";
import { Button } from "../components/Button";
import { fetchQuestions } from "../store/content";
import { previewQuestionId, useNav } from "../store/nav";
import { useSession } from "../store/session";
import { PracticeScreen } from "./PracticeScreen";
import { LoadingScreen } from "./StatusScreens";

/**
 * One question on the students' own practice screen, for an admin checking a
 * report, fetched from the server each time it opens. It is a round with no key
 * on a screen other than "practice", so no progress, score or XP is saved.
 */
export function PreviewScreen() {
  const go = useNav((s) => s.go);
  const start = useSession((s) => s.start);
  const finishedAt = useSession((s) => s.finishedAt);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setReady(false);
    setProblem(null);
    try {
      const { questions } = await fetchQuestions([previewQuestionId]);
      if (questions.length === 0) return setProblem("This question is no longer in the question bank.");
      start(questions, questions[0].chapter);
      setReady(true);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not load the question.");
    }
  }, [start]);

  useEffect(() => {
    void load();
  }, [load]);

  const close = () => {
    window.close();
    // Still open: the link was opened directly, so this window cannot be closed from here.
    window.setTimeout(() => go("reports"), 100);
  };

  if (problem) {
    return (
      <div className="paper grid min-h-dvh place-items-center p-4">
        <Problem message={problem} onRetry={() => void load()} />
      </div>
    );
  }
  if (!ready) return <LoadingScreen />;
  if (finishedAt) {
    return (
      <div className="paper grid min-h-dvh place-items-center p-4">
        <div className="w-full max-w-md rounded-[28px] border-2 border-line bg-surface p-6 text-center shadow-card">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">End of preview</h1>
          <p className="mt-1.5 text-muted">Nothing from this preview was saved.</p>
          <div className="mt-6 flex gap-3">
            <Button variant="ghost" onClick={close} className="flex-1">
              Close
            </Button>
            <Button onClick={() => void load()} className="flex-1">
              View again
            </Button>
          </div>
        </div>
      </div>
    );
  }
  return <PracticeScreen onExit={close} onRestart={() => void load()} />;
}
