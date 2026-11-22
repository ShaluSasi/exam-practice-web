import { useEffect, useMemo, useState } from "react";
import type { AdminUserProgress } from "../content/api";
import { Header, Problem, Spinner } from "../components/AdminParts";
import { api } from "../store/auth";
import { useNav, viewedUserId } from "../store/nav";
import type { Round, Stats } from "../store/profile";
import type { SavedRound } from "../store/session";
import { ProgressView } from "./ProgressScreen";

/** Admins only: a student's progress page, as they see it, opened from the Users page. Read-only. */
export function UserProgressScreen() {
  const go = useNav((s) => s.go);
  const [id] = useState(viewedUserId);
  const [data, setData] = useState<AdminUserProgress | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    setProblem(null);
    api<AdminUserProgress>(`/api/admin/users/progress?user=${encodeURIComponent(id)}`)
      .then((d) => live && setData(d))
      .catch((e) => live && setProblem(e instanceof Error ? e.message : "Could not load this student's progress."));
    return () => {
      live = false;
    };
  }, [id, reload]);

  // The same rounds the student's own page is built from (src/store/scoreSync.ts): latest rounds plus each title's best.
  const stats = useMemo((): Stats | null => {
    if (!data) return null;
    const byId = new Map<string, Round>();
    for (const r of [...data.scores.recent, ...data.scores.bests]) byId.set(r.id, r);
    return { totalXp: data.scores.totalXp, bestStreak: data.scores.bestStreak, sessions: data.scores.sessions, rounds: [...byId.values()].sort((a, b) => b.at - a.at) };
  }, [data]);
  const saved = useMemo(
    () => Object.fromEntries(((data?.saved ?? []) as SavedRound[]).filter((r) => r && typeof r.key === "string").map((r) => [r.key, r])),
    [data],
  );

  if (!data || !stats) {
    return (
      <div className="paper min-h-dvh">
        <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
          <Header title="Student progress" onBack={() => go("users")} />
          {problem ? <Problem message={problem} onRetry={() => setReload((n) => n + 1)} /> : <Spinner />}
        </div>
      </div>
    );
  }
  return <ProgressView stats={stats} saved={saved} viewing={{ name: data.user.name, email: data.user.email, grade: data.user.grade, onBack: () => go("users") }} />;
}
