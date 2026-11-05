import { ArrowLeft, ShieldCheck } from "lucide-react";
import { GamesStrip } from "../games/GamesStrip";
import { useSession } from "../store/session";

/** The games, opened from a round that waits. Back (this button or the phone's) returns to it. */
export function GameListScreen() {
  const index = useSession((s) => s.index);
  const total = useSession((s) => s.questions.length);
  const xp = useSession((s) => s.xp);
  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        <header className="py-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 py-2.5 font-display font-extrabold shadow-card hover:border-fg/30"
          >
            <ArrowLeft className="size-5" strokeWidth={2.75} /> Back to practice
          </button>
        </header>
        <p className="mb-6 flex items-center gap-2 rounded-2xl bg-ok-soft px-4 py-3 text-sm font-semibold">
          <ShieldCheck className="size-5 shrink-0 text-ok" />
          Your round is safe: question {index + 1} of {total}, {xp} XP. The clock is paused.
        </p>
        <GamesStrip />
      </div>
    </div>
  );
}
