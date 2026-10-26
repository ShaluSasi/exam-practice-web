import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock,
  Flame,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { region } from "../config/regions";
import type { ChapterInfo } from "../content/api";
import type { SubjectId } from "../content/schema";
import { Button } from "../components/Button";
import { CountUp } from "../components/CountUp";
import { SettingsToggles } from "../components/TopBar";
import { ROUND_SIZE } from "../engine/scoring";
import { SUBJECT_STYLE, formatTime } from "../lib/subjects";
import { useAuth } from "../store/auth";
import { useContent, type RoundSource } from "../store/content";
import { useNav } from "../store/nav";
import { rankRounds, useCurrentGrade, useProfile, useStats, type Round } from "../store/profile";
import { useProgress } from "../store/progress";
import type { SavedRound } from "../store/session";

type StartRound = (source: RoundSource, title: string, key?: string) => void;

/** Best score that counts a chapter as mastered, and the one below which it needs work (same colours as the home screen). */
const MASTERED = 80;
const PASSING = 50;
/** Rounds the averages and the trend look at: the server and the device both keep the latest 30. */
const RECENT = 30;
const TREND_SIZE = 12;
const ACTIVITY_WEEKS = 4;
const DAY_MS = 86_400_000;

type Status = "mastered" | "close" | "weak" | "started" | "new";

const STATUS: Record<Status, { label: string; chip: string; bar: string }> = {
  mastered: { label: "Mastered", chip: "bg-ok-soft text-ok", bar: "bg-ok" },
  close: { label: "Getting there", chip: "bg-brand-soft text-fg", bar: "bg-brand" },
  weak: { label: "Needs work", chip: "bg-bad-soft text-bad", bar: "bg-bad" },
  started: { label: "In progress", chip: "bg-maths/12 text-maths", bar: "bg-maths" },
  new: { label: "Not started", chip: "bg-surface-2 text-muted", bar: "bg-line" },
};
const STATUS_ORDER: Status[] = ["mastered", "close", "weak", "started", "new"];

type Filter = "all" | "weak" | "new" | "mastered";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "weak", label: "To improve" },
  { id: "new", label: "Not started" },
  { id: "mastered", label: "Mastered" },
];

interface ChapterProgress {
  chapter: ChapterInfo;
  /** Rounds of this chapter still known on this device, newest first. */
  rounds: Round[];
  best?: Round;
  saved?: SavedRound;
  status: Status;
  /** Best score, 0 when never finished: what the mastery averages use. */
  score: number;
  lastAt?: number;
}

function statusOf(best: Round | undefined, saved: SavedRound | undefined): Status {
  if (best) return best.accuracy >= MASTERED ? "mastered" : best.accuracy >= PASSING ? "close" : "weak";
  return saved ? "started" : "new";
}

const scoreColor = (accuracy: number) => (accuracy >= MASTERED ? "bg-ok" : accuracy >= PASSING ? "bg-brand" : "bg-bad");
const scoreText = (accuracy: number) => (accuracy >= MASTERED ? "text-ok" : accuracy >= PASSING ? "text-brand" : "text-bad");

/** A round belongs to a chapter by its key; older rounds without one are matched by title, as on the home screen. */
function isChapterRound(r: Round, c: ChapterInfo) {
  return r.quizKey ? r.quizKey === c.key : r.title === c.title;
}

const average = (ns: number[]) => (ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : 0);

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function when(t: number) {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(t)) / DAY_MS);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString(region.locale, { day: "numeric", month: "short" });
}

function duration(ms: number) {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Days in a row, up to today, with at least one round. Yesterday still counts, so the streak isn't lost before today's practice. */
function dayStreak(days: Set<number>) {
  let day = startOfDay(Date.now());
  if (!days.has(day)) day = startOfDay(day - DAY_MS / 2);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = startOfDay(day - DAY_MS / 2);
  }
  return n;
}

