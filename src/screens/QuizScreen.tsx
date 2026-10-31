import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileQuestion,
  Loader2,
  Lock,
  Send,
  Share2,
  Target,
  Timer,
  Trophy,
  Users,
  X,
} from "lucide-react";
import clsx from "clsx";
import { region } from "../config/regions";
import type { QuizBoard, QuizInfo, QuizList, QuizResult, QuizSession } from "../content/api";
import type { AnyResponse, ClientQuestion } from "../content/schema";
import { SignInButton } from "../components/Account";
import { Button } from "../components/Button";
import { CountUp } from "../components/CountUp";
import { Figure } from "../components/Figure";
import { QuestionHeader } from "../components/QuestionHeader";
import { Countdown, PhaseBadge, clock, formatWhen, phaseOf, syncClock, useServerNow } from "../components/QuizParts";
import { RichText } from "../components/RichText";
import { SettingsToggles } from "../components/TopBar";
import { initialResponse, isAnswered } from "../engine/scoring";
import { burst } from "../lib/celebrate";
import { renderCertificate } from "../lib/certificate";
import { SITE_ORIGIN } from "../lib/platform";
import { play } from "../lib/sound";
import { QuestionBody } from "../questions";
import { ApiError, api, useAuth } from "../store/auth";
import { takeLinkedQuiz, useNav } from "../store/nav";

type View = { kind: "list" } | { kind: "lobby"; id: string } | { kind: "play"; session: QuizSession } | { kind: "result"; result: QuizResult };

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-2 py-5">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onBack}
        aria-label="Back"
        className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-line bg-surface text-muted hover:text-fg"
      >
        <ArrowLeft className="size-5" />
      </motion.button>
      <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      <SettingsToggles />
    </header>
  );
}

function Modal({ open, onClose, children, labelledBy }: { open: boolean; onClose: () => void; children: ReactNode; labelledBy: string }) {
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
            aria-labelledby={labelledBy}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="w-full max-w-md rounded-t-[28px] border-2 border-line bg-surface p-6 pb-8 text-center shadow-pop sm:rounded-[28px] sm:pb-6"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-3 text-center">
      <Icon className="mx-auto size-5 text-brand" />
      <p className="mt-1 font-display text-xl font-extrabold">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

// ---------- List ----------

function QuizCard({ quiz, now, onOpen, index }: { quiz: QuizInfo; now: number; onOpen: () => void; index: number }) {
  const live = phaseOf(quiz, now) === "live";
  return (
    <motion.li initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
      <motion.button
        type="button"
        onClick={onOpen}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.98 }}
        className={clsx(
          "group flex w-full items-center gap-4 rounded-[24px] border-2 bg-surface p-5 text-left transition",
          live ? "border-bad/50 shadow-pop" : "border-line hover:border-fg/30",
        )}
      >
        <span className={clsx("grid size-14 shrink-0 place-items-center rounded-2xl", live ? "bg-bad text-white" : "bg-brand-soft text-brand")}>
          <Trophy className="size-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <PhaseBadge quiz={quiz} now={now} />
            {quiz.mine?.status === "submitted" && (
              <span className={clsx("rounded-full px-2.5 py-1 text-xs font-extrabold", quiz.mine.passed ? "bg-ok-soft text-ok" : "bg-surface-2 text-muted")}>
                {quiz.mine.passed ? "Passed" : "Taken"} · {quiz.mine.percent}%
              </span>
            )}
          </span>
          <span className="mt-1 block truncate font-display text-lg font-extrabold">{quiz.title}</span>
          <span className="block text-sm text-muted">
            {formatWhen(quiz.startsAt)} · {quiz.questionCount} questions · {quiz.durationMin} min
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-fg" />
      </motion.button>
    </motion.li>
  );
}

