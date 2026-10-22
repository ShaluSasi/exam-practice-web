import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Award, BookOpen, Check, Flame, Play, RefreshCw, RotateCcw, Sparkles, Target, Trophy, WifiOff, Zap } from "lucide-react";
import clsx from "clsx";
import { offeredGrades, region } from "../config/regions";
import type { ChapterInfo } from "../content/api";
import type { SubjectId } from "../content/schema";
import { Button } from "../components/Button";
import { RichText } from "../components/RichText";
import { Logo, SettingsToggles, XpPill } from "../components/TopBar";
import { ROUND_SIZE } from "../engine/scoring";
import { GamesStrip } from "../games/GamesStrip";
import { SUBJECT_STYLE } from "../lib/subjects";
import { rankRounds, useProfile, useStats } from "../store/profile";
import { useAuth } from "../store/auth";
import { discardSavedRound, useSavedRound } from "../store/progress";
import { useContent, type RoundSource } from "../store/content";
import { useNav } from "../store/nav";
import { TYPE_LABEL } from "../questions";

/** The class whose chapters are open; mixed practice draws from that class only. */
function useCurrentGrade(): number {
  const lastGrade = useProfile((p) => p.lastGrade);
  return lastGrade && offeredGrades.includes(lastGrade) ? lastGrade : offeredGrades[0];
}

const SUBJECT_ORDER = Object.keys(region.subjects) as SubjectId[];

/** Starts a round. With a `key`, an unfinished round for that key is continued instead. */
type StartRound = (source: RoundSource, title: string, key?: string) => void;
const MIXED_KEY = "mixed";
const GLYPHS = [
  { c: "∑", x: "6%", y: "18%", s: 64, d: 7 },
  { c: "π", x: "88%", y: "12%", s: 56, d: 9 },
  { c: "λ", x: "78%", y: "70%", s: 48, d: 8 },
  { c: "√", x: "12%", y: "78%", s: 52, d: 10 },
  { c: "∫", x: "48%", y: "6%", s: 44, d: 11 },
  { c: "Δ", x: "94%", y: "44%", s: 40, d: 7.5 },
];

function FloatingGlyphs() {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {GLYPHS.map((g) => (
        <motion.span
          key={g.c}
          className="absolute font-display font-extrabold text-fg/[0.06]"
          style={{ left: g.x, top: g.y, fontSize: g.s }}
          animate={reduce ? undefined : { y: [0, -18, 0], rotate: [0, 6, 0] }}
          transition={{ duration: g.d, repeat: Infinity, ease: "easeInOut" }}
        >
          {g.c}
        </motion.span>
      ))}
    </div>
  );
}

/** Looping mini demo of the practice flow: pick → correct → XP. */
function HeroDemo() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? 3 : 0);
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % 5), [1400, 700, 900, 1800, 600][step]);
    return () => clearTimeout(t);
  }, [step, reduce]);
  const opts = ["$\\sqrt{16}$", "$\\dfrac{22}{7}$", "$\\sqrt{2}$", "$0.\\overline{3}$"];

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <motion.div
        className="absolute inset-0 -rotate-6 rounded-3xl bg-maths/25"
        animate={reduce ? undefined : { rotate: [-6, -4, -6] }}
        transition={{ duration: 6, repeat: Infinity }}
      />
      <motion.div
        className="absolute inset-0 rotate-3 rounded-3xl bg-brand/30"
        animate={reduce ? undefined : { rotate: [3, 5, 3] }}
        transition={{ duration: 7, repeat: Infinity }}
      />
      <div className="relative rounded-3xl border-2 border-line bg-surface p-5 shadow-pop">
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-full bg-maths/12 px-2.5 py-1 text-xs font-bold text-maths">Maths · Class 9</span>
          <div className="flex items-center gap-1 text-sm font-bold text-brand">
            <Flame className="size-4 fill-brand" /> 4
          </div>
        </div>
        <p className="mb-4 font-semibold">Which of these is irrational?</p>
        <div className="grid grid-cols-2 gap-2">
          {opts.map((o, i) => {
            const picked = i === 2 && step >= 1;
            const right = i === 2 && step >= 2;
            return (
              <motion.div
                key={o}
                animate={right ? { scale: [1, 1.06, 1] } : undefined}
                className={clsx(
                  "flex h-14 items-center justify-center rounded-xl border-2 transition-colors duration-300",
                  right ? "border-ok bg-ok-soft" : picked ? "border-brand bg-brand-soft" : "border-line",
                )}
              >
                <RichText text={o} />
              </motion.div>
            );
          })}
        </div>
        <AnimatePresence>
          {step >= 2 && step <= 3 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-center justify-between rounded-xl bg-ok px-4 py-2.5 font-display font-bold text-white"
            >
              <span className="flex items-center gap-2">
                <Check className="size-5" strokeWidth={3} /> Spot on!
              </span>
              <motion.span initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="flex items-center gap-1">
                <Zap className="size-4 fill-white" /> +15
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
        {(step < 2 || step > 3) && <div className="mt-4 h-[44px]" />}
      </div>
    </div>
  );
}