function useChapterProgress(): ChapterProgress[] {
  const chapters = useContent((s) => s.catalog?.chapters);
  const { rounds } = useStats();
  const saved = useProgress((s) => (s.account ? s.account.rounds : s.guest));
  return useMemo(
    () =>
      (chapters ?? [])
        .filter((c) => c.count >= ROUND_SIZE)
        .map((chapter) => {
          const mine = rounds.filter((r) => isChapterRound(r, chapter)).sort((a, b) => b.at - a.at);
          const best = rankRounds(mine)[0];
          const s = saved[chapter.key];
          return {
            chapter,
            rounds: mine,
            best,
            saved: s,
            status: statusOf(best, s),
            score: best?.accuracy ?? 0,
            lastAt: Math.max(mine[0]?.at ?? 0, s?.updatedAt ?? 0) || undefined,
          };
        }),
    [chapters, rounds, saved],
  );
}

/** Circular progress meter that fills when it appears. */
function Ring({ value, size, stroke = 10, color, children }: { value: number; size: number; stroke?: number; color: string; children?: React.ReactNode }) {
  const r = 50 - stroke / 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        {value > 0 && (
          <motion.circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={color}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: value / 100 }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.15 }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

function Card({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 28 }}
      className={clsx("rounded-[24px] border-2 border-line bg-surface p-4 shadow-card sm:p-6", className)}
    >
      {children}
    </motion.section>
  );
}

function SectionTitle({ icon: Icon, children, hint }: { icon: typeof Zap; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight sm:text-2xl">
        <Icon className="size-5 text-brand" /> {children}
      </h2>
      {hint && <span className="text-xs font-semibold text-muted">{hint}</span>}
    </div>
  );
}

function headline(mastery: number, started: boolean) {
  if (!started) return { title: "Your learning journey starts here", text: "Finish a chapter round and your progress shows up here." };
  if (mastery >= MASTERED) return { title: "Outstanding work! 🏆", text: "You've mastered most of this class. Keep your scores sharp." };
  if (mastery >= PASSING) return { title: "Over halfway there 🚀", text: "Lift the chapters that need work to reach mastery." };
  if (mastery >= 20) return { title: "You're building momentum 💪", text: "Every round moves the ring. Try a new chapter today." };
  return { title: "Great start! 🌱", text: "Keep practising chapter by chapter to fill the ring." };
}