function QuizListView({ quizzes, now, onOpen }: { quizzes: QuizInfo[]; now: number; onOpen: (id: string) => void }) {
  const groups: { title: string; items: QuizInfo[] }[] = [
    { title: "Live now", items: quizzes.filter((q) => phaseOf(q, now) === "live") },
    { title: "Coming up", items: quizzes.filter((q) => phaseOf(q, now) === "upcoming") },
    { title: "Ended", items: quizzes.filter((q) => phaseOf(q, now) === "ended").reverse() },
  ];
  return (
    <>
      <motion.section
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative mb-8 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#2b2f6b] via-[#3d3a8f] to-[#7b3fbf] p-6 text-white shadow-pop sm:p-8"
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute rounded-full bg-white/10"
            style={{ width: 80 + i * 60, height: 80 + i * 60, right: -20 + i * 40, top: -30 + i * 30 }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3 + i, repeat: Infinity }}
          />
        ))}
        <motion.span
          className="relative grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-[#ffd23f] to-[#ff8a1f] text-[#2b2f6b] shadow-pop"
          animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1 }}
        >
          <Award className="size-9" />
        </motion.span>
        <h2 className="relative mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Take the challenge. Win the certificate.</h2>
        <p className="relative mt-2 max-w-xl text-white/80">
          Join live quizzes with students across India. Reach the pass mark and you get a certificate of achievement with your name on it. Free!
        </p>
      </motion.section>
      {quizzes.length === 0 ? (
        <p className="rounded-[24px] border-2 border-line bg-surface p-8 text-center font-semibold text-muted">No quizzes scheduled yet. Check back soon! 📅</p>
      ) : (
        groups
          .filter((g) => g.items.length)
          .map((g) => (
            <section key={g.title} className="mb-8">
              <h2 className="mb-3 font-display text-xl font-extrabold">{g.title}</h2>
              <ul className="grid gap-3">
                {g.items.map((q, i) => (
                  <QuizCard key={q.id} quiz={q} now={now} index={i} onOpen={() => onOpen(q.id)} />
                ))}
              </ul>
            </section>
          ))
      )}
    </>
  );
}

// ---------- Lobby ----------

function SignInToJoin({ text }: { text: string }) {
  const status = useAuth((s) => s.status);
  if (status === "unavailable") return <p className="text-center text-muted">Sign-in isn't available right now. Please try again later.</p>;
  if (status === "loading") return null;
  return (
    <div className="rounded-2xl border-2 border-dashed border-brand/50 bg-brand-soft/50 p-5 text-center">
      <p className="font-display text-lg font-extrabold">{text}</p>
      <p className="mt-1 text-sm text-muted">One tap with Google. 100% free.</p>
      <div className="mt-4">
        <SignInButton />
      </div>
    </div>
  );
}

