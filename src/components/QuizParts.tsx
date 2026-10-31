import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Radio, Trophy } from "lucide-react";
import clsx from "clsx";
import type { QuizInfo, QuizList } from "../content/api";
import { api } from "../store/auth";
import { useNav } from "../store/nav";

/*
 * Pieces shared by the quiz pages (QuizScreen) and the home page banner:
 * the server clock, countdowns and the live / upcoming badge.
 */

/** Server time minus this device's: the quiz window and deadline follow the server's clock. */
let clockOffset = 0;
export const syncClock = (serverNow: number) => {
  clockOffset = serverNow - Date.now();
};
export const serverNow = () => Date.now() + clockOffset;

/** The server's time now, updated every `ms`. */
export function useServerNow(ms = 1000): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const t = window.setInterval(() => setNow(serverNow()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

export type QuizPhase = "upcoming" | "live" | "ended";
export const phaseOf = (q: QuizInfo, now: number): QuizPhase => (now < q.startsAt ? "upcoming" : now < q.endsAt ? "live" : "ended");

const pad = (n: number) => String(n).padStart(2, "0");

/** "12:05" or "1:02:05". */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  return h ? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** "in 3 days" / "in 2h 5m" / "in 45s", for short labels. */
export function until(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s >= 2 * 86400) return `in ${Math.floor(s / 86400)} days`;
  if (s >= 3600) return `in ${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `in ${Math.floor(s / 60)}m ${s % 60}s`;
  return `in ${s}s`;
}

export const formatWhen = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** One digit that rolls over when it changes. */
function RollingDigit({ d }: { d: string }) {
  return (
    <span className="relative inline-block h-[1.1em] w-[0.62em] overflow-hidden text-center">
      <AnimatePresence initial={false}>
        <motion.span
          key={d}
          initial={{ y: "-100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="absolute inset-0"
        >
          {d}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Days, hours, minutes and seconds to `to`, in big tiles whose digits roll. */
export function Countdown({ to, now, className }: { to: number; now: number; className?: string }) {
  const s = Math.max(0, Math.floor((to - now) / 1000));
  const parts = [
    { label: "days", v: Math.floor(s / 86400) },
    { label: "hours", v: Math.floor((s % 86400) / 3600) },
    { label: "mins", v: Math.floor((s % 3600) / 60) },
    { label: "secs", v: s % 60 },
  ].filter((p, i) => i > 0 || p.v > 0);
  return (
    <div className={clsx("flex justify-center gap-2 sm:gap-3", className)} role="timer" aria-label={`Starts ${until(to - now)}`}>
      {parts.map((p) => (
        <div key={p.label} className="grid min-w-16 place-items-center rounded-2xl bg-fg px-2 py-3 text-bg shadow-pop sm:min-w-20">
          <span className="font-display text-4xl font-extrabold tabular-nums sm:text-5xl">
            {pad(p.v)
              .split("")
              .map((d, i) => (
                <RollingDigit key={i} d={d} />
              ))}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider opacity-60">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

/** "LIVE" (pulsing), "Starts in …" or "Ended". */
export function PhaseBadge({ quiz, now, className }: { quiz: QuizInfo; now: number; className?: string }) {
  const phase = phaseOf(quiz, now);
  if (phase === "live") {
    return (
      <span className={clsx("inline-flex items-center gap-1.5 rounded-full bg-bad px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-white", className)}>
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-white" />
        </span>
        Live now
      </span>
    );
  }
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider",
        phase === "upcoming" ? "bg-brand-soft text-brand" : "bg-surface-2 text-muted",
        className,
      )}
    >
      {phase === "upcoming" ? `Starts ${until(quiz.startsAt - now)}` : "Ended"}
    </span>
  );
}

/** The quiz to show off on the home page: the live one ending soonest, else the next to start. */
function featured(quizzes: QuizInfo[], now: number): QuizInfo | null {
  const live = quizzes.filter((q) => phaseOf(q, now) === "live").sort((a, b) => a.endsAt - b.endsAt);
  const next = quizzes.filter((q) => phaseOf(q, now) === "upcoming").sort((a, b) => a.startsAt - b.startsAt);
  return live[0] ?? next[0] ?? null;
}

/** Home page banner for the live or next quiz; hidden when there is none. */
export function QuizBanner() {
  const go = useNav((s) => s.go);
  const [quizzes, setQuizzes] = useState<QuizInfo[] | null>(null);
  const now = useServerNow();

  useEffect(() => {
    let live = true;
    api<QuizList>("/api/quizzes")
      .then((r) => {
        syncClock(r.now);
        if (live) setQuizzes(r.quizzes);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const quiz = quizzes ? featured(quizzes, now) : null;
  if (!quiz) return null;
  const isLive = phaseOf(quiz, now) === "live";
  return (
    <motion.button
      type="button"
      onClick={() => go("quizzes")}
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="group relative mb-6 flex w-full items-center gap-4 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#2b2f6b] via-[#3d3a8f] to-[#7b3fbf] p-4 text-left text-white shadow-pop sm:p-5"
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <motion.span
        className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#ffd23f] to-[#ff8a1f] text-[#2b2f6b] shadow-pop"
        animate={{ rotate: [0, -8, 8, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5 }}
      >
        <Trophy className="size-7" />
      </motion.span>
      <span className="relative min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          {isLive ? (
            <PhaseBadge quiz={quiz} now={now} />
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider">
              <Radio className="size-3.5" /> Starts {until(quiz.startsAt - now)}
            </span>
          )}
          <span className="text-xs font-bold text-white/70">Win a certificate 🏅</span>
        </span>
        <span className="mt-1 block truncate font-display text-xl font-extrabold sm:text-2xl">{quiz.title}</span>
        <span className="block text-sm text-white/75">
          {quiz.questionCount} questions · {quiz.durationMin} min · {quiz.participants} joined
        </span>
      </span>
      <span className="relative hidden items-center gap-1 rounded-2xl bg-white px-4 py-2.5 font-display font-extrabold text-[#2b2f6b] sm:flex">
        {isLive ? "Join now" : "See details"} <ChevronRight className="size-5 transition group-hover:translate-x-0.5" />
      </span>
      <ChevronRight className="relative size-6 shrink-0 sm:hidden" />
    </motion.button>
  );
}