/** Class mastery ring, encouragement, and how the class's chapters split by status. */
function Overview({ list, grade }: { list: ChapterProgress[]; grade: number }) {
  const mastery = average(list.map((c) => c.score));
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, list.filter((c) => c.status === s).length])) as Record<Status, number>;
  const started = list.some((c) => c.status !== "new");
  const { title, text } = headline(mastery, started);

  return (
    <Card className="relative overflow-hidden">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-brand/15 blur-2xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
        <Ring value={mastery} size={148} stroke={11} color={mastery >= MASTERED ? "text-ok" : "text-brand"}>
          <div>
            <CountUp value={mastery} format={(v) => `${Math.round(v)}%`} className="block font-display text-4xl font-extrabold" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Mastery</span>
          </div>
        </Ring>
        <div className="w-full min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{region.gradeLabel(grade)} · {list.length} chapters</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{title}</h2>
          <p className="mt-1 text-sm text-muted">{text}</p>
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Chapters by status">
            {STATUS_ORDER.filter((s) => s !== "new" && counts[s] > 0).map((s, i) => (
              <motion.span
                key={s}
                className={clsx("h-full", STATUS[s].bar)}
                initial={{ width: 0 }}
                animate={{ width: `${(counts[s] / list.length) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.3 + i * 0.12, ease: "easeOut" }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {STATUS_ORDER.map((s) => (
              <li key={s} className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <span className={clsx("size-2.5 rounded-full", STATUS[s].bar)} />
                {STATUS[s].label}
                <span className="font-display font-extrabold text-fg tabular-nums">{counts[s]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

/** Headline numbers across every class. */
function StatTiles({ recent, days }: { recent: Round[]; days: Set<number> }) {
  const stats = useStats();
  const answered = recent.reduce((n, r) => n + r.total, 0);
  const correct = recent.reduce((n, r) => n + r.correct, 0);
  const tiles = [
    { icon: Zap, label: "Total XP", value: stats.totalXp, cls: "fill-brand text-brand", tint: "bg-brand-soft" },
    { icon: Award, label: "Rounds played", value: stats.sessions, cls: "text-maths", tint: "bg-maths/12" },
    { icon: CalendarDays, label: "Day streak", value: dayStreak(days), cls: "text-physics", tint: "bg-physics/12", suffix: "d" },
    { icon: Flame, label: "Best answer streak", value: stats.bestStreak, cls: "fill-bad text-bad", tint: "bg-bad-soft" },
    {
      icon: Target,
      label: "Average score",
      value: average(recent.map((r) => r.accuracy)),
      cls: "text-ok",
      tint: "bg-ok-soft",
      suffix: "%",
      hint: answered ? `${correct}/${answered} correct` : undefined,
    },
    { icon: Clock, label: "Practice time", value: recent.reduce((n, r) => n + r.timeMs, 0), cls: "text-chemistry", tint: "bg-chemistry/12", time: true },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t, i) => (
        <motion.div
          key={t.label}
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1 + i * 0.05, type: "spring", stiffness: 300, damping: 26 }}
          whileHover={{ y: -3 }}
          className="rounded-2xl border-2 border-line bg-surface p-3.5 shadow-card"
        >
          <span className={clsx("grid size-9 place-items-center rounded-xl", t.tint)}>
            <t.icon className={clsx("size-5", t.cls)} />
          </span>
          <p className="mt-2.5 font-display text-2xl font-extrabold">
            {t.time ? (
              <span className="tabular-nums">{duration(t.value)}</span>
            ) : (
              <CountUp value={t.value} format={(v) => `${Math.round(v).toLocaleString("en-IN")}${t.suffix ?? ""}`} />
            )}
          </p>
          <p className="text-xs font-semibold text-muted">{t.label}</p>
          {t.hint && <p className="mt-0.5 text-[11px] text-muted">{t.hint}</p>}
        </motion.div>
      ))}
    </div>
  );
}

/** Up to three chapters worth doing next: an unfinished round, then the weakest scores, then the next new chapter. */
function FocusNext({ list, onStart }: { list: ChapterProgress[]; onStart: StartRound }) {
  const picks = useMemo(() => {
    const inProgress = list.filter((c) => c.saved).sort((a, b) => (b.saved?.updatedAt ?? 0) - (a.saved?.updatedAt ?? 0));
    const weakest = list.filter((c) => c.best && c.score < MASTERED && !c.saved).sort((a, b) => a.score - b.score);
    const fresh = list.filter((c) => c.status === "new");
    return [...inProgress, ...weakest, ...fresh].slice(0, 3);
  }, [list]);
  if (picks.length === 0) return null;

  const reason = (c: ChapterProgress) =>
    c.saved
      ? `Continue · ${c.saved.attempts.length}/${c.saved.questionIds.length} answered`
      : c.best
        ? `Best ${c.best.accuracy}% · aim for ${MASTERED}%`
        : "New chapter to explore";

  return (
    <Card delay={0.05}>
      <SectionTitle icon={Sparkles} hint="Picked from your scores">
        Focus next
      </SectionTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {picks.map((c, i) => {
          const st = SUBJECT_STYLE[c.chapter.subject];
          return (
            <motion.button
              key={c.chapter.key}
              type="button"
              onClick={() => onStart({ chapter: c.chapter.key }, c.chapter.title, c.chapter.key)}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.08 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border-2 border-line bg-bg/60 p-3 text-left transition-colors hover:border-fg/25"
            >
              <span className={clsx("grid size-10 shrink-0 place-items-center rounded-xl text-white sm:size-12", st.bg)}>
                <st.icon className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 break-words font-display font-extrabold leading-tight">{c.chapter.title}</span>
                <span className="mt-0.5 line-clamp-2 text-xs font-semibold text-muted">{reason(c)}</span>
              </span>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-brand-ink shadow-pop transition-transform group-hover:scale-110">
                <Play className="size-4 fill-current" />
              </span>
            </motion.button>
          );
        })}
      </div>
    </Card>
  );
}

/** Scores of the latest rounds as bars, oldest to newest; tapping a bar shows that round. */
function ScoreTrend({ recent }: { recent: Round[] }) {
  const rounds = useMemo(() => recent.slice(0, TREND_SIZE).reverse(), [recent]);
  const [picked, setPicked] = useState<string | null>(null);
  const shown = rounds.find((r) => r.id === picked) ?? rounds.at(-1);
  const avg = average(rounds.map((r) => r.accuracy));
  const half = Math.floor(rounds.length / 2);
  const change = rounds.length >= 4 ? average(rounds.slice(half).map((r) => r.accuracy)) - average(rounds.slice(0, half).map((r) => r.accuracy)) : null;

  return (
    <Card delay={0.05} className="flex flex-col">
      <SectionTitle icon={TrendingUp} hint={rounds.length ? `Last ${rounds.length} rounds` : undefined}>
        Score trend
      </SectionTitle>
      {rounds.length === 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-center text-sm text-muted">Your scores will appear here after your first round.</p>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-3 text-sm">
            <span className="font-semibold text-muted">
              Average <span className="font-display font-extrabold text-fg">{avg}%</span>
            </span>
            {change !== null && change !== 0 && (
              <span className={clsx("rounded-full px-2 py-0.5 text-xs font-bold", change > 0 ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>
                {change > 0 ? "▲" : "▼"} {Math.abs(change)}% vs earlier
              </span>
            )}
          </div>
          <div className="relative h-40">
            <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-fg/15" style={{ bottom: `${avg}%` }} />
            <div className="-mx-[3px] flex h-full items-end sm:-mx-1">
              {rounds.map((r, i) => {
                const on = r.id === shown?.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setPicked(r.id)}
                    aria-label={`${r.title}: ${r.accuracy}%, ${when(r.at)}`}
                    aria-pressed={on}
                    className="group flex h-full min-w-0 flex-1 items-end px-[3px] sm:px-1"
                  >
                    <motion.span
                      className={clsx(
                        "block w-full rounded-t-lg transition-opacity",
                        scoreColor(r.accuracy),
                        on ? "opacity-100 ring-2 ring-fg ring-offset-2 ring-offset-surface" : "opacity-60 group-hover:opacity-90",
                      )}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${Math.max(r.accuracy, 4)}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.05, type: "spring", stiffness: 180, damping: 20 }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <AnimatePresence mode="wait">
            {shown && (
              <motion.div
                key={shown.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-display font-extrabold">{shown.title}</p>
                  <p className="text-xs font-semibold text-muted">
                    {when(shown.at)} · {shown.correct}/{shown.total} correct · {formatTime(shown.timeMs)}
                  </p>
                </div>
                <span className={clsx("font-display text-2xl font-extrabold", scoreText(shown.accuracy))}>{shown.accuracy}%</span>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </Card>
  );
}

/** Rounds per day over the last few weeks, one square per day; tapping a day shows its count. */
function Activity({ rounds }: { rounds: Round[] }) {
  const days = useMemo(() => {
    const today = startOfDay(Date.now());
    const perDay = new Map<number, number>();
    for (const r of rounds) perDay.set(startOfDay(r.at), (perDay.get(startOfDay(r.at)) ?? 0) + 1);
    // Whole weeks, Monday first, ending with the current week.
    const offset = (new Date(today).getDay() + 6) % 7;
    const first = startOfDay(today - (ACTIVITY_WEEKS * 7 - 1 - (6 - offset)) * DAY_MS + DAY_MS / 2);
    return Array.from({ length: ACTIVITY_WEEKS * 7 }, (_, i) => {
      const day = startOfDay(first + i * DAY_MS + DAY_MS / 2);
      return { day, count: perDay.get(day) ?? 0, future: day > today };
    });
  }, [rounds]);
  const [picked, setPicked] = useState<number | null>(null);
  const shown = days.find((d) => d.day === picked);
  const active = days.filter((d) => d.count > 0).length;
  const shade = (n: number) => (n === 0 ? "bg-surface-2" : n === 1 ? "bg-ok/35" : n === 2 ? "bg-ok/65" : "bg-ok");

  return (
    <Card delay={0.1} className="flex flex-col">
      <SectionTitle icon={CalendarDays} hint={`${active} active day${active === 1 ? "" : "s"} in ${ACTIVITY_WEEKS} weeks`}>
        Activity
      </SectionTitle>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-center text-[11px] font-bold text-muted">
            {d}
          </span>
        ))}
        {days.map((d, i) => (
          <motion.button
            key={d.day}
            type="button"
            disabled={d.future}
            onClick={() => setPicked(d.day)}
            aria-label={`${new Date(d.day).toDateString()}: ${d.count} round${d.count === 1 ? "" : "s"}`}
            initial={{ opacity: 0, scale: 0.4 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 + i * 0.015, type: "spring", stiffness: 400, damping: 22 }}
            whileHover={d.future ? undefined : { scale: 1.12 }}
            className={clsx(
              "aspect-square rounded-lg",
              d.future ? "border-2 border-dashed border-line" : shade(d.count),
              d.day === startOfDay(Date.now()) && "ring-2 ring-brand ring-offset-2 ring-offset-surface",
              d.day === picked && "outline-2 outline-fg",
            )}
          />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold text-muted">
        <span className="min-h-4">
          {shown ? (
            <>
              <span className="text-fg">{new Date(shown.day).toLocaleDateString(region.locale, { weekday: "short", day: "numeric", month: "short" })}</span>
              {" · "}
              {shown.count ? `${shown.count} round${shown.count === 1 ? "" : "s"}` : "No practice"}
            </>
          ) : (
            "Tap a day to see it"
          )}
        </span>
        <span className="flex items-center gap-1">
          Less
          {[0, 1, 2, 3].map((n) => (
            <span key={n} className={clsx("size-3 rounded", shade(n))} />
          ))}
          More
        </span>
      </div>
    </Card>
  );
}

/** One card per subject with its mastery ring; tapping one filters the chapter list. */
function SubjectCards({ list, active, onPick }: { list: ChapterProgress[]; active: SubjectId | null; onPick: (s: SubjectId | null) => void }) {
  const subjects = [...new Set(list.map((c) => c.chapter.subject))];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {subjects.map((s, i) => {
        const st = SUBJECT_STYLE[s];
        const mine = list.filter((c) => c.chapter.subject === s);
        const mastery = average(mine.map((c) => c.score));
        const tried = mine.filter((c) => c.status !== "new").length;
        const on = active === s;
        return (
          <motion.button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? null : s)}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.97 }}
            className={clsx(
              "relative flex flex-col items-start gap-2 overflow-hidden rounded-2xl border-2 bg-surface p-3 text-left transition-colors sm:flex-row sm:items-center sm:gap-3 sm:p-4",
              on ? "border-fg shadow-[0_4px_0_0_var(--fg)]" : "border-line hover:border-fg/30",
            )}
          >
            <Ring value={mastery} size={56} stroke={12} color={st.text}>
              <st.icon className={clsx("size-5", st.text)} />
            </Ring>
            <span className="min-w-0 max-w-full">
              <span className="block truncate font-display font-extrabold">{region.subjects[s]}</span>
              <span className={clsx("block font-display text-lg font-extrabold leading-tight", st.text)}>{mastery}%</span>
              <span className="block text-[11px] font-semibold text-muted">
                {tried}/{mine.length} chapters tried
              </span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

function ChapterItem({ c, onStart, index }: { c: ChapterProgress; onStart: StartRound; index: number }) {
  const [open, setOpen] = useState(false);
  const st = SUBJECT_STYLE[c.chapter.subject];
  const s = STATUS[c.status];
  const fill = c.saved && !c.best ? (c.saved.attempts.length / c.saved.questionIds.length) * 100 : c.score;
  const start = () => onStart({ chapter: c.chapter.key }, c.chapter.title, c.chapter.key);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index, 12) * 0.03, type: "spring", stiffness: 320, damping: 30 }}
      className="overflow-hidden rounded-2xl border-2 border-line bg-surface shadow-card"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-2/50"
      >
        <span className={clsx("grid size-10 shrink-0 place-items-center rounded-xl font-display font-extrabold", st.soft, st.text)}>
          {c.chapter.no ?? st.glyph}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display font-extrabold leading-tight">{c.chapter.title}</span>
            <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-bold", s.chip)}>{s.label}</span>
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <span className="h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-surface-2">
              <motion.span
                className={clsx("block h-full rounded-full", s.bar)}
                initial={{ width: 0 }}
                whileInView={{ width: `${fill}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </span>
            <span className="shrink-0 text-xs font-semibold text-muted">
              {c.best ? `${c.best.accuracy}%` : c.saved ? `${c.saved.attempts.length}/${c.saved.questionIds.length}` : "–"}
            </span>
          </span>
        </span>
        <span className="hidden shrink-0 text-right text-xs font-semibold text-muted sm:block">{c.lastAt ? when(c.lastAt) : ""}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="shrink-0 text-muted">
          <ChevronDown className="size-5" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="border-t-2 border-dashed border-line p-3 sm:p-4">
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Best score", value: c.best ? `${c.best.accuracy}%` : "–" },
                  { label: "Best marks", value: c.best ? `${c.best.marks}/${c.best.maxMarks}` : "–" },
                  { label: "Best time", value: c.best ? formatTime(c.best.timeMs) : "–" },
                ].map((d) => (
                  <div key={d.label} className="rounded-xl bg-surface-2 px-2 py-2">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{d.label}</dt>
                    <dd className="font-display text-lg font-extrabold tabular-nums">{d.value}</dd>
                  </div>
                ))}
              </dl>
              {c.rounds.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted">Recent attempts</p>
                  <ul className="grid gap-1.5">
                    {c.rounds.slice(0, 5).map((r) => (
                      <li key={r.id} className="flex items-center gap-3 text-sm">
                        <span className="w-20 shrink-0 text-xs font-semibold text-muted">{when(r.at)}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <motion.span
                            className={clsx("block h-full rounded-full", scoreColor(r.accuracy))}
                            initial={{ width: 0 }}
                            animate={{ width: `${r.accuracy}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                        </span>
                        <span className="w-10 shrink-0 text-right font-display font-extrabold tabular-nums">{r.accuracy}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-muted">
                  {c.chapter.count} questions{c.status !== "mastered" && c.best ? ` · ${MASTERED}% to master` : ""}
                </span>
                <Button onClick={start} className="px-4 py-2.5 text-base">
                  <Play className="size-4 fill-current" /> {c.saved ? "Continue" : c.best ? "Practise again" : "Start"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function ChapterList({ list, onStart }: { list: ChapterProgress[]; onStart: StartRound }) {
  const [subject, setSubject] = useState<SubjectId | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const matches = (c: ChapterProgress) =>
    filter === "all" ||
    (filter === "weak" && (c.status === "weak" || c.status === "close")) ||
    (filter === "new" && c.status === "new") ||
    (filter === "mastered" && c.status === "mastered");
  const shown = list.filter((c) => (!subject || c.chapter.subject === subject) && matches(c));

  return (
    <section className="mt-8">
      <SectionTitle icon={BookOpen} hint="Tap a subject to filter">
        Subjects &amp; chapters
      </SectionTitle>
      <SubjectCards list={list} active={subject} onPick={setSubject} />

      <div role="tablist" aria-label="Chapter status" className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border-2 border-line bg-surface p-1 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={clsx(
              "relative flex-1 whitespace-nowrap rounded-xl px-3 py-2 font-display text-sm font-bold transition-colors",
              filter === f.id ? "text-bg" : "text-muted hover:text-fg",
            )}
          >
            {filter === f.id && (
              <motion.span layoutId="progress-filter" className="absolute inset-0 rounded-xl bg-fg" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
            )}
            <span className="relative">{f.label}</span>
          </button>
        ))}
      </div>

      {/* Grouped by subject, in course order, so a long syllabus stays easy to scan. */}
      {[...new Set(shown.map((c) => c.chapter.subject))].map((s) => {
        const st = SUBJECT_STYLE[s];
        const group = shown.filter((c) => c.chapter.subject === s);
        const all = list.filter((c) => c.chapter.subject === s);
        const mastered = all.filter((c) => c.status === "mastered").length;
        return (
          <motion.div key={s} layout className="mt-5">
            <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-extrabold">
              <span className={clsx("grid size-7 place-items-center rounded-lg text-white", st.bg)}>
                <st.icon className="size-4" />
              </span>
              {region.subjects[s]}
              <span className="text-xs font-semibold text-muted">
                {mastered}/{all.length} mastered
              </span>
            </h3>
            <ul className="grid grid-cols-1 items-start gap-2.5 md:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {group.map((c, i) => (
                  <ChapterItem key={c.chapter.key} c={c} onStart={onStart} index={i} />
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        );
      })}
      {shown.length === 0 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 rounded-2xl border-2 border-dashed border-line p-6 text-center text-sm text-muted">
          No chapters here yet{filter === "mastered" ? " — score " + MASTERED + "% or more in a chapter to master it." : "."}
        </motion.p>
      )}
    </section>
  );
}

export function ProgressScreen({ onStart }: { onStart: StartRound }) {
  const go = useNav((s) => s.go);
  const stats = useStats();
  const signedIn = useAuth((s) => s.status === "signedIn");
  const all = useChapterProgress();
  const currentGrade = useCurrentGrade();
  const setLastGrade = useProfile((p) => p.setLastGrade);
  const grades = [...new Set(all.map((c) => c.chapter.grade))].sort((a, b) => a - b);
  const grade = grades.includes(currentGrade) ? currentGrade : grades[0];
  const list = all.filter((c) => c.chapter.grade === grade);
  const recent = useMemo(() => [...stats.rounds].sort((a, b) => b.at - a.at).slice(0, RECENT), [stats.rounds]);
  const days = useMemo(() => new Set(stats.rounds.map((r) => startOfDay(r.at))), [stats.rounds]);

  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        {/* On narrow phones the title takes its own line under the buttons, so it is never cut off. */}
        <header className="flex flex-wrap items-center gap-x-2 gap-y-3 py-5">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => go("home")}
            aria-label="Back to home"
            className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-line bg-surface text-muted hover:text-fg"
          >
            <ArrowLeft className="size-5" />
          </motion.button>
          <h1 className="order-last w-full font-display text-3xl font-extrabold tracking-tight min-[480px]:order-none min-[480px]:w-auto min-[480px]:min-w-0 min-[480px]:flex-1 min-[480px]:truncate min-[480px]:text-2xl sm:text-3xl">
            My progress
          </h1>
          <div className="ml-auto">
            <SettingsToggles />
          </div>
        </header>

        {grades.length > 1 && (
          <div role="tablist" aria-label="Class" className="mb-4 flex gap-1.5 rounded-2xl border-2 border-line bg-surface p-1.5">
            {grades.map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={g === grade}
                onClick={() => setLastGrade(g)}
                className={clsx(
                  "relative flex-1 rounded-xl px-3 py-2 font-display text-sm font-bold transition-colors sm:text-base",
                  g === grade ? "text-bg" : "text-muted hover:text-fg",
                )}
              >
                {g === grade && (
                  <motion.span layoutId="progress-grade" className="absolute inset-0 rounded-xl bg-fg shadow-pop" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                <span className="relative">{region.gradeLabel(g)}</span>
              </button>
            ))}
          </div>
        )}

        {list.length > 0 && (
          <motion.div key={`overview-${grade}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Overview list={list} grade={grade} />
          </motion.div>
        )}

        <div className="mt-4">
          <StatTiles recent={recent} days={days} />
        </div>

        {stats.sessions === 0 && (
          <Card className="mt-4 text-center">
            <motion.div animate={{ y: [0, -6, 0], rotate: [-4, 4, -4] }} transition={{ duration: 2.6, repeat: Infinity }} className="inline-block">
              <Trophy className="size-10 text-brand" />
            </motion.div>
            <h2 className="mt-2 font-display text-xl font-extrabold">No rounds yet</h2>
            <p className="mt-1 text-sm text-muted">Play a chapter round and your scores, streaks and mastery will show up here.</p>
            <Button className="mt-4" onClick={() => go("home")}>
              <BookOpen className="size-5" /> Choose a chapter
            </Button>
          </Card>
        )}

        {list.length > 0 && (
          <div className="mt-4">
            <FocusNext key={grade} list={list} onStart={onStart} />
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ScoreTrend recent={recent} />
          <Activity rounds={stats.rounds} />
        </div>

        {list.length > 0 && <ChapterList key={`chapters-${grade}`} list={list} onStart={onStart} />}

        <p className="mt-8 text-center text-xs text-muted">
          Averages, trend and practice time use your latest {RECENT} rounds.
          {!signedIn && " Your progress is saved on this device — sign in to keep it on every device."}
        </p>
      </div>
    </div>
  );
}