function Lobby({
  quiz,
  now,
  busy,
  problem,
  onStart,
  onResult,
}: {
  quiz: QuizInfo;
  now: number;
  busy: boolean;
  problem: string | null;
  onStart: () => void;
  onResult: () => void;
}) {
  const signedIn = useAuth((s) => s.status === "signedIn");
  const phase = phaseOf(quiz, now);
  const mine = quiz.mine;
  const inProgress = mine?.status === "in_progress" && now < mine.deadline;
  const finished = mine && !inProgress;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5">
      <section className="rounded-[28px] border-2 border-line bg-surface p-6 shadow-card sm:p-8">
        <PhaseBadge quiz={quiz} now={now} />
        <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight">{quiz.title}</h2>
        {quiz.description && <p className="mt-2 whitespace-pre-wrap text-muted">{quiz.description}</p>}
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-muted">
          <CalendarClock className="size-4" /> {formatWhen(quiz.startsAt)} – {formatWhen(quiz.endsAt)}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat icon={FileQuestion} label="Questions" value={quiz.questionCount} />
          <Stat icon={Timer} label="Minutes" value={quiz.durationMin} />
          <Stat icon={Target} label="Pass mark" value={`${quiz.passPercent}%`} />
          <Stat icon={Users} label="Joined" value={quiz.participants} />
        </div>
      </section>

      {phase === "upcoming" && (
        <section className="rounded-[28px] border-2 border-line bg-surface p-6 text-center sm:p-8">
          <p className="mb-4 font-display text-lg font-extrabold">The quiz opens in</p>
          <Countdown to={quiz.startsAt} now={now} />
          <p className="mt-4 text-sm text-muted">Come back at {formatWhen(quiz.startsAt)}. The Start button appears right here.</p>
          {!signedIn && (
            <div className="mt-5">
              <SignInToJoin text="Sign in now, so you're ready when it starts" />
            </div>
          )}
        </section>
      )}

      {finished && (
        <Button className="w-full py-4 text-lg" onClick={onResult} disabled={busy}>
          <Trophy className="size-5" /> {busy ? "Loading…" : "See my result"}
        </Button>
      )}

      {phase === "live" && !finished && (
        <section className="rounded-[28px] border-2 border-line bg-surface p-6 sm:p-8">
          {!signedIn ? (
            <SignInToJoin text="Sign in to take part and win a certificate" />
          ) : (
            <>
              {!inProgress && (
                <>
                  <h3 className="font-display text-lg font-extrabold">Before you start</h3>
                  <ul className="mt-3 grid gap-2 text-[15px]">
                    {[
                      `${quiz.questionCount} questions. You get ${quiz.durationMin} minutes from the moment you press Start.`,
                      "The timer keeps running if you leave, so finish in one go.",
                      "Your answers save as you go. Change them any time until you submit.",
                      `Score ${quiz.passPercent}% or more to earn your certificate.`,
                      "One attempt only. Answers are revealed when the quiz ends.",
                    ].map((t) => (
                      <li key={t} className="flex gap-2">
                        <Check className="mt-0.5 size-5 shrink-0 text-ok" /> {t}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <motion.div className="mt-6" animate={busy ? undefined : { scale: [1, 1.03, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
                <Button className="w-full py-4 text-lg" onClick={onStart} disabled={busy}>
                  {busy ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
                  {inProgress ? `Continue · ${clock(mine!.deadline - now)} left` : "Start the quiz"}
                </Button>
              </motion.div>
            </>
          )}
        </section>
      )}

      {phase === "ended" && !mine && (
        <section className="rounded-[28px] border-2 border-line bg-surface p-6 sm:p-8">
          <p className="mb-4 flex items-center gap-2 font-semibold text-muted">
            <Lock className="size-4" /> This quiz has ended. Here's how everyone did.
          </p>
          <Board quizId={quiz.id} />
        </section>
      )}

      {problem && (
        <p role="alert" className="text-center font-semibold text-bad">
          {problem}
        </p>
      )}
    </motion.div>
  );
}

/** "3, 2, 1, Go!" before the first question. */
function StartCountdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  // The page re-renders every second (its clock): the step timer must not restart with it.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    play(n > 0 ? "tick" : "levelup");
    const t = window.setTimeout(() => (n > 0 ? setN(n - 1) : done.current()), n > 0 ? 700 : 500);
    return () => window.clearTimeout(t);
  }, [n]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-gradient-to-br from-[#2b2f6b] via-[#3d3a8f] to-[#7b3fbf]">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={n}
          initial={{ scale: 2.4, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="font-display text-[9rem] font-extrabold text-white drop-shadow-lg"
        >
          {n > 0 ? n : "Go!"}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// ---------- Taking the quiz ----------

function TimerRing({ left, total }: { left: number; total: number }) {
  const frac = Math.max(0, Math.min(1, left / total));
  const tone = left <= 60_000 ? "text-bad" : frac <= 0.25 ? "text-brand" : "text-ok";
  const r = 20;
  return (
    <motion.div
      className={clsx("relative grid size-20 shrink-0 place-items-center sm:size-24", tone)}
      animate={left <= 10_000 && left > 0 ? { scale: [1, 1.12, 1] } : { scale: 1 }}
      transition={{ duration: 1, repeat: left <= 10_000 ? Infinity : 0 }}
      role="timer"
      aria-label={`${clock(left)} left`}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * r}
          strokeDashoffset={2 * Math.PI * r * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.3s linear" }}
        />
      </svg>
      <span className="text-center leading-none">
        <span
          className={clsx(
            "block font-display font-extrabold tabular-nums",
            // "1:02:05" needs smaller digits than "19:56" to stay inside the ring.
            clock(left).length > 5 ? "text-sm sm:text-base" : "text-lg sm:text-xl",
            left <= 60_000 ? "text-bad" : "text-fg",
          )}
        >
          {clock(left)}
        </span>
        <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-muted">left</span>
      </span>
    </motion.div>
  );
}

function QuizPlayer({ session, onFinished, onExit }: { session: QuizSession; onFinished: (r: QuizResult) => void; onExit: () => void }) {
  const { quiz, questions, deadline } = session;
  const [answers, setAnswers] = useState<Record<string, AnyResponse>>(session.answers);
  const answered = (q: ClientQuestion) => isAnswered(q, answers[q.id]);
  const [index, setIndex] = useState(() => Math.max(0, questions.findIndex((q) => !isAnswered(q, session.answers[q.id]))));
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(0);
  const [unsaved, setUnsaved] = useState(false);
  const [confirm, setConfirm] = useState<"submit" | "leave" | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const now = useServerNow(250);
  const left = deadline - now;

  /** Answers not yet sent (or whose sending failed), by question. */
  const dirty = useRef(new Map<string, AnyResponse | null>());
  const timers = useRef(new Map<string, number>());
  const finishingRef = useRef(false);
  const lastTick = useRef(-1);

  const send = useCallback(
    async (id: string) => {
      window.clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      if (!dirty.current.has(id)) return;
      const response = dirty.current.get(id)!;
      dirty.current.delete(id);
      setSaving((n) => n + 1);
      try {
        await api("/api/quizzes/answer", { quizId: quiz.id, questionId: id, response });
      } catch (e) {
        // Kept to send again, unless a newer answer is already waiting. Time's up (409) is handled by the timer.
        if (!(e instanceof ApiError && e.status === 409) && !dirty.current.has(id)) dirty.current.set(id, response);
      } finally {
        setSaving((n) => n - 1);
        setUnsaved(dirty.current.size > 0);
      }
    },
    [quiz.id],
  );

  const flush = useCallback(() => Promise.all([...new Set([...dirty.current.keys(), ...timers.current.keys()])].map((id) => send(id))), [send]);

  const change = useCallback(
    (id: string, r: AnyResponse) => {
      setAnswers((a) => ({ ...a, [id]: r }));
      dirty.current.set(id, r);
      setUnsaved(true);
      window.clearTimeout(timers.current.get(id));
      // Dragging an order or match question changes it many times a second: send once it settles.
      timers.current.set(id, window.setTimeout(() => void send(id), 600));
    },
    [send],
  );

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    setProblem(null);
    await flush();
    try {
      onFinished(await api<QuizResult>("/api/quizzes/submit", { quizId: quiz.id }));
    } catch (e) {
      finishingRef.current = false;
      setFinishing(false);
      setProblem(errorText(e, "Couldn't submit. Check your connection and try again."));
    }
  }, [flush, onFinished, quiz.id]);

  // An order question counts as answered as it starts: save that arrangement once it has been seen.
  const q = questions[index];
  useEffect(() => {
    if (q?.type === "order" && answers[q.id] === undefined) change(q.id, initialResponse(q)!);
  }, [q, answers, change]);

  // The last ten seconds tick; at zero the quiz hands itself in.
  useEffect(() => {
    const s = Math.ceil(left / 1000);
    if (s <= 10 && s > 0 && s !== lastTick.current) {
      lastTick.current = s;
      play("tick");
    }
    if (left <= 0 && !finishingRef.current) {
      setTimeUp(true);
      setConfirm(null);
      void finish();
    }
  }, [left, finish]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    const t = timers.current;
    return () => {
      window.removeEventListener("beforeunload", warn);
      for (const id of t.values()) window.clearTimeout(id);
    };
  }, []);

  const goTo = (i: number) => {
    if (i < 0 || i >= questions.length || i === index) return;
    play("tap");
    setDir(i > index ? 1 : -1);
    setIndex(i);
  };

  const done = questions.filter(answered).length;
  const unanswered = questions.length - done;
  const allAnswered = unanswered === 0;
  const last = index === questions.length - 1;
  /** On the last question with some left unanswered, the big button goes back to the first of them. */
  const firstUnanswered = questions.findIndex((x) => !answered(x));

  return (
    <div className="min-h-dvh">
      <div className="sticky top-0 z-20 border-b-2 border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setConfirm("leave")}
            aria-label="Leave the quiz"
            className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-line bg-surface text-muted hover:text-fg"
          >
            <X className="size-5" />
          </motion.button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display font-extrabold">{quiz.title}</p>
            <p className="text-xs font-semibold text-muted">
              {done} of {questions.length} answered ·{" "}
              {saving > 0 ? "Saving…" : unsaved ? <span className="text-bad">Not saved yet, retrying</span> : <span className="text-ok">All saved ✓</span>}
            </p>
          </div>
          <TimerRing left={left} total={quiz.durationMin * 60_000} />
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6" role="tablist" aria-label="Questions">
          {questions.map((x, i) => (
            <motion.button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Question ${i + 1}${answered(x) ? ", answered" : ""}`}
              onClick={() => goTo(i)}
              whileTap={{ scale: 0.85 }}
              className={clsx(
                "grid h-8 min-w-8 shrink-0 place-items-center rounded-lg border-2 text-xs font-extrabold tabular-nums transition",
                answered(x) ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-muted",
                i === index && "ring-2 ring-fg ring-offset-2 ring-offset-bg",
              )}
            >
              {i + 1}
            </motion.button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-5 pb-32 sm:px-6">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.article
            key={q.id}
            custom={dir}
            initial={{ opacity: 0, x: 60 * dir, rotate: dir }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: -60 * dir, rotate: -dir }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="rounded-[28px] border-2 border-line bg-surface p-4 shadow-card sm:p-8"
          >
            <QuestionHeader q={q} />
            <p className="mt-3 font-display text-sm font-extrabold text-brand">
              Question {index + 1} of {questions.length}
            </p>
            <h2 className="mt-2 text-xl font-semibold leading-relaxed sm:text-[22px]">
              <RichText text={q.prompt} />
            </h2>
            {q.image && q.type !== "hotspot" && <Figure media={q.image} className="mt-5" />}
            <div className="mt-6">
              <QuestionBody q={q} response={answers[q.id] ?? initialResponse(q)} onChange={(r) => change(q.id, r)} reveal={false} />
            </div>
          </motion.article>
        </AnimatePresence>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <Button variant="ghost" className="px-4" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous question">
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            variant="dark"
            className="px-4 sm:px-5"
            onClick={() => setConfirm("submit")}
            disabled={finishing || !allAnswered}
            title={allAnswered ? undefined : "Answer every question to submit"}
            aria-label={allAnswered ? "Submit" : `Submit (answer every question first, ${unanswered} left)`}
          >
            <Send className="size-5" /> <span className="hidden min-[400px]:inline">{allAnswered ? "Submit" : `${unanswered} left`}</span>
          </Button>
          {!last ? (
            <Button className="flex-1" onClick={() => goTo(index + 1)}>
              Next <ChevronRight className="size-5" />
            </Button>
          ) : allAnswered ? (
            <Button variant="ok" className="flex-1" onClick={() => setConfirm("submit")} disabled={finishing}>
              <Send className="size-5" /> Submit
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => goTo(firstUnanswered)}>
              Go to question {firstUnanswered + 1} <ChevronRight className="size-5" />
            </Button>
          )}
        </div>
      </div>

      <Modal open={confirm === "submit"} onClose={() => setConfirm(null)} labelledBy="quiz-submit-title">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-soft">
          <Send className="size-7 text-brand" />
        </motion.span>
        <h2 id="quiz-submit-title" className="mt-4 font-display text-2xl font-extrabold">
          Submit your answers?
        </h2>
        <p className="mt-1 text-muted">
          You've answered all {questions.length} questions. You can't change your answers after this.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)}>
            Keep going
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setConfirm(null);
              void finish();
            }}
          >
            Submit
          </Button>
        </div>
      </Modal>

      <Modal open={confirm === "leave"} onClose={() => setConfirm(null)} labelledBy="quiz-leave-title">
        <h2 id="quiz-leave-title" className="font-display text-2xl font-extrabold">
          Leave the quiz?
        </h2>
        <p className="mt-1 text-muted">Your answers are saved, but the timer keeps running. Come back before it runs out to finish.</p>
        <div className="mt-6 flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)}>
            Stay
          </Button>
          <Button
            variant="dark"
            className="flex-1"
            onClick={() => {
              setConfirm(null);
              void flush().then(onExit);
            }}
          >
            Leave
          </Button>
        </div>
      </Modal>

      <AnimatePresence>
        {(finishing || problem) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-6 text-center backdrop-blur-sm"
            role="status"
          >
            <div>
              {timeUp && (
                <motion.p
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16 }}
                  className="mb-4 font-display text-5xl font-extrabold text-bad"
                >
                  Time's up! ⏰
                </motion.p>
              )}
              {problem ? (
                <>
                  <p className="font-semibold text-bad">{problem}</p>
                  <Button className="mt-4" onClick={() => void finish()}>
                    Try again
                  </Button>
                </>
              ) : (
                <p className="flex items-center justify-center gap-2 font-display text-lg font-bold">
                  <Loader2 className="size-6 animate-spin text-brand" /> Marking your answers…
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Result ----------

function ScoreRing({ percent, passed }: { percent: number; passed: boolean }) {
  const r = 70;
  return (
    <div className="relative mx-auto grid size-48 place-items-center">
      <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" className="stroke-surface-2" strokeWidth="14" />
        <motion.circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          className={passed ? "stroke-ok" : "stroke-brand"}
          strokeWidth="14"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: percent / 100 }}
          transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      <div className="text-center">
        <CountUp value={percent} format={(v) => `${Math.round(v)}%`} className="font-display text-5xl font-extrabold" />
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Score</p>
      </div>
    </div>
  );
}

function CertificateCard({ result }: { result: QuizResult }) {
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const cert = result.certificate!;

  useEffect(() => {
    let live = true;
    let url: string | null = null;
    renderCertificate(cert)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (live) setCard({ blob, url });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [cert]);

  const file = card ? new File([card.blob], "vijayeemantra-certificate.png", { type: "image/png" }) : null;
  const text = `🏅 I passed "${cert.quizTitle}" on ${region.appName} with ${cert.percent}%! Join the next quiz: ${SITE_ORIGIN}`;
  const canShare = !!file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  const download = () => {
    if (!card) return;
    const a = document.createElement("a");
    a.href = card.url;
    a.download = "vijayeemantra-certificate.png";
    a.click();
  };
  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text });
      burst(null, true);
    } catch {
      // Share menu closed.
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, rotateX: 60, y: 40 }}
      animate={{ opacity: 1, rotateX: 0, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.9 }}
      style={{ transformPerspective: 1000 }}
      className="rounded-[28px] border-2 border-[#c8962a]/50 bg-surface p-5 shadow-pop sm:p-6"
    >
      <h3 className="flex items-center gap-2 font-display text-xl font-extrabold">
        <Award className="size-6 text-[#c8962a]" /> Your certificate of achievement
      </h3>
      <div className="mt-4 overflow-hidden rounded-2xl border-2 border-line bg-surface-2">
        {card ? (
          <img src={card.url} alt={`Certificate of achievement for ${cert.name}, ${cert.quizTitle}, ${cert.percent}%`} className="block w-full" />
        ) : (
          <div className="grid aspect-[2000/1414] place-items-center text-muted">{failed ? "Couldn't draw the certificate." : <Loader2 className="size-8 animate-spin" />}</div>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">Certificate no. {cert.id}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {canShare && (
          <Button className="flex-1" onClick={() => void share()}>
            <Share2 className="size-5" /> Share
          </Button>
        )}
        <Button variant={canShare ? "ghost" : "primary"} className="flex-1" onClick={download} disabled={!card}>
          <Download className="size-5" /> Download
        </Button>
      </div>
    </motion.section>
  );
}

function Board({ quizId }: { quizId: string }) {
  const [board, setBoard] = useState<QuizBoard | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<QuizBoard>(`/api/quizzes/board?quiz=${encodeURIComponent(quizId)}`)
      .then((b) => live && setBoard(b))
      .catch((e: unknown) => live && setProblem(errorText(e, "Couldn't load the leaderboard.")));
    return () => {
      live = false;
    };
  }, [quizId]);
  if (problem) return <p className="text-center text-muted">{problem}</p>;
  if (!board) return <Loader2 className="mx-auto size-8 animate-spin text-muted" />;
  if (!board.entries.length) return <p className="text-center text-muted">Nobody finished this quiz.</p>;
  return (
    <ol className="grid gap-2">
      {board.entries.map((e, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(i, 10) * 0.04 }}
          className={clsx("flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5", e.isMe ? "border-brand bg-brand-soft" : "border-line bg-surface")}
        >
          <span className="w-8 text-center font-display text-lg font-extrabold">{["🥇", "🥈", "🥉"][e.rank - 1] ?? e.rank}</span>
          {e.picture ? (
            <img src={e.picture} alt="" referrerPolicy="no-referrer" className="size-9 rounded-full object-cover" />
          ) : (
            <span className="grid size-9 place-items-center rounded-full bg-brand font-display font-extrabold text-brand-ink">{e.name.charAt(0).toUpperCase()}</span>
          )}
          <span className="min-w-0 flex-1 truncate font-semibold">
            {e.name}
            {e.isMe && " (you)"}
          </span>
          {e.passed && <Award className="size-4 shrink-0 text-[#c8962a]" aria-label="Passed" />}
          <span className="text-right">
            <span className="block font-display font-extrabold tabular-nums">{e.percent}%</span>
            <span className="block text-xs tabular-nums text-muted">{clock(e.timeTakenMs)}</span>
          </span>
        </motion.li>
      ))}
    </ol>
  );
}

function Review({ result }: { result: QuizResult }) {
  return (
    <ol className="grid gap-4">
      {result.review!.map(({ question: q, response, correct }, i) => (
        <li key={q.id} className="rounded-[24px] border-2 border-line bg-surface p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <span className={clsx("grid size-7 place-items-center rounded-full text-white", correct ? "bg-ok" : "bg-bad")}>
              {correct ? <Check className="size-4" strokeWidth={3} /> : <X className="size-4" strokeWidth={3} />}
            </span>
            <span className="font-display font-extrabold">Question {i + 1}</span>
            {response === undefined && <span className="text-sm text-muted">· not answered</span>}
          </div>
          <div className="mt-3 text-lg font-semibold leading-relaxed">
            <RichText text={q.prompt} />
          </div>
          {q.image && q.type !== "hotspot" && <Figure media={q.image} className="mt-4" />}
          <div className="mt-4">
            <QuestionBody q={q} response={response ?? initialResponse(q)} onChange={() => undefined} reveal />
          </div>
          {q.explanation && (
            <div className="mt-4 rounded-2xl bg-surface-2 p-4 text-[15px] leading-relaxed">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                <BookOpen className="size-3.5" /> Explanation
              </p>
              <RichText text={q.explanation} />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function ResultView({ result }: { result: QuizResult }) {
  const go = useNav((s) => s.go);
  const [tab, setTab] = useState<"answers" | "board">("answers");
  const ended = !!result.review;

  useEffect(() => {
    if (!result.passed) return;
    play("levelup");
    burst(null, true);
    const t = window.setTimeout(() => burst(null, true), 900);
    return () => window.clearTimeout(t);
  }, [result.passed]);

  return (
    <div className="grid gap-5">
      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-[28px] border-2 border-line bg-surface p-6 text-center shadow-card sm:p-8"
      >
        <ScoreRing percent={result.percent} passed={result.passed} />
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className={clsx("mt-4 font-display text-3xl font-extrabold", result.passed ? "text-ok" : "text-fg")}
        >
          {result.passed ? "You passed! 🎉" : "Good effort! 💪"}
        </motion.h2>
        <p className="mt-1 text-muted">
          {result.passed
            ? "Brilliant work. Your certificate is ready below."
            : `The pass mark was ${result.quiz.passPercent}%. Keep practising and win the next one!`}
        </p>
        <div className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-2.5">
          <Stat icon={Check} label="Correct" value={`${result.correct}/${result.total}`} />
          <Stat icon={Clock} label="Time" value={clock(result.timeTakenMs)} />
          <Stat icon={Trophy} label={ended ? "Rank" : "Rank so far"} value={`#${result.rank}`} />
        </div>
        <p className="mt-2 text-xs text-muted">
          Out of {result.finished} student{result.finished === 1 ? "" : "s"} who {ended ? "finished" : result.finished === 1 ? "has finished so far" : "have finished so far"}
        </p>
      </motion.section>

      {result.certificate && <CertificateCard result={result} />}

      {!result.passed && (
        <Button variant="dark" onClick={() => go("home")}>
          <BookOpen className="size-5" /> Practise chapters for the next quiz
        </Button>
      )}

      {ended ? (
        <section>
          <div role="tablist" className="mb-4 flex gap-2">
            {(
              [
                ["answers", "Answers"],
                ["board", "Leaderboard"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={clsx("rounded-full border-2 px-4 py-1.5 text-sm font-bold transition", tab === k ? "border-fg bg-fg text-bg" : "border-line bg-surface")}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "answers" ? <Review result={result} /> : <Board quizId={result.quiz.id} />}
        </section>
      ) : (
        <p className="flex items-center justify-center gap-2 rounded-2xl bg-surface-2 p-4 text-center text-sm font-semibold text-muted">
          <Lock className="size-4 shrink-0" /> The answers and the leaderboard open when the quiz ends, {formatWhen(result.quiz.endsAt)}.
        </p>
      )}
    </div>
  );
}

// ---------- The page ----------

export function QuizScreen() {
  const go = useNav((s) => s.go);
  const authStatus = useAuth((s) => s.status);
  const [quizzes, setQuizzes] = useState<QuizInfo[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // A shared /quiz/<id> link opens that quiz's page straight away.
  const [view, setView] = useState<View>(() => {
    const id = takeLinkedQuiz();
    return id ? { kind: "lobby", id } : { kind: "list" };
  });
  const [busy, setBusy] = useState(false);
  const [actionProblem, setActionProblem] = useState<string | null>(null);
  const [counting, setCounting] = useState<QuizSession | null>(null);
  const now = useServerNow();

  const load = useCallback(async () => {
    setProblem(null);
    try {
      const r = await api<QuizList>("/api/quizzes");
      syncClock(r.now);
      setQuizzes(r.quizzes);
    } catch (e) {
      setProblem(errorText(e, "Couldn't load the quizzes."));
    }
  }, []);

  // Again after signing in or out: the list carries the student's own attempts.
  useEffect(() => {
    if (authStatus !== "loading") void load();
  }, [load, authStatus]);

  const openResult = async (id: string) => {
    setBusy(true);
    setActionProblem(null);
    try {
      setView({ kind: "result", result: await api<QuizResult>(`/api/quizzes/result?quiz=${encodeURIComponent(id)}`) });
      window.scrollTo({ top: 0 });
    } catch (e) {
      setActionProblem(errorText(e, "Couldn't load your result."));
    } finally {
      setBusy(false);
    }
  };

  const start = async (quiz: QuizInfo) => {
    setBusy(true);
    setActionProblem(null);
    const resuming = quiz.mine?.status === "in_progress";
    try {
      const session = await api<QuizSession>("/api/quizzes/start", { quizId: quiz.id });
      syncClock(session.now);
      if (resuming) setView({ kind: "play", session });
      else setCounting(session);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && /finished/.test(e.message)) {
        await load();
        void openResult(quiz.id);
      } else setActionProblem(errorText(e, "Couldn't start the quiz."));
    } finally {
      setBusy(false);
    }
  };

  const backToList = () => {
    // Off a shared quiz's address, so a reload shows the list.
    if (window.location.pathname !== "/quiz") window.history.replaceState(window.history.state, "", "/quiz");
    setView({ kind: "list" });
    setActionProblem(null);
    void load();
  };

  if (view.kind === "play") {
    return (
      <QuizPlayer
        session={view.session}
        onExit={backToList}
        onFinished={(result) => {
          setView({ kind: "result", result });
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  const quiz = view.kind === "lobby" ? quizzes?.find((q) => q.id === view.id) : undefined;
  const title = view.kind === "result" ? view.result.quiz.title : view.kind === "lobby" ? (quiz?.title ?? "Live quizzes") : "Live quizzes";

  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <PageHeader title={title} onBack={() => (view.kind === "list" ? go("home") : backToList())} />
        {problem ? (
          <div className="rounded-[24px] border-2 border-line bg-surface p-6 text-center">
            <p className="font-semibold">{problem}</p>
            <Button variant="ghost" className="mt-4" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : !quizzes ? (
          <div className="grid place-items-center py-24" role="status" aria-label="Loading">
            <div className="size-10 animate-spin rounded-full border-4 border-line border-t-brand" />
          </div>
        ) : view.kind === "result" ? (
          <ResultView result={view.result} />
        ) : view.kind === "lobby" && quiz ? (
          <Lobby quiz={quiz} now={now} busy={busy} problem={actionProblem} onStart={() => void start(quiz)} onResult={() => void openResult(quiz.id)} />
        ) : (
          <QuizListView
            quizzes={quizzes}
            now={now}
            onOpen={(id) => {
              setView({ kind: "lobby", id });
              setActionProblem(null);
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      </div>
      {counting && (
        <StartCountdown
          onDone={() => {
            setView({ kind: "play", session: counting });
            setCounting(null);
          }}
        />
      )}
    </div>
  );
}
