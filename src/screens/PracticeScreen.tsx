import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Clock, Flame, Lightbulb, Loader2, Minus, RotateCcw, Target, Trophy, WifiOff, X, Zap } from "lucide-react";
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
import { attemptFor, canAnswerLater, frontier, isPending, skippedIndexes, useSession, type Attempt } from "../store/session";

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

/** One segment per question, coloured by result. Questions already reached can be tapped to open them. */
function ProgressTrack({ onOpen }: { onOpen: (i: number) => void }) {
  const s = useSession();
  const reached = frontier(s);
  return (
    <div className="flex flex-1 gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={s.questions.length} aria-valuenow={s.attempts.length}>
      {s.questions.map((q, i) => {
        const a = attemptFor(s.attempts, q.id);
        const here = i === s.index;
        return (
          <button
            key={q.id}
            type="button"
            disabled={i > reached}
            onClick={() => onOpen(i)}
            aria-label={`Question ${i + 1}${a ? (a.correct ? ", correct" : a.response === undefined ? ", skipped" : ", wrong") : ""}`}
            aria-current={here ? "step" : undefined}
            className="group flex h-6 flex-1 items-center disabled:cursor-default"
          >
            <span
              className={clsx(
                "relative block h-3 w-full overflow-hidden rounded-full bg-line transition-[height,box-shadow]",
                here ? "h-4 ring-2 ring-fg ring-offset-1 ring-offset-bg" : "group-enabled:group-hover:h-4",
              )}
            >
              <motion.span
                className={clsx("absolute inset-0 block rounded-full", a ? (a.correct ? "bg-ok" : a.response === undefined ? "bg-muted/50" : "bg-bad") : "bg-brand")}
                initial={false}
                animate={{ scaleX: a ? 1 : here ? 0.35 : 0 }}
                style={{ originX: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Shown while skipped questions are waiting: cycles through them, one tap each. */
function SkippedBar({ count, onNext }: { count: number; onNext: () => void }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      whileTap={{ scale: 0.98 }}
      onClick={onNext}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-fg/25 bg-surface-2 px-4 py-2.5 text-left transition-colors hover:border-fg/50"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-white">
        <Minus className="size-4" strokeWidth={3.5} />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold">
        <span className="font-display font-extrabold">
          {count} skipped question{count === 1 ? "" : "s"}
        </span>
        <span className="text-muted"> · still waiting for your answer</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 font-display text-sm font-extrabold">
        Answer <ChevronRight className="size-4" />
      </span>
    </motion.button>
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
  short,
  value,
  suffix,
  tone,
}: {
  icon: typeof Zap;
  label: string;
  /** Label on phones, where five tiles share the width. */
  short?: string;
  value: string | number;
  suffix?: string;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-line bg-surface px-1.5 py-1.5 sm:px-3">
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
        <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-normal text-muted sm:text-[11px] sm:tracking-wider">
          {short ? (
            <>
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
            </>
          ) : (
            label
          )}
        </div>
      </div>
    </div>
  );
}

/** Live scoreboard for the current round. */
function ScoreBoard({ score }: { score: ScoreSummary }) {
  return (
    <div className="mx-auto flex max-w-3xl gap-1 px-4 pb-3 min-[400px]:gap-1.5 sm:gap-2.5 sm:px-6" aria-label="Scoreboard">
      <ScoreTile icon={Trophy} label="Score" value={score.marks} suffix={`/${score.maxMarks}`} tone="bg-brand text-brand-ink" />
      <ScoreTile icon={Check} label="Correct" short="Right" value={score.correct} tone="bg-ok text-white" />
      <ScoreTile icon={X} label="Wrong" value={score.wrong} tone="bg-bad text-white" />
      <ScoreTile icon={Minus} label="Skipped" short="Skip" value={score.skipped} tone="bg-surface-2 text-muted" />
      <ScoreTile icon={Target} label="Accuracy" short="Acc." value={score.accuracy === null ? "–" : `${score.accuracy}%`} tone="bg-fg text-bg" />
    </div>
  );
}

function FeedbackSheet({
  attempt,
  streak,
  explanation,
  onNext,
  nextLabel,
  review = false,
}: {
  attempt: Attempt;
  streak: number;
  explanation: string;
  onNext: () => void;
  nextLabel: string;
  /** An earlier answer looked at again: a plain verdict instead of praise, and no streak. */
  review?: boolean;
}) {
  const [open, setOpen] = useState(!attempt.correct);
  // A skip is neither right nor wrong: no praise, no "not quite", just the answer to learn from.
  const skipped = attempt.response === undefined;
  const [title] = useState(() => {
    if (skipped) return "Skipped";
    if (review) return attempt.correct ? "You got this right" : "You got this wrong";
    const pool = attempt.correct ? PRAISE : ENCOURAGE;
    return pool[Math.floor(Math.random() * pool.length)];
  });
  const ok = attempt.correct;
  const tone = ok ? "ok" : skipped ? "skip" : "bad";
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className={clsx("border-t-2", { ok: "border-ok/40 bg-ok-soft", skip: "border-line bg-surface-2", bad: "border-bad/40 bg-bad-soft" }[tone])}
    >
      <div className="mx-auto max-w-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-5">
        <div className="flex items-center gap-3">
          <motion.span
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.05 }}
            className={clsx("grid size-11 shrink-0 place-items-center rounded-full text-white", { ok: "bg-ok", skip: "bg-muted", bad: "bg-bad" }[tone])}
          >
            {ok ? <Check className="size-6" strokeWidth={3.5} /> : skipped ? <Minus className="size-6" strokeWidth={3.5} /> : <X className="size-6" strokeWidth={3.5} />}
          </motion.span>
          <div className="min-w-0 flex-1">
            <p className={clsx("font-display text-2xl font-extrabold", { ok: "text-ok", skip: "text-fg", bad: "text-bad" }[tone])}>{title}</p>
            {skipped && <p className="text-sm font-semibold text-fg/70">No marks lost. Here's the answer for next time.</p>}
            {review && !ok && !skipped && <p className="text-sm font-semibold text-fg/70">Looking back only: this answer can't be changed.</p>}
            {ok && (
              <p className="flex items-center gap-2 text-sm font-semibold text-fg/70">
                <span className="flex items-center gap-1">
                  <Zap className="size-3.5 fill-brand text-brand" /> +{attempt.xp} XP
                </span>
                {!review && streak >= 3 && <span>· {streak} in a row 🔥</span>}
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
          <Button variant={({ ok: "ok", skip: "dark", bad: "bad" } as const)[tone]} onClick={onNext} className="flex-1 sm:ml-auto sm:flex-none sm:px-10" autoFocus>
            {nextLabel} <ArrowRight className="size-5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/** Asks before starting over, since the answers given so far in this round are lost. */
function RestartDialog({ open, answered, onCancel, onConfirm }: { open: boolean; answered: number; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-end bg-fg/40 backdrop-blur-sm sm:place-items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="restart-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="w-full max-w-md rounded-t-[28px] border-2 border-line bg-surface p-6 pb-[max(2rem,env(safe-area-inset-bottom))] text-center shadow-pop sm:rounded-[28px] sm:pb-6"
          >
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
              <RotateCcw className="size-7" />
            </span>
            <h2 id="restart-title" className="mt-4 font-display text-2xl font-extrabold tracking-tight">
              Start over?
            </h2>
            <p className="mt-1.5 text-muted">
              You'll get a fresh set of questions to practise again.
              {answered > 0 && ` Your ${answered} answer${answered === 1 ? "" : "s"} in this round won't be saved.`}
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="ghost" onClick={onCancel} className="flex-1">
                Keep going
              </Button>
              <Button variant="bad" onClick={onConfirm} className="flex-1" autoFocus>
                <RotateCcw className="size-5" /> Start over
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Every question is done but some were skipped: answer them now, or finish (their answers are shown in the results). */
function SkippedDialog({ open, count, onAnswer, onFinish, onClose }: { open: boolean; count: number; onAnswer: () => void; onFinish: () => void; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-end bg-fg/40 backdrop-blur-sm sm:place-items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="skipped-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="w-full max-w-md rounded-t-[28px] border-2 border-line bg-surface p-6 pb-[max(2rem,env(safe-area-inset-bottom))] text-center shadow-pop sm:rounded-[28px] sm:pb-6"
          >
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
              <Minus className="size-7" strokeWidth={3} />
            </span>
            <h2 id="skipped-title" className="mt-4 font-display text-2xl font-extrabold tracking-tight">
              You skipped {count} question{count === 1 ? "" : "s"}
            </h2>
            <p className="mt-1.5 text-muted">
              Answer {count === 1 ? "it" : "them"} now to score more marks, or finish and see the answer{count === 1 ? "" : "s"} in your results.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
              <Button onClick={onAnswer} className="flex-1" autoFocus>
                Answer skipped <ArrowRight className="size-5" />
              </Button>
              <Button variant="ghost" onClick={onFinish} className="flex-1">
                See results
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PracticeScreen({ onExit, onRestart }: { onExit: () => void; onRestart?: () => void }) {
  const s = useSession();
  const q = s.questions[s.index];
  const checkRef = useRef<HTMLButtonElement>(null);
  const xpRef = useRef<HTMLDivElement>(null);
  const [floatXp, setFloatXp] = useState<{ id: number; xp: number } | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const cancelRestart = useCallback(() => setConfirmRestart(false), []);
  const answered = q ? isAnswered(q, s.response) : false;
  const shownAttempt = q ? attemptFor(s.attempts, q.id) : undefined;
  const score = useMemo(() => scoreSession(s.questions, s.attempts), [s.questions, s.attempts]);
  const skipped = skippedIndexes(s);
  const reached = frontier(s);
  const dialogOpen = confirmRestart || s.endPrompt;
  // Whether moving on from here ends the round (nothing left to answer).
  const lastStop = !s.questions.some((_, i) => i > s.index && isPending(s, i)) && skipped.length === 0;

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
      // Browser shortcuts (Ctrl+A, Ctrl+1, Cmd+C, ...) are not answers, and nothing is answered behind a dialog.
      if (e.ctrlKey || e.metaKey || e.altKey || dialogOpen) return;
      if (e.key === "Enter") {
        // Enter on a focused control (an option, a move-up arrow, Check, Continue) activates that control.
        if (e.target instanceof HTMLElement && e.target.closest("button, [role=button], input, a")) return;
        e.preventDefault();
        if (s.phase === "answering") void check();
        else if (s.phase === "feedback" || s.phase === "review") s.next();
        return;
      }
      // Left and right arrows step between questions, outside text boxes.
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !(e.target instanceof HTMLInputElement)) {
        s.goTo(s.index + (e.key === "ArrowLeft" ? -1 : 1));
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
        // Up to nine options (multi-select questions can have five or six).
        const i = "123456789".indexOf(e.key) >= 0 ? "123456789".indexOf(e.key) : "abcdefghi".indexOf(e.key.toLowerCase());
        const opt = i >= 0 ? opts[i] : undefined;
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
  }, [s, q, check, dialogOpen]);

  if (!q) return null;
  const reveal = s.phase === "feedback" || s.phase === "review";
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
          <ProgressTrack onOpen={s.goTo} />
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
        <div className="mb-4 flex items-center justify-between gap-2 text-sm font-semibold text-muted sm:gap-3">
          {/* Earlier questions can be looked at again; later ones open once reached. */}
          <div className="flex min-w-0 items-center gap-1">
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => s.goTo(s.index - 1)}
              disabled={s.index === 0 || checking}
              aria-label="Previous question"
              title="Previous question"
              className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-line bg-surface text-fg shadow-card hover:border-fg/30 disabled:opacity-30 disabled:shadow-none"
            >
              <ChevronLeft className="size-5" strokeWidth={2.75} />
            </motion.button>
            <span className="min-w-0 truncate px-1 text-center">
              <span className="hidden sm:inline">Question </span>
              <span className="font-display text-base text-fg">{s.index + 1}</span> of {s.questions.length}
              {s.title && <span className="hidden md:inline"> · {s.title}</span>}
            </span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => s.goTo(s.index + 1)}
              disabled={s.index >= reached || checking}
              aria-label="Next question"
              title="Next question"
              className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-line bg-surface text-fg shadow-card hover:border-fg/30 disabled:opacity-30 disabled:shadow-none"
            >
              <ChevronRight className="size-5" strokeWidth={2.75} />
            </motion.button>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden min-[420px]:block">
              <Elapsed since={s.startedAt} />
            </span>
            {onRestart && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => setConfirmRestart(true)}
                disabled={checking}
                className="flex items-center gap-1.5 rounded-xl border-2 border-brand/60 bg-brand-soft px-3.5 py-2 font-display text-sm font-extrabold text-fg shadow-pop transition-colors hover:border-brand hover:bg-brand hover:text-brand-ink disabled:opacity-40 sm:text-base"
              >
                <RotateCcw className="size-4 sm:size-5" strokeWidth={2.75} /> Start over
              </motion.button>
            )}
          </div>
        </div>
        <AnimatePresence initial={false}>
          {/* Hidden while the only skipped question is the one on screen. */}
          {skipped.length > 0 && !(skipped.length === 1 && skipped[0] === s.index) && (
            <SkippedBar key="skipped" count={skipped.length} onNext={s.nextSkipped} />
          )}
        </AnimatePresence>
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
            {canAnswerLater(q, shownAttempt) && (
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">
                <Minus className="size-3.5" strokeWidth={3} /> Skipped earlier · answer it now
              </span>
            )}
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
          <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans">9</kbd> to choose and{" "}
          <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans">Enter</kbd> to check,{" "}
          <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans">←</kbd>
          <kbd className="ml-0.5 rounded border border-line bg-surface px-1.5 py-0.5 font-sans">→</kbd> to move between questions
        </p>
      </main>

      {/* Bottom action area */}
      <div className="sticky bottom-0 z-20">
        <AnimatePresence mode="wait" initial={false}>
          {reveal && shownAttempt ? (
            <FeedbackSheet
              key={`${s.phase}-${q.id}`}
              attempt={shownAttempt}
              streak={s.streak}
              explanation={q.explanation ?? ""}
              onNext={() => s.next()}
              review={s.phase === "review"}
              nextLabel={
                s.phase === "review" && s.index + 1 <= reached && s.index + 1 < s.questions.length
                  ? "Next question"
                  : lastStop
                    ? "See results"
                    : "Continue"
              }
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
              {s.notice && !s.checkFailed && (
                <p role="status" className="mx-auto max-w-3xl px-4 pt-3 text-sm font-semibold text-muted sm:px-6">
                  {s.notice}
                </p>
              )}
              <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
                <button
                  type="button"
                  disabled={checking}
                  onClick={() => {
                    play("tap");
                    s.skip();
                  }}
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
      {onRestart && (
        <RestartDialog
          open={confirmRestart}
          answered={s.attempts.length}
          onCancel={cancelRestart}
          onConfirm={() => {
            setConfirmRestart(false);
            onRestart();
          }}
        />
      )}
      <SkippedDialog
        open={s.endPrompt && !s.finishing}
        count={skipped.length}
        onAnswer={() => {
          s.closeEndPrompt();
          if (skipped[0] !== undefined) s.goTo(skipped[0]);
        }}
        onFinish={() => void s.finish()}
        onClose={s.closeEndPrompt}
      />
      <AnimatePresence>
        {s.finishing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-bg/70 backdrop-blur-sm"
            role="status"
          >
            <span className="flex items-center gap-2 font-display text-lg font-bold">
              <Loader2 className="size-6 animate-spin text-brand" /> Getting your results…
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
