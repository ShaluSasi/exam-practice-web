import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Award, BookOpen, ChartColumn, ChevronRight, Download, Gamepad2, Loader2, Medal, Rocket, Sparkles, Trophy } from "lucide-react";
import clsx from "clsx";
import { region } from "../config/regions";
import type { MyQuizzes, QuizInfo, QuizList } from "../content/api";
import { downloadCertificate } from "../lib/certificate";
import { api, useAuth } from "../store/auth";
import { openQuiz, useNav } from "../store/nav";
import { clock, phaseOf, syncClock, until, useServerNow } from "./QuizParts";

/*
 * After a quiz, the way back into the rest of the site: the student's quiz
 * history with their certificates (home page and quiz page), and animated
 * "what next" banners on the result page.
 */

type Entry = MyQuizzes["entries"][number];

/** A sweep of light across a card, now and then. */
function Shine({ delay = 0 }: { delay?: number }) {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/40 to-transparent"
      initial={{ x: "0%" }}
      animate={{ x: "450%" }}
      transition={{ duration: 1.6, delay, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
    />
  );
}

function CertificateButton({ entry }: { entry: Entry }) {
  const [busy, setBusy] = useState(false);
  if (!entry.certificate) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        setBusy(true);
        void downloadCertificate(entry.certificate!).finally(() => setBusy(false));
      }}
      className="inline-flex items-center gap-1.5 rounded-xl bg-[#c8962a] px-3 py-1.5 text-xs font-extrabold text-white shadow-[0_3px_0_0_rgb(0_0_0/0.18)] transition hover:brightness-110 disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />} Certificate
    </button>
  );
}

function TrophyCard({ entry, index, onOpen }: { entry: Entry; index: number; onOpen: () => void }) {
  const passed = entry.passed;
  return (
    <motion.li
      initial={{ opacity: 0, y: 20, rotate: -2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay: index * 0.07 }}
      whileHover={{ y: -4, rotate: index % 2 ? 1 : -1 }}
      className="w-64 shrink-0 snap-start"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
        className={clsx(
          "relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[22px] border-2 p-4 text-left shadow-card transition",
          passed ? "border-[#c8962a]/50 bg-gradient-to-br from-[#fff6dc] to-surface dark:from-[#3a2f12]" : "border-line bg-surface",
        )}
      >
        {passed && <Shine delay={index * 0.5} />}
        <div className="flex items-center gap-3">
          <motion.span
            className={clsx("grid size-12 shrink-0 place-items-center rounded-2xl", passed ? "bg-gradient-to-br from-[#ffd23f] to-[#c8962a] text-white" : "bg-surface-2 text-muted")}
            animate={passed ? { rotate: [0, -8, 8, 0] } : undefined}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 + index }}
          >
            {passed ? <Award className="size-6" /> : <Medal className="size-6" />}
          </motion.span>
          <div className="min-w-0">
            <p className="font-display text-2xl font-extrabold tabular-nums">{entry.percent}%</p>
            <p className={clsx("text-xs font-extrabold uppercase tracking-wider", passed ? "text-[#a87a1a]" : "text-muted")}>{passed ? "Passed" : "Taken"}</p>
          </div>
        </div>
        <p className="mt-3 line-clamp-2 font-display font-extrabold leading-snug">{entry.quiz.title}</p>
        <p className="mt-1 text-xs text-muted">
          {new Date(entry.finishedAt).toLocaleDateString(region.locale, { day: "numeric", month: "short", year: "numeric" })} · {entry.correct}/{entry.total} correct ·{" "}
          {clock(entry.timeTakenMs)}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-3">
          <CertificateButton entry={entry} />
          <span className="ml-auto inline-flex items-center text-xs font-bold text-muted">
            Result <ChevronRight className="size-3.5" />
          </span>
        </div>
      </div>
    </motion.li>
  );
}

/**
 * The student's quiz history as a shelf of trophies, with certificate downloads.
 * Hidden for guests and for students who have not finished a quiz yet.
 */
export function MyQuizzesShelf({ onOpen = openQuiz, className }: { onOpen?: (quizId: string) => void; className?: string }) {
  const signedIn = useAuth((s) => s.status === "signedIn");
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    if (!signedIn) return setEntries(null);
    let live = true;
    api<MyQuizzes>("/api/quizzes/mine")
      .then((r) => live && setEntries(r.entries))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [signedIn]);

  if (!entries?.length) return null;
  const certificates = entries.filter((e) => e.certificate).length;
  return (
    <section className={clsx("mb-8", className)}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-extrabold sm:text-2xl">
            <Trophy className="size-6 text-[#c8962a]" /> My quizzes
          </h2>
          <p className="text-sm text-muted">
            {entries.length} quiz{entries.length === 1 ? "" : "zes"} taken · {certificates} certificate{certificates === 1 ? "" : "s"} won
          </p>
        </div>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
        {entries.map((e, i) => (
          <TrophyCard key={e.quiz.id} entry={e} index={i} onOpen={() => onOpen(e.quiz.id)} />
        ))}
      </ul>
    </section>
  );
}