function Toggle({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <motion.button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={clsx(
        "rounded-2xl border-2 font-display font-bold transition-colors",
        on ? "border-fg bg-fg text-bg" : "border-line bg-surface text-muted hover:border-fg/30 hover:text-fg",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

type Chapter = ChapterInfo;

/** Every chapter, in course order (from the server). */
function useAllChapters(): ChapterInfo[] {
  return useContent((s) => s.catalog?.chapters) ?? [];
}

/** Chapters with enough questions for a full random round get their own quiz card. */
function useChapters(): Chapter[] {
  const all = useAllChapters();
  return useMemo(() => all.filter((c) => c.count >= ROUND_SIZE), [all]);
}

/** One compact, fully tappable row per chapter so a whole subject fits on one screen. */
function ChapterRow({ chapter, onStart, index }: { chapter: Chapter; onStart: StartRound; index: number }) {
  const { rounds } = useStats();
  const best = rankRounds(rounds.filter((r) => r.title === chapter.title))[0];
  const saved = useSavedRound(chapter.key);
  const st = SUBJECT_STYLE[chapter.subject];
  const startNew = () => onStart({ chapter: chapter.key }, chapter.title, chapter.key);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 320, damping: 30 }}
    >
      <motion.button
        type="button"
        onClick={startNew}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="group flex w-full items-center gap-3 rounded-2xl border-2 border-line bg-surface p-2.5 text-left shadow-card transition-colors hover:border-fg/25 sm:gap-4 sm:p-3"
      >
        <span className={clsx("relative grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-xl sm:size-20", st.soft)}>
          {chapter.cover ? (
            <img src={chapter.cover} alt="" className="size-full object-cover" />
          ) : (
            <span className={clsx("font-display text-4xl font-extrabold", st.text)}>{st.glyph}</span>
          )}
          {chapter.no !== undefined && (
            <span className="absolute left-1 top-1 grid size-6 place-items-center rounded-full bg-fg font-display text-xs font-extrabold text-bg shadow-pop">
              {chapter.no}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] font-extrabold leading-tight tracking-tight sm:text-lg">{chapter.title}</h3>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted sm:text-sm">
            <span>{chapter.count} questions</span>
            <span className="flex items-center gap-1">
              <Trophy className="size-3.5 text-brand" />
              {best ? <span className="font-bold text-fg">Best {best.accuracy}%</span> : saved ? null : "Not tried yet"}
            </span>
            {saved && (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 font-bold text-fg">
                In progress · {saved.attempts.length}/{saved.questionIds.length}
              </span>
            )}
          </span>
          {saved ? (
            <span className="mt-1.5 block h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-brand"
                style={{ width: `${(saved.attempts.length / saved.questionIds.length) * 100}%` }}
              />
            </span>
          ) : best && (
            <span className="mt-1.5 block h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-surface-2">
              <span
                className={clsx("block h-full rounded-full", best.accuracy >= 80 ? "bg-ok" : best.accuracy >= 50 ? "bg-brand" : "bg-bad")}
                style={{ width: `${best.accuracy}%` }}
              />
            </span>
          )}
        </span>
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-brand-ink shadow-pop transition-transform group-hover:scale-110">
          <Play className="size-5 fill-current" />
          <span className="sr-only">{saved ? "Continue where you left off" : `Start ${ROUND_SIZE} questions`}</span>
        </span>
      </motion.button>
      {saved && (
        <StartOver
          onConfirm={() => {
            discardSavedRound(chapter.key, saved.roundId);
            startNew();
          }}
        />
      )}
    </motion.article>
  );
}

/** Small "Start over" link under an unfinished chapter. Asks for a second tap, since progress is lost. */
function StartOver({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);
  return (
    <div className="flex justify-end px-2 pt-1">
      <button
        type="button"
        onClick={() => (confirming ? onConfirm() : setConfirming(true))}
        className={clsx(
          "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition-colors",
          confirming ? "bg-bad text-white" : "text-muted hover:text-fg",
        )}
      >
        <RotateCcw className="size-3.5" />
        {confirming ? "Tap again to lose progress and start over" : "Start over"}
      </button>
    </div>
  );
}

/** Subject tabs + the chapter list for the selected subject. The tab bar sticks to the top while scrolling. */
function ChapterPicker({ chapters, onStart }: { chapters: Chapter[]; onStart: StartRound }) {
  const lastSubject = useProfile((p) => p.lastSubject);
  const setLastSubject = useProfile((p) => p.setLastSubject);
  const lastGrade = useProfile((p) => p.lastGrade);
  const setLastGrade = useProfile((p) => p.setLastGrade);
  const grades = [...new Set(chapters.map((c) => c.grade))].sort((a, b) => a - b);
  const grade = lastGrade && grades.includes(lastGrade) ? lastGrade : grades[0];
  const inGrade = chapters.filter((c) => c.grade === grade);
  const subjects = [...new Set(inGrade.map((c) => c.subject))];
  const active = lastSubject && subjects.includes(lastSubject) ? lastSubject : subjects[0];
  const list = inGrade.filter((c) => c.subject === active);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });
  const measure = () => {
    const bar = tabsRef.current;
    if (!bar) return;
    setMore({ left: bar.scrollLeft > 2, right: bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 2 });
  };

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [subjects.length]);

  // On narrow screens the tab strip scrolls sideways; keep the selected tab in view.
  useEffect(() => {
    const bar = tabsRef.current;
    const tab = bar?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!bar || !tab) return;
    if (tab.offsetLeft < bar.scrollLeft || tab.offsetLeft + tab.offsetWidth > bar.scrollLeft + bar.clientWidth) {
      bar.scrollTo({ left: tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" });
    }
  }, [active]);

  const start: StartRound = (qs, title, key) => {
    setLastSubject(active);
    onStart(qs, title, key);
  };

  return (
    <section id="chapters" className="mb-12 scroll-mt-4">
      <div className="mb-1 sm:mb-3">
        <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Chapter practice</h2>
        <p className="hidden text-muted sm:block">Pick a subject, then tap a chapter. Every round is {ROUND_SIZE} random questions.</p>
      </div>

      <div className="sticky top-0 z-30 -mx-4 bg-bg/90 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        {grades.length > 1 && (
          <div role="tablist" aria-label="Class" className="mb-2 flex gap-1.5 rounded-2xl border-2 border-line bg-surface p-1.5">
            {grades.map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={g === grade}
                onClick={() => setLastGrade(g)}
                className={clsx(
                  "flex-1 rounded-xl px-3 py-2 font-display text-sm font-bold transition-colors sm:text-base",
                  g === grade ? "bg-fg text-bg shadow-pop" : "text-muted hover:text-fg",
                )}
              >
                {region.gradeLabel(g)}
              </button>
            ))}
          </div>
        )}
        <div className="rounded-2xl border-2 border-line bg-surface">
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Subjects"
          onScroll={measure}
          style={{
            maskImage:
              more.left || more.right
                ? `linear-gradient(to right, ${more.left ? "transparent, #000 40px" : "#000"}, ${more.right ? "#000 calc(100% - 40px), transparent" : "#000"})`
                : undefined,
          }}
          className="relative flex gap-1.5 overflow-x-auto overscroll-x-contain rounded-[14px] p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {subjects.map((s) => {
            const st = SUBJECT_STYLE[s];
            const on = s === active;
            const n = inGrade.filter((c) => c.subject === s).length;
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="chapter-list"
                onClick={() => {
                  setLastSubject(s);
                  document.getElementById("chapters")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={clsx(
                  "relative flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 font-display text-sm font-bold transition-colors sm:gap-2 sm:text-base",
                  on ? "text-white" : "text-muted hover:text-fg",
                )}
              >
                {on && (
                  <motion.span
                    layoutId="subject-tab"
                    className={clsx("absolute inset-0 rounded-xl shadow-pop", st.bg)}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <st.icon className={clsx("relative size-5 shrink-0", subjects.length > 3 && "hidden sm:block")} />
                <span className="relative">
                  <span className="sm:hidden">{region.subjects[s].split(" ")[0]}</span>
                  <span className="hidden sm:inline">{region.subjects[s]}</span>
                </span>
                <span
                  className={clsx(
                    "relative hidden rounded-full px-1.5 text-xs tabular-nums sm:inline",
                    on ? "bg-white/25" : "bg-surface-2",
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        </div>
      </div>

      <div id="chapter-list" role="tabpanel" className="mt-3 grid gap-3 md:grid-cols-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {list.map((c, i) => (
            <ChapterRow key={c.key} chapter={c} onStart={start} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

/** Slim header for returning students: stats and mixed practice, so chapters sit near the top. */
function WelcomeBar({ onMixed }: { onMixed: () => void }) {
  const profile = useStats();
  const firstName = useAuth((s) => s.user?.name.split(" ")[0]);
  const go = useNav((s) => s.go);
  const bestRound = rankRounds(profile.rounds)[0];
  const stats = [
    { icon: Zap, label: "XP", value: profile.totalXp, cls: "fill-brand text-brand" },
    { icon: Flame, label: "Streak", value: profile.bestStreak, cls: "fill-bad text-bad" },
    { icon: Trophy, label: "Best", value: bestRound ? `${bestRound.accuracy}%` : "–", cls: "text-brand" },
    { icon: Award, label: "Rounds", value: profile.sessions, cls: "text-maths" },
  ];
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex items-center gap-3 rounded-[24px] border-2 border-line bg-surface p-3 shadow-card sm:mb-6 sm:justify-between sm:gap-4 sm:p-5"
    >
      <div className="min-w-0 flex-1">
        <p className="hidden font-display text-2xl font-extrabold tracking-tight sm:block">Welcome back{firstName ? `, ${firstName}` : ""}! 👋</p>
        <dl className="grid grid-cols-4 gap-2 sm:mt-2 sm:flex sm:gap-6">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted sm:text-xs">{s.label}</dt>
              <dd className="flex items-center gap-1 font-display text-lg font-extrabold tabular-nums">
                <s.icon className={clsx("size-4 shrink-0", s.cls)} /> {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <Button onClick={() => go("board")} className="px-3 sm:px-5" aria-label="Leaderboard">
          <Trophy className="size-4" /> <span className="hidden sm:inline">Leaderboard</span>
        </Button>
        <Button variant="ghost" onClick={onMixed} className="px-3 sm:px-5" aria-label="Mixed practice">
          <Sparkles className="size-4" /> <span className="hidden sm:inline">Mixed practice</span>
        </Button>
      </div>
    </motion.section>
  );
}

/** Shown in place of the chapters when the catalog could not be loaded (usually offline). */
function ChaptersOffline() {
  const load = useContent((s) => s.load);
  return (
    <section className="mb-12 rounded-[28px] border-2 border-dashed border-line bg-surface p-6 text-center shadow-card">
      <WifiOff className="mx-auto size-8 text-muted" />
      <h2 className="mt-3 font-display text-xl font-extrabold">Chapters need a connection</h2>
      <p className="mt-1 text-sm text-muted">Questions come from the server, so practice needs the internet. The games above work offline.</p>
      <Button variant="ghost" className="mt-4" onClick={() => void load()}>
        <RefreshCw className="size-5" /> Try again
      </Button>
    </section>
  );
}

export function HomeScreen({ onStart }: { onStart: StartRound }) {
  const profile = useStats();
  const chapters = useChapters();
  const contentStatus = useContent((s) => s.status);
  const currentGrade = useCurrentGrade();
  const mixed: RoundSource = { subjects: [], grades: [currentGrade] };
  const bestRound = rankRounds(profile.rounds)[0];
  // The logo opens the full landing page; otherwise returning students skip it.
  const landing = useNav((s) => s.landing) || profile.sessions === 0;
  const [grades, setGrades] = useState<number[]>([]);
  const [subjects, setSubjects] = useState<SubjectId[]>([]);

  const allChapters = useAllChapters();
  /** Subjects with at least one question (the old combined "social" subject is empty now that it is split). */
  const subjectsWithQuestions = SUBJECT_ORDER.filter((s) => allChapters.some((c) => c.subject === s));
  const types = useContent((s) => s.catalog?.types) ?? [];
  // No class ticked means every class the app offers, not every class in the bank.
  const chosenGrades = grades.length === 0 ? offeredGrades : grades;
  const inGrades = (c: ChapterInfo) => chosenGrades.includes(c.grade);
  const sum = (cs: ChapterInfo[]) => cs.reduce((n, c) => n + c.count, 0);
  const selectionSize = sum(allChapters.filter((c) => inGrades(c) && (subjects.length === 0 || subjects.includes(c.subject))));
  const countFor = (s: SubjectId) => sum(allChapters.filter((c) => c.subject === s && inGrades(c)));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="paper relative min-h-dvh">
      <FloatingGlyphs />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <header className="flex items-center justify-between py-5">
          <Logo />
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <XpPill xp={profile.totalXp} />
            </div>
            <SettingsToggles />
          </div>
        </header>

        {!landing && <WelcomeBar onMixed={() => onStart(mixed, "Mixed practice", MIXED_KEY)} />}

        {/* Hero: first visit or the logo, so returning students otherwise reach their chapters without scrolling */}
        {landing && (
        <section className="grid items-center gap-12 pb-14 pt-8 md:grid-cols-[1.15fr_1fr] md:pt-14">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-line bg-surface px-3 py-1.5 text-sm font-semibold"
            >
              <Sparkles className="size-4 text-brand" />
              {region.boards.join(" · ")} · {region.gradeLabel(region.grades[0])}–{region.grades.at(-1)}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="font-display text-[42px] font-extrabold leading-[1.02] tracking-tight sm:text-6xl"
            >
              Practise like it's the{" "}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">board exam.</span>
                <motion.span
                  className="absolute inset-x-0 bottom-1 z-0 h-4 rounded-sm bg-brand/45 sm:h-5"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  style={{ originX: 0 }}
                  transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
                />
              </span>
              <br />
              Learn like it's a game.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="mt-5 max-w-md text-lg text-muted"
            >
              Bite-sized questions with instant feedback, step-by-step explanations, streaks and XP — for Maths,
              Physics, Chemistry and Biology.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <Button
                onClick={() => document.getElementById("chapters")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="px-7 py-4 text-lg"
              >
                <BookOpen className="size-5" /> Choose a chapter
              </Button>
              <button
                type="button"
                onClick={() => onStart(mixed, "Mixed practice", MIXED_KEY)}
                className="font-semibold text-muted underline-offset-4 hover:text-fg hover:underline"
              >
                or start mixed practice
              </button>
            </motion.div>
            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-10 grid grid-cols-2 gap-x-8 gap-y-5 sm:flex"
            >
              {[
                { icon: Zap, label: "Total XP", value: profile.totalXp, cls: "fill-brand text-brand" },
                { icon: Flame, label: "Best streak", value: profile.bestStreak, cls: "fill-bad text-bad" },
                { icon: Trophy, label: "Best score", value: bestRound ? `${bestRound.accuracy}%` : "–", cls: "text-brand" },
                { icon: Award, label: "Rounds", value: profile.sessions, cls: "text-maths" },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{s.label}</dt>
                  <dd className="mt-1 flex items-center gap-1.5 font-display text-2xl font-extrabold tabular-nums">
                    <s.icon className={clsx("size-5", s.cls)} /> {s.value}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: 4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 140, damping: 16 }}
            className="px-4"
          >
            <HeroDemo />
          </motion.div>
        </section>
        )}

        <GamesStrip />

        {chapters.length > 0 && <ChapterPicker chapters={chapters} onStart={onStart} />}
        {contentStatus === "failed" && <ChaptersOffline />}

        {/* Builder */}
        <section id="build" className="scroll-mt-6 rounded-[28px] border-2 border-line bg-surface p-5 shadow-card sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-tight">Build your practice set</h2>
              <p className="mt-1 text-muted">Leave everything unselected for a mix of all classes and subjects.</p>
            </div>
          </div>

          <h3 className="mb-3 mt-7 text-sm font-bold uppercase tracking-wider text-muted">Class</h3>
          <div className="grid grid-cols-4 gap-2 sm:flex">
            {offeredGrades.map((g) => (
              <Toggle key={g} on={grades.includes(g)} onClick={() => setGrades(toggle(grades, g))} className="px-5 py-3 sm:min-w-28">
                <span className="hidden sm:inline">{region.gradeLabel(g)}</span>
                <span className="sm:hidden">{g}</span>
              </Toggle>
            ))}
          </div>

          <h3 className="mb-3 mt-7 text-sm font-bold uppercase tracking-wider text-muted">Subject</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {subjectsWithQuestions.map((s, i) => {
              const st = SUBJECT_STYLE[s];
              const on = subjects.includes(s);
              const n = countFor(s);
              return (
                <motion.button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSubjects(toggle(subjects, s))}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  className={clsx(
                    "group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-colors sm:p-5",
                    on ? "border-fg bg-surface shadow-[0_4px_0_0_var(--fg)]" : "border-line bg-surface hover:border-fg/30",
                  )}
                >
                  <span
                    className={clsx(
                      "pointer-events-none absolute -bottom-6 -right-2 font-display text-[110px] font-extrabold leading-none opacity-10 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110",
                      st.text,
                    )}
                  >
                    {st.glyph}
                  </span>
                  <span className={clsx("grid size-11 place-items-center rounded-xl text-white", st.bg)}>
                    <st.icon className="size-6" />
                  </span>
                  <span className="mt-4 block font-display text-lg font-bold">{region.subjects[s]}</span>
                  <span className="text-sm text-muted">
                    {n} question{n === 1 ? "" : "s"}
                  </span>
                  <AnimatePresence>
                    {on && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-fg text-bg"
                      >
                        <Check className="size-4" strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-7 flex flex-col gap-4 border-t-2 border-dashed border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {types.map((t) => (
                <span key={t} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
                  {TYPE_LABEL[t]}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2 font-semibold text-muted">
                <Target className="size-4" />
                <motion.span key={selectionSize} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="tabular-nums">
                  {Math.min(selectionSize, ROUND_SIZE)}
                </motion.span>
                question{selectionSize === 1 ? "" : "s"}
                {selectionSize > ROUND_SIZE && <span className="whitespace-nowrap font-normal">(random from {selectionSize})</span>}
              </span>
              <Button variant="dark" disabled={selectionSize === 0} onClick={() => onStart({ subjects, grades: chosenGrades }, "Custom set")}>
                Start <Play className="size-4 fill-current" />
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
