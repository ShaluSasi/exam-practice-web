import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BookOpen, Check, Clock, Flame, Lightbulb, Loader2, Target, Trophy, WifiOff, X, Zap } from "lucide-react";
import clsx from "clsx";
import { region } from "../config/regions";
import { Button } from "../components/Button";
import { Figure } from "../components/Figure";
import { QuestionHeader } from "../components/QuestionHeader";
import { RichText } from "../components/RichText";
import { XpPill } from "../components/TopBar";
import { isAnswered, scoreSession, type ScoreSummary } from "../engine/scoring";
import { burst } from "../lib/celebrate";
import { play } from "../lib/sound";
import { formatTime } from "../lib/subjects";
import { QuestionBody } from "../questions";
import { useSession, type Attempt } from "../store/session";

const PRAISE = ["Brilliant!", "Spot on!", "Nailed it!", "Excellent!", "Superb!"];
const ENCOURAGE = ["Not quite", "Almost there", "Good try"];

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="flex items-center gap-1.5 font-display font-bold tabular-nums text-muted">
      <Clock className="size-4" /> {formatTime(now - since)}
    </span>
  );
}

function ProgressTrack({ total, attempts, index }: { total: number; attempts: Attempt[]; index: number }) {
  return (
    <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={attempts.length}>
      {Array.from({ length: total }, (_, i) => {
        const a = attempts[i];
        return (
          <div key={i} className="relative h-3 flex-1 overflow-hidden rounded-full bg-line">
            <motion.div
              className={clsx("absolute inset-0 rounded-full", a ? (a.correct ? "bg-ok" : "bg-bad") : "bg-brand")}
              initial={false}
              animate={{ scaleX: a ? 1 : i === index ? 0.35 : 0 }}
              style={{ originX: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
            />
          </div>
        );
      })}
    </div>
  );
}

function Streak({ n }: { n: number }) {
  const hot = n >= 2;
  return (
    <motion.div
      key={n}
      initial={{ scale: hot ? 1.5 : 1 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 12 }}
      className={clsx("flex items-center gap-1 font-display font-extrabold tabular-nums", hot ? "text-bad" : "text-muted")}
      title="Answer streak"
    >
      <Flame className={clsx("size-5", hot && "fill-brand text-bad")} />
      {n}
    </motion.div>
  );
}

function ScoreTile({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: typeof Zap;
  label: string;
  value: string | number;
  suffix?: string;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-line bg-surface px-2 py-1.5 sm:px-3">
      <span className={clsx("hidden size-7 shrink-0 place-items-center rounded-lg sm:grid", tone)}>
        <Icon className="size-4" strokeWidth={2.75} />
      </span>
      <div className="min-w-0 leading-none">
        <div className="flex items-baseline gap-0.5 font-display font-extrabold tabular-nums">
          <motion.span
            key={String(value)}
            initial={{ y: -10, opacity: 0, scale: 1.4 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className="text-[17px] sm:text-lg"
          >
            {value}
          </motion.span>
          {suffix && <span className="text-xs text-muted">{suffix}</span>}
        </div>
        <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-muted sm:text-[11px]">{label}</div>
      </div>
    </div>
  );
}

/** Live scoreboard for the current round. */
function ScoreBoard({ score }: { score: ScoreSummary }) {
  return (
    <div className="mx-auto flex max-w-3xl gap-1.5 px-4 pb-3 sm:gap-2.5 sm:px-6" aria-label="Scoreboard">
      <ScoreTile icon={Trophy} label="Score" value={score.marks} suffix={`/${score.maxMarks}`} tone="bg-brand text-brand-ink" />
      <ScoreTile icon={Check} label="Correct" value={score.correct} tone="bg-ok text-white" />
      <ScoreTile icon={X} label="Wrong" value={score.wrong + score.skipped} tone="bg-bad text-white" />
      <ScoreTile icon={Target} label="Accuracy" value={`${score.accuracy}%`} tone="bg-fg text-bg" />
    </div>
  );
}

function FeedbackSheet({
  attempt,
  streak,
  explanation,
  onNext,
  isLast,
}: {
  attempt: Attempt;
  streak: number;
  explanation: string;
  onNext: () => void;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(!attempt.correct);
  const [title] = useState(() => {
    const pool = attempt.correct ? PRAISE : ENCOURAGE;
    return pool[Math.floor(Math.random() * pool.length)];
  });
  const ok = attempt.correct;
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className={clsx("border-t-2", ok ? "border-ok/40 bg-ok-soft" : "border-bad/40 bg-bad-soft")}
    >
      <div className="mx-auto max-w-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-5">
        <div className="flex items-center gap-3">
          <motion.span
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.05 }}
            className={clsx("grid size-11 shrink-0 place-items-center rounded-full text-white", ok ? "bg-ok" : "bg-bad")}
          >
            {ok ? <Check className="size-6" strokeWidth={3.5} /> : <X className="size-6" strokeWidth={3.5} />}
          </motion.span>
          <div className="min-w-0 flex-1">
            <p className={clsx("font-display text-2xl font-extrabold", ok ? "text-ok" : "text-bad")}>{title}</p>
            {ok && (
              <p className="flex items-center gap-2 text-sm font-semibold text-fg/70">
                <span className="flex items-center gap-1">
                  <Zap className="size-3.5 fill-brand text-brand" /> +{attempt.xp} XP
                </span>
                {streak >= 3 && <span>· {streak} in a row 🔥</span>}
                {attempt.usedHint && <span>· hint used</span>}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-fg/70 hover:bg-black/5 sm:flex dark:hover:bg-white/5"
          >
            <BookOpen className="size-4" /> {open ? "Hide" : "Show"} explanation
          </button>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 max-h-[32dvh] overflow-y-auto rounded-2xl bg-surface p-4 leading-relaxed">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Explanation</p>
                <RichText text={explanation} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-4 flex gap-3">
          <Button
            variant="ghost"
            onClick={() => setOpen((o) => !o)}
            className="px-4 sm:hidden"
            aria-label={open ? "Hide explanation" : "Show explanation"}
          >
            <BookOpen className="size-5" />
          </Button>
          <Button variant={ok ? "ok" : "bad"} onClick={onNext} className="flex-1 sm:ml-auto sm:flex-none sm:px-10" autoFocus>
            {isLast ? "See results" : "Continue"} <ArrowRight className="size-5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export function PracticeScreen({ onExit }: { onExit: () => void }) {
  const s = useSession();
  const q = s.questions[s.index];
  const checkRef = useRef<HTMLButtonElement>(null);
  const xpRef = useRef<HTMLDivElement>(null);
  const [floatXp, setFloatXp] = useState<{ id: number; xp: number } | null>(null);
  const answered = q ? isAnswered(q, s.response) : false;
  const lastAttempt = s.attempts.at(-1);
  const score = useMemo(() => scoreSession(s.questions, s.attempts), [s.questions, s.attempts]);

  const check = useCallback(async () => {
    if (!answered || s.phase !== "answering") return;
    // Graded on the server; null if it could not be reached (the answer stays, to try again).
    const a = await s.check();
    if (!a) return;
    if (a.correct) {
      play("correct");
      burst(checkRef.current);
      setFloatXp({ id: Date.now(), xp: a.xp });
    } else {
      play("wrong");
      navigator.vibrate?.(80);
    }
  }, [answered, s]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        // Buttons outside the question (Check, Continue, Exit) keep their native Enter.
        if (e.target instanceof HTMLElement && e.target.closest("button") && !e.target.closest("[data-qbody]")) return;
        e.preventDefault();
        if (s.phase === "answering") void check();
        else if (s.phase === "feedback") s.next();
        return;
      }
      if (e.target instanceof HTMLInputElement || s.phase !== "answering") return;
      if (q?.type === "hotspot") {
        const spot = q.spots[Number(e.key) - 1];
        if (!spot) return;
        play("tap");
        s.setResponse(spot.id);
        return;
      }
      if (q?.type === "mcq" || q?.type === "assertion_reason" || q?.type === "multi") {
        const opts = q.type === "assertion_reason" ? region.assertionReasonOptions : q.options;
        const i = "1234".indexOf(e.key) >= 0 ? "1234".indexOf(e.key) : "abcd".indexOf(e.key.toLowerCase());
        const opt = opts[i];
        if (!opt) return;
        play("tap");
        if (q.type === "multi") {
          const cur = (s.response as string[] | undefined) ?? [];
          s.setResponse(cur.includes(opt.id) ? cur.filter((x) => x !== opt.id) : [...cur, opt.id]);
        } else s.setResponse(opt.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s, q, check]);

  if (!q) return null;
  const reveal = s.phase === "feedback";
  const checking = s.phase === "checking";

  return (
    <div className="paper flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b-2 border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onExit}
            aria-label="Exit practice"
            className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-6" />
          </motion.button>
          <ProgressTrack total={s.questions.length} attempts={s.attempts} index={s.index} />
          <Streak n={s.streak} />
          <div ref={xpRef} className="relative">
            <XpPill xp={s.xp} />
            <AnimatePresence>
              {floatXp && (
                <motion.span
                  key={floatXp.id}
                  initial={{ opacity: 0, y: 24, scale: 0.6 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [24, 0, 0, -6], scale: [0.6, 1.15, 1, 1] }}
                  transition={{ duration: 1.4, times: [0, 0.25, 0.8, 1] }}
                  onAnimationComplete={() => setFloatXp(null)}
                  className="pointer-events-none absolute right-full top-1/2 mr-2 -mt-3.5 whitespace-nowrap rounded-full bg-brand px-2.5 py-0.5 font-display text-sm font-extrabold text-brand-ink shadow-pop"
                >
                  +{floatXp.xp} XP
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        <ScoreBoard score={score} />
      </header>

      {/* Question */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-8 pt-6 sm:px-6 sm:pt-10">
        <div className="mb-4 flex items-center justify-between gap-3 text-sm font-semibold text-muted">
          <span className="min-w-0">
            Question <span className="font-display text-fg">{s.index + 1}</span> of {s.questions.length}
            {s.title && <span className="hidden sm:inline"> · {s.title}</span>}
          </span>
          <Elapsed since={s.startedAt} />
        </div>
        <AnimatePresence mode="wait">
          <motion.article
            key={q.id}
            initial={{ opacity: 0, x: 60, rotate: 1 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: -60, rotate: -1 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="rounded-[28px] border-2 border-line bg-surface p-4 shadow-card sm:p-8"
          >
            <QuestionHeader q={q} />
            <p className="mt-2 text-xs font-semibold text-muted">
              {q.chapter} · {q.topic}
            </p>
            <h2 className="mt-5 text-xl font-semibold leading-relaxed sm:text-[22px]">
              <RichText text={q.prompt} />
            </h2>
            {q.image && q.type !== "hotspot" && <Figure media={q.image} className="mt-5" />}

            {q.hint && !reveal && (
              <div className="mt-4">
                <AnimatePresence mode="wait" initial={false}>
                  {s.usedHint ? (
                    <motion.div
                      key="hint"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex gap-3 rounded-2xl border-2 border-dashed border-brand/50 bg-brand-soft/60 p-4 text-[15px]"
                    >
                      <Lightbulb className="mt-0.5 size-5 shrink-0 fill-brand/30 text-brand" />
                      <RichText text={q.hint} />
                    </motion.div>
                  ) : (
                    <motion.button
                      key="btn"
                      exit={{ opacity: 0 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        play("tap");
                        s.revealHint();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm font-bold text-brand hover:bg-brand-soft"
                    >
                      <Lightbulb className="size-4" /> Need a hint? <span className="font-normal text-muted">(half XP)</span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="mt-6" data-qbody>
              <QuestionBody q={q} response={s.response} onChange={s.setResponse} reveal={reveal} />
            </div>
          </motion.article>
        </AnimatePresence>
        <p className="mt-5 hidden text-center text-xs text-muted sm:block">
          Tip: press <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans">1</kbd>–
          <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans">4</kbd> to choose and{" "}
          <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans">Enter</kbd> to check
        </p>
      </main>

      {/* Bottom action area */}
      <div className="sticky bottom-0 z-20">
        <AnimatePresence mode="wait" initial={false}>
          {reveal && lastAttempt ? (
            <FeedbackSheet
              key={`fb-${q.id}`}
              attempt={lastAttempt}
              streak={s.streak}
              explanation={q.explanation ?? ""}
              onNext={() => s.next()}
              isLast={s.index === s.questions.length - 1}
            />
          ) : (
            <motion.div
              key={`check-${q.id}`}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="border-t-2 border-line bg-bg/90 backdrop-blur"
            >
              {s.checkFailed && (
                <p role="alert" className="mx-auto flex max-w-3xl items-center gap-2 px-4 pt-3 text-sm font-semibold text-bad sm:px-6">
                  <WifiOff className="size-4 shrink-0" /> Couldn't reach the server. Check your connection and try again.
                </p>
              )}
              <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
                <button
                  type="button"
                  disabled={checking}
                  onClick={() => void s.check(true).then((a) => a && play("wrong"))}
                  className="rounded-xl px-3 py-2 font-bold text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40"
                >
                  Skip
                </button>
                <Button ref={checkRef} disabled={!answered || checking} onClick={() => void check()} className="flex-1 sm:flex-none sm:px-12">
                  {checking ? <Loader2 className="size-5 animate-spin" aria-label="Checking" /> : s.checkFailed ? "Try again" : "Check"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