const EXPLORE = [
  {
    key: "chapters",
    icon: BookOpen,
    title: "Practise every chapter",
    text: "50 questions per chapter with instant feedback, XP and streaks.",
    cta: "Start practising",
    gradient: "from-[#ff8a1f] to-[#ff5f6d]",
  },
  {
    key: "games",
    icon: Gamepad2,
    title: "Play brain games",
    text: "Galaxy Guardian, Number Rush, Element Lab and more.",
    cta: "Play now",
    gradient: "from-[#5b5ef0] to-[#a24ee8]",
  },
  {
    key: "board",
    icon: Trophy,
    title: "Climb the leaderboard",
    text: "See where you rank among students this week.",
    cta: "See rankings",
    gradient: "from-[#f5b301] to-[#ff8a1f]",
  },
  {
    key: "progress",
    icon: ChartColumn,
    title: "Find your weak spots",
    text: "Your progress in every chapter, and what to practise next.",
    cta: "My progress",
    gradient: "from-[#0f9f5f] to-[#0b93d4]",
  },
] as const;

/** The next quiz to open, other than `exceptId`. */
function useNextQuiz(exceptId?: string): QuizInfo | null {
  const [next, setNext] = useState<QuizInfo | null>(null);
  useEffect(() => {
    let live = true;
    api<QuizList>("/api/quizzes")
      .then((r) => {
        syncClock(r.now);
        const open = r.quizzes
          .filter((q) => q.id !== exceptId && !q.mine && phaseOf(q, r.now) !== "ended")
          .sort((a, b) => a.startsAt - b.startsAt);
        if (live) setNext(open[0] ?? null);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [exceptId]);
  return next;
}

/** Result page: animated invitations into the rest of the site, and the next quiz. */
export function ExploreMore({ quizId, passed }: { quizId: string; passed: boolean }) {
  const go = useNav((s) => s.go);
  const next = useNextQuiz(quizId);
  const now = useServerNow();

  const open = (key: (typeof EXPLORE)[number]["key"]) => {
    if (key === "board" || key === "progress") return go(key);
    go("home");
    // Home renders after the page transition, and its chapters and images can still move the section down: scroll, then once more.
    const scroll = () => document.getElementById(key)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(scroll, 450);
    window.setTimeout(() => {
      const top = document.getElementById(key)?.getBoundingClientRect().top;
      if (top !== undefined && Math.abs(top) > 40) scroll();
    }, 1300);
  };

  return (
    <section className="grid gap-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#2b2f6b] via-[#3d3a8f] to-[#7b3fbf] p-6 text-white shadow-pop sm:p-8"
      >
        {[...Array(6)].map((_, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute text-white/30"
            style={{ left: `${10 + i * 15}%`, top: `${15 + ((i * 37) % 60)}%` }}
            animate={{ y: [0, -12, 0], opacity: [0.3, 0.8, 0.3], scale: [1, 1.3, 1] }}
            transition={{ duration: 2.5 + i * 0.4, repeat: Infinity, delay: i * 0.3 }}
          >
            <Sparkles className="size-4" />
          </motion.span>
        ))}
        <motion.span
          className="relative grid size-14 place-items-center rounded-2xl bg-white/15"
          animate={{ y: [0, -6, 0], rotate: [0, 6, 0] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          <Rocket className="size-7" />
        </motion.span>
        <h3 className="relative mt-4 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {passed ? "You're a champion. Keep the streak going!" : "Every quiz makes you stronger. Keep going!"}
        </h3>
        <p className="relative mt-1 max-w-xl text-white/80">
          {region.appName} has free practice for every Class 9 and 10 chapter, brain games and leaderboards. Get ready for the next quiz.
        </p>
      </motion.div>

      {next && (
        <motion.button
          type="button"
          onClick={() => openQuiz(next.id)}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          className="group relative flex items-center gap-4 overflow-hidden rounded-[24px] border-2 border-brand/40 bg-brand-soft p-4 text-left sm:p-5"
        >
          <Shine />
          <motion.span
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-brand-ink"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            <Trophy className="size-6" />
          </motion.span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-extrabold uppercase tracking-wider text-brand">
              {phaseOf(next, now) === "live" ? "Live now · next quiz" : `Next quiz · starts ${until(next.startsAt - now)}`}
            </span>
            <span className="block truncate font-display text-lg font-extrabold">{next.title}</span>
            <span className="block text-sm text-muted">Win another certificate 🏅</span>
          </span>
          <ChevronRight className="size-6 shrink-0 text-brand transition group-hover:translate-x-1" />
        </motion.button>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {EXPLORE.map((e, i) => (
          <motion.li
            key={e.key}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 220, damping: 20, delay: i * 0.08 }}
          >
            <motion.button
              type="button"
              onClick={() => open(e.key)}
              whileHover={{ y: -4, rotate: i % 2 ? 0.8 : -0.8 }}
              whileTap={{ scale: 0.97 }}
              className={clsx("group relative flex h-full w-full flex-col overflow-hidden rounded-[24px] bg-gradient-to-br p-5 text-left text-white shadow-pop", e.gradient)}
            >
              <Shine delay={1 + i * 0.7} />
              <motion.span
                className="grid size-12 place-items-center rounded-2xl bg-white/20"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2 + i * 0.3, repeat: Infinity }}
              >
                <e.icon className="size-6" />
              </motion.span>
              <span className="mt-3 block font-display text-xl font-extrabold">{e.title}</span>
              <span className="mt-1 block text-sm text-white/85">{e.text}</span>
              <span className="mt-4 inline-flex items-center gap-1 self-start rounded-xl bg-white px-3 py-1.5 font-display text-sm font-extrabold text-fg">
                {e.cta} <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
              </span>
            </motion.button>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
