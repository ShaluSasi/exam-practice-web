import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { ArrowDown, ArrowUp, ChevronDown, Crown, Gauge, Play, RefreshCw, Rocket, Share2, Swords, Target, Trophy, Users, Zap } from "lucide-react";
import clsx from "clsx";
import { AccountButton } from "../../components/Account";
import { burst } from "../../lib/celebrate";
import { play } from "../../lib/sound";
import { useAuth } from "../../store/auth";
import { OVERALL, loadGameBoard, loadGameRanks, useGameBoard, useGameBoardData, useMyGameRanks, type GameEntry, type MyRank } from "../../store/gameBoard";
import type { Period } from "../../store/leaderboard";
import { useGalaxy } from "./progress";
import { SECTIONS, symbolSize, type SectionId } from "./sections";

const GAME = "galaxy";

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

export const PERIOD_TEXT: Record<Period, string> = { week: "this week", month: "this month", all: "of all time" };

/** A scoreboard: the overall board or one mission's. */
export interface Category {
  id: string;
  name: string;
  symbol: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: OVERALL, name: "Overall", symbol: "🏆", color: "#ffd23f" },
  ...SECTIONS.map((s) => ({ id: s.id, name: s.name, symbol: s.symbol, color: s.color })),
];
const categoryOf = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

const AVATAR_TONES = ["#5ee7ff", "#6bff8f", "#ffd23f", "#ff9a3c", "#ff7ad9", "#c084fc", "#38bdf8", "#a3e635"];
function toneFor(pid: string) {
  let h = 0;
  for (const c of pid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

function Avatar({ e, className }: { e: Pick<GameEntry, "pid" | "name" | "isMe">; className?: string }) {
  return (
    <span
      className={clsx("grid shrink-0 place-items-center rounded-full font-display font-extrabold text-[#0b1030] shadow-card", className)}
      style={{ background: e.isMe ? "linear-gradient(135deg,#ffd23f,#ff7ad9)" : toneFor(e.pid) }}
      aria-hidden
    >
      {e.name.charAt(0).toUpperCase()}
    </span>
  );
}

function CountUp({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(0);
  const shown = useTransform(mv, (v) => Math.round(v).toLocaleString("en-IN"));
  useEffect(() => {
    const c = animate(mv, value, { duration: 1.1, ease: "easeOut" });
    return () => c.stop();
  }, [mv, value]);
  return <motion.span className={clsx("tabular-nums", className)}>{shown}</motion.span>;
}

/** Places gained (+) or lost (−) on this board since this device last showed it. */
function useMoved(userId: string | undefined, key: string, rank: number | undefined) {
  const [moved, setMoved] = useState(0);
  useEffect(() => {
    if (!userId || rank === undefined) return setMoved(0);
    try {
      const k = `prepquest-galaxy-rank:${userId}:${key}`;
      const before = Number(localStorage.getItem(k)) || 0;
      localStorage.setItem(k, String(rank));
      setMoved(before ? before - rank : 0);
    } catch {
      setMoved(0);
    }
  }, [userId, key, rank]);
  return moved;
}

// ---------- pieces ----------

function CategoryChips({ active, ranks, onPick }: { active: string; ranks?: Record<string, MyRank>; onPick: (id: string) => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rowRef.current?.querySelector<HTMLElement>(`[data-cat="${active}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);
  return (
    <div ref={rowRef} role="tablist" aria-label="Scoreboard" className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {CATEGORIES.map((c) => {
        const on = c.id === active;
        const r = ranks?.[c.id];
        return (
          <motion.button
            key={c.id}
            data-cat={c.id}
            role="tab"
            aria-selected={on}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              play("tap");
              onPick(c.id);
            }}
            className={clsx(
              "relative flex shrink-0 snap-center items-center gap-2 rounded-2xl border-2 py-2 pl-2 pr-3 font-display text-sm font-extrabold transition-colors",
              on ? "border-transparent text-[#0b1030]" : "border-line bg-surface text-fg hover:border-fg/30",
            )}
          >
            {on && <motion.span layoutId="cat-pill" className="absolute inset-0 rounded-2xl" style={{ background: c.color }} transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
            <span
              className={clsx("relative grid h-7 min-w-7 place-items-center rounded-lg px-1", symbolSize(c.symbol, "text-xl", "text-[13px]"), on ? "bg-[#0b1030]/15" : "text-[#0b1030]")}
              style={on ? undefined : { background: c.color }}
            >
              {c.symbol}
            </span>
            <span className="relative whitespace-nowrap">{c.name}</span>
            {r && (
              <span className={clsx("relative rounded-full px-1.5 py-0.5 text-[11px] tabular-nums", on ? "bg-[#0b1030] text-white" : "bg-surface-2 text-muted")}>#{r.rank}</span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

function PeriodTabs({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <div role="tablist" aria-label="Time period" className="grid grid-cols-3 gap-1 rounded-2xl border-2 border-line bg-surface p-1">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          role="tab"
          aria-selected={period === p.id}
          onClick={() => onChange(p.id)}
          className={clsx("relative rounded-xl px-2 py-2.5 font-display text-sm font-bold transition-colors sm:text-base", period === p.id ? "text-white" : "text-muted hover:text-fg")}
        >
          {period === p.id && (
            <motion.span layoutId="galaxy-period" className="absolute inset-0 rounded-xl bg-[#0b1030] dark:bg-[#3b1d8f]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
          )}
          <span className="relative">{p.label}</span>
        </button>
      ))}
    </div>
  );
}

function MyCard({
  cat,
  me,
  participants,
  above,
  moved,
  period,
  onPlay,
  onShare,
}: {
  cat: Category;
  me: GameEntry | null;
  participants: number;
  above: GameEntry | null;
  moved: number;
  period: Period;
  onPlay: () => void;
  onShare: () => void;
}) {
  if (!me) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] bg-[#0b1030] p-6 text-center text-white shadow-pop"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_80%_10%,rgba(192,38,211,0.35),transparent)]" />
        <motion.span
          animate={{ y: [0, -8, 0], rotate: [-6, 6, -6] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="relative mx-auto grid size-14 place-items-center rounded-2xl text-2xl font-extrabold text-[#0b1030]"
          style={{ background: cat.color }}
        >
          {cat.symbol}
        </motion.span>
        <p className="relative mt-3 font-display text-xl font-extrabold">
          You're not on the {cat.id === OVERALL ? "overall" : cat.name} board {PERIOD_TEXT[period]} yet
        </p>
        <p className="relative mx-auto mt-1 max-w-sm text-sm text-white/70">Fly one mission and your best score lands here. Every point counts!</p>
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onPlay}
          className="relative mx-auto mt-4 flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-display text-lg font-extrabold text-[#0b1030]"
        >
          <Play className="size-5 fill-current" /> {cat.id === OVERALL ? "Play a mission" : `Play ${cat.name}`}
        </motion.button>
      </motion.section>
    );
  }
  const top = Math.max(1, Math.ceil((me.rank / Math.max(1, participants)) * 100));
  const gap = above ? above.score - me.score + 1 : 0;
  const progress = above ? Math.min(100, (me.score / Math.max(1, above.score)) * 100) : 100;
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[28px] bg-[#0b1030] p-5 text-white shadow-pop sm:p-7"
    >
      <motion.div
        className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full blur-3xl"
        style={{ background: `${cat.color}55` }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 5, repeat: Infinity }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/60">
            <span className="grid h-5 min-w-5 place-items-center rounded-md px-1 text-[11px] text-[#0b1030]" style={{ background: cat.color }}>
              {cat.symbol}
            </span>
            Your {cat.id === OVERALL ? "overall" : cat.name} rank
          </p>
          <div className="mt-1 flex items-end gap-3">
            <span className="font-display text-6xl font-extrabold leading-none sm:text-7xl">
              #<CountUp value={me.rank} />
            </span>
            <span className="mb-1.5 text-sm font-semibold text-white/70">of {participants.toLocaleString("en-IN")} pilots</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 14 }}
              className="rounded-full bg-[#6bff8f] px-3 py-1 text-xs font-extrabold text-[#0b1030]"
            >
              TOP {top}%
            </motion.span>
            {moved !== 0 && (
              <motion.span
                initial={{ y: moved > 0 ? 8 : -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className={clsx("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold", moved > 0 ? "bg-[#6bff8f]/20 text-[#6bff8f]" : "bg-[#ff6b6b]/20 text-[#ff8a8a]")}
              >
                {moved > 0 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                {Math.abs(moved)} since last look
              </motion.span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">{cat.id === OVERALL ? "Total" : "Best"}</p>
          <p className="flex items-center justify-end gap-1 font-display text-3xl font-extrabold text-[#ffd23f]">
            <Zap className="size-6 fill-current" />
            <CountUp value={me.score} />
          </p>
          <p className="mt-1 text-xs font-semibold text-white/70">
            Level {me.level} · {me.accuracy}% right
          </p>
        </div>
      </div>

      <div className="relative mt-5">
        {above ? (
          <>
            <p className="mb-2 text-sm font-semibold text-white/80">
              <span className="font-extrabold text-[#ffd23f]">{gap.toLocaleString("en-IN")} points</span> to overtake {above.name} (#{above.rank})
            </p>
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#5ee7ff] via-[#a78bfa] to-[#ff7ad9]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
              />
            </div>
          </>
        ) : (
          <p className="flex items-center gap-2 font-display text-lg font-extrabold text-[#ffd23f]">
            <Crown className="size-5" /> You're the top pilot. Defend your crown!
          </p>
        )}
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-2.5">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onShare}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ffd23f] to-[#ff9a3c] px-4 py-3 font-display font-bold text-[#0b1030]"
        >
          <Share2 className="size-5" /> Share rank
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onPlay} className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 font-display font-bold">
          <Rocket className="size-5" /> {above ? "Climb higher" : "Play again"}
        </motion.button>
      </div>
    </motion.section>
  );
}

const PODIUM = [
  { place: 2, height: "h-24 sm:h-28", tone: "from-[#c9d1e4] to-[#8790ad]", delay: 0.15 },
  { place: 1, height: "h-32 sm:h-40", tone: "from-[#ffd76a] to-[#ff9a3c]", delay: 0 },
  { place: 3, height: "h-16 sm:h-20", tone: "from-[#f2b07a] to-[#c97a3f]", delay: 0.3 },
];

function Podium({ top, onPick }: { top: GameEntry[]; onPick: (e: GameEntry) => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
      {PODIUM.map(({ place, height, tone, delay }) => {
        const e = top[place - 1];
        if (!e) return <div key={place} />;
        return (
          <motion.button
            key={e.pid}
            type="button"
            onClick={() => onPick(e)}
            className="flex min-w-0 flex-col items-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + delay, type: "spring", stiffness: 260, damping: 20 }}
            whileHover={{ y: -4 }}
          >
            {place === 1 && (
              <motion.span animate={reduce ? undefined : { y: [0, -5, 0], rotate: [-4, 4, -4] }} transition={{ duration: 2.4, repeat: Infinity }}>
                <Crown className="mb-1 size-8 fill-[#ffc53d] text-[#e0a100]" />
              </motion.span>
            )}
            <Avatar e={e} className={clsx(place === 1 ? "size-16 text-2xl ring-4 ring-[#ffc53d]" : "size-12 text-lg ring-4 ring-surface")} />
            <span className={clsx("mt-2 w-full truncate text-center font-display text-sm font-extrabold sm:text-base", e.isMe && "text-[#c026d3] dark:text-[#ff7ad9]")}>
              {e.isMe ? "You" : e.name}
            </span>
            <span className="flex items-center gap-0.5 text-xs font-bold text-muted sm:text-sm">
              <Zap className="size-3.5 fill-[#ffd23f] text-[#e0a100]" />
              {e.score.toLocaleString("en-IN")}
            </span>
            <motion.div
              className={clsx("relative mt-2 w-full origin-bottom overflow-hidden rounded-t-2xl bg-gradient-to-b shadow-card", height, tone)}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.35 + delay, type: "spring", stiffness: 140, damping: 16 }}
            >
              <span className="block pt-2 text-center font-display text-3xl font-extrabold text-white/90 drop-shadow sm:text-4xl">{place}</span>
              {!reduce && (
                <motion.span
                  className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  initial={{ x: "-120%" }}
                  animate={{ x: "320%" }}
                  transition={{ delay: 1 + delay, duration: 1.2, repeat: Infinity, repeatDelay: 3 }}
                />
              )}
            </motion.div>
          </motion.button>
        );
      })}
    </div>
  );
}

function Bars({ label, mine, theirs, suffix = "" }: { label: string; mine: number; theirs: number; suffix?: string }) {
  const max = Math.max(1, mine, theirs);
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <div className="grid grid-cols-[3.5rem_1fr] items-center gap-x-2 gap-y-1">
        <span className="text-right font-display text-sm font-extrabold tabular-nums text-[#c026d3] dark:text-[#ff7ad9]">
          {mine.toLocaleString("en-IN")}
          {suffix}
        </span>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#ff7ad9]" initial={{ width: 0 }} animate={{ width: `${(mine / max) * 100}%` }} transition={{ duration: 0.7 }} />
        </div>
        <span className="text-right font-display text-sm font-extrabold tabular-nums">
          {theirs.toLocaleString("en-IN")}
          {suffix}
        </span>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full rounded-full bg-fg/70" initial={{ width: 0 }} animate={{ width: `${(theirs / max) * 100}%` }} transition={{ duration: 0.7, delay: 0.1 }} />
        </div>
      </div>
    </div>
  );
}

function Compare({ me, them }: { me: GameEntry | null; them: GameEntry }) {
  if (!me) return <p className="text-sm text-muted">Play this mission to compare yourself with {them.name}.</p>;
  const gap = them.score - me.score;
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3 text-xs font-bold">
        <span className="flex items-center gap-1.5 text-[#c026d3] dark:text-[#ff7ad9]">
          <span className="size-2.5 rounded-full bg-[#ff7ad9]" /> You
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          <span className="size-2.5 rounded-full bg-fg/70" /> {them.name}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Bars label="Points" mine={me.score} theirs={them.score} />
        <Bars label="Top level" mine={me.level} theirs={them.level} />
        <Bars label="Accuracy" mine={me.accuracy} theirs={them.accuracy} suffix="%" />
      </div>
      <p className="flex items-start gap-2 rounded-xl bg-[#a78bfa]/15 px-3 py-2 text-sm font-semibold">
        <Swords className="mt-0.5 size-4 shrink-0 text-[#7c3aed] dark:text-[#c084fc]" />
        {gap > 0
          ? `${them.name} is ${gap.toLocaleString("en-IN")} points ahead. One great run and you'll pass them!`
          : gap < 0
            ? `You're ${(-gap).toLocaleString("en-IN")} points ahead of ${them.name}. Keep flying!`
            : `You're level with ${them.name}. Next run decides it!`}
      </p>
    </div>
  );
}

function Row({ e, me, open, onToggle, index, overall }: { e: GameEntry; me: GameEntry | null; open: boolean; onToggle: () => void; index: number; overall: boolean }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.035, type: "spring", stiffness: 320, damping: 28 }}
      className={clsx("overflow-hidden rounded-2xl border-2 bg-surface", e.isMe ? "border-[#c084fc] shadow-pop ring-4 ring-[#c084fc]/20" : "border-line")}
    >
      <button type="button" onClick={onToggle} aria-expanded={open} disabled={e.isMe} className="flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default sm:px-4">
        <span className={clsx("w-8 text-center font-display text-lg font-extrabold tabular-nums", e.isMe ? "text-[#c026d3] dark:text-[#ff7ad9]" : "text-muted")}>{e.rank}</span>
        <Avatar e={e} className="size-10" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display font-extrabold">{e.isMe ? "You" : e.name}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-muted">
            <span>Level {e.level}</span>
            <span>{e.accuracy}% right</span>
            {overall ? <span>{e.sections} {e.sections === 1 ? "mission" : "missions"}</span> : <span>{e.runs} {e.runs === 1 ? "run" : "runs"}</span>}
          </span>
        </span>
        <span className="flex items-center gap-1 font-display font-extrabold tabular-nums">
          <Zap className="size-4 fill-[#ffd23f] text-[#e0a100]" />
          {e.score.toLocaleString("en-IN")}
        </span>
        {!e.isMe && <ChevronDown className={clsx("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="border-t-2 border-dashed border-line px-4 py-4">
              <Compare me={me} them={e} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/** The viewer's rank on every board, to jump straight to one. */
function MyRanks({ ranks, active, onPick }: { ranks?: Record<string, MyRank>; active: string; onPick: (id: string) => void }) {
  return (
    <section className="rounded-[28px] border-2 border-line bg-surface p-5 shadow-card">
      <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
        <Gauge className="size-5 text-[#7c3aed] dark:text-[#c084fc]" /> Your ranks in every mission
      </h3>
      <p className="text-sm text-muted">Tap one to see that scoreboard.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CATEGORIES.map((c, i) => {
          const r = ranks?.[c.id];
          return (
            <motion.button
              key={c.id}
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onPick(c.id)}
              className={clsx("flex items-center gap-2.5 rounded-2xl border-2 p-2.5 text-left transition-colors", c.id === active ? "border-fg bg-surface-2" : "border-line hover:border-fg/30")}
            >
              <span className={clsx("grid h-10 min-w-10 place-items-center rounded-xl px-1 font-display font-extrabold text-[#0b1030]", symbolSize(c.symbol, "text-2xl", "text-base"))} style={{ background: c.color }}>
                {c.symbol}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-muted">{c.name}</span>
                {r ? (
                  <span className="font-display text-lg font-extrabold tabular-nums">
                    #{r.rank}
                    <span className="text-xs font-semibold text-muted"> / {r.participants}</span>
                  </span>
                ) : (
                  <span className="text-sm font-bold text-muted">Not ranked</span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

/** For guests: their own bests on this device, and a sign-in prompt. */
function GuestView({ onPlay }: { onPlay: (id: SectionId) => void }) {
  const bests = useGalaxy((s) => s.sections);
  const played = SECTIONS.filter((s) => bests[s.id]);
  const fake: GameEntry[] = ["Aarav", "Diya", "Kabir"].map((name, i) => ({
    pid: name,
    name: `${name} ${"SNI"[i]}.`,
    score: 9800 - i * 1900,
    level: 9 - i,
    wave: 9 - i,
    runs: 6,
    accuracy: 90,
    sections: 4,
    rank: i + 1,
    isMe: false,
  }));
  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[28px] border-2 border-line bg-surface px-3 pt-6 sm:px-6">
        <div className="pointer-events-none select-none blur-[3px]" aria-hidden>
          <Podium top={fake} onPick={() => undefined} />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/60 p-6 text-center backdrop-blur-[1px]">
          <motion.span
            animate={{ rotate: [-8, 8, -8], y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#ffd23f] to-[#ff7ad9] text-[#0b1030] shadow-pop"
          >
            <Trophy className="size-7" />
          </motion.span>
          <p className="font-display text-2xl font-extrabold">Get on the scoreboard</p>
          <p className="max-w-xs text-sm text-muted">Sign in with Google to rank your missions against other pilots and see where you stand.</p>
          <AccountButton />
        </div>
      </section>
      <section className="rounded-[28px] border-2 border-line bg-surface p-5 shadow-card">
        <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
          <Target className="size-5 text-[#7c3aed] dark:text-[#c084fc]" /> Your best on this device
        </h3>
        {played.length === 0 ? (
          <p className="mt-1 text-sm text-muted">No missions flown yet. Pick one and blast off!</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {played.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onPlay(s.id)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-line p-2.5 text-left hover:border-fg/30">
                  <span className={clsx("grid h-10 min-w-10 place-items-center rounded-xl px-1 font-display font-extrabold text-[#0b1030]", symbolSize(s.symbol, "text-2xl", "text-base"))} style={{ background: s.color }}>
                    {s.symbol}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display font-extrabold">{s.name}</span>
                    <span className="text-xs font-semibold text-muted">Top level {bests[s.id]!.bestLevel}</span>
                  </span>
                  <span className="flex items-center gap-1 font-display font-extrabold tabular-nums">
                    <Zap className="size-4 fill-[#ffd23f] text-[#e0a100]" />
                    {bests[s.id]!.best.toLocaleString("en-IN")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading scoreboard">
      <div className="h-56 animate-pulse rounded-[28px] bg-surface-2" />
      <div className="h-44 animate-pulse rounded-[28px] bg-surface-2" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-2" />
      ))}
    </div>
  );
}

// ---------- screen ----------

export interface RankShare {
  category: Category;
  rank: number;
  participants: number;
  points: number;
  period: Period;
}

export function Scoreboard({
  initial,
  onPlay,
  onShareRank,
  onShareGame,
}: {
  /** Board to open first: "overall" or a mission. */
  initial: string;
  onPlay: (id: SectionId) => void;
  onShareRank: (r: RankShare) => void;
  onShareGame: (category: Category) => void;
}) {
  const status = useAuth((s) => s.status);
  const userId = useAuth((s) => s.user?.id);
  const signedIn = status === "signedIn";
  const [cat, setCat] = useState(initial);
  const [period, setPeriod] = useState<Period>("week");
  const [openPid, setOpenPid] = useState<string | null>(null);
  const { board, loading } = useGameBoardData(GAME, cat, period);
  const ranks = useMyGameRanks(GAME, period);
  const error = useGameBoard((s) => s.error);
  const category = categoryOf(cat);

  useEffect(() => {
    if (!signedIn) return;
    void loadGameBoard(GAME, cat, period);
    void loadGameRanks(GAME, period);
  }, [signedIn, cat, period]);

  const list = useMemo(() => (board ? [...board.top, ...board.around] : []), [board]);
  const me = board?.me ?? null;
  const above = useMemo(() => {
    if (!me) return null;
    const i = list.findIndex((e) => e.isMe);
    return i > 0 && list[i - 1].rank < me.rank ? list[i - 1] : null;
  }, [list, me]);
  const moved = useMoved(userId, `${cat}:${period}`, me?.rank);

  // A little party when you're on the podium.
  useEffect(() => {
    if (me && me.rank <= 3) {
      const t = setTimeout(() => {
        burst(null, true);
        play("levelup");
      }, 800);
      return () => clearTimeout(t);
    }
  }, [me?.rank, cat, period]); // eslint-disable-line react-hooks/exhaustive-deps

  const playCat = () => onPlay(cat === OVERALL ? "mixed" : (cat as SectionId));
  const pickCat = (id: string) => {
    setCat(id);
    setOpenPid(null);
  };
  const refresh = () => {
    void loadGameBoard(GAME, cat, period, true);
    void loadGameRanks(GAME, period, true);
  };
  const rest = board ? board.top.slice(3) : [];

  return (
    <div className="grid gap-5 pb-12">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0b1030] via-[#3b1d8f] to-[#c026d3] p-6 text-white shadow-pop"
      >
        {["★", "✦", "☄", "✧", "★", "⋆"].map((g, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="pointer-events-none absolute font-display font-extrabold text-white/15"
            style={{ left: `${(i * 37 + 8) % 92}%`, top: `${(i * 53 + 12) % 80}%`, fontSize: 26 + ((i * 13) % 30) }}
            animate={{ y: [0, -10, 0], rotate: [0, i % 2 ? 10 : -10, 0] }}
            transition={{ duration: 4 + (i % 3), repeat: Infinity, delay: i * 0.3 }}
          >
            {g}
          </motion.span>
        ))}
        <div className="relative flex items-center gap-4">
          <motion.span
            initial={{ rotate: -25, scale: 0.4 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 12 }}
            className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#ffd23f] to-[#ff9a3c] text-[#0b1030] shadow-pop"
          >
            <Trophy className="size-9" strokeWidth={2.5} />
          </motion.span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Scoreboard</h2>
            <p className="font-semibold text-white/85">Who's the best pilot in the galaxy?</p>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.06 }}
            onClick={() => onShareGame(category)}
            aria-label="Share Galaxy Guardian"
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur hover:bg-white/25"
          >
            <Share2 className="size-5" />
          </motion.button>
        </div>
        <p className="relative mt-4 rounded-2xl bg-black/20 px-3 py-2 text-sm font-semibold text-white/85">
          {cat === OVERALL ? (
            <>
              <b className="text-white">Overall</b> adds up your best score in every mission. Fly more missions to climb!
            </>
          ) : (
            <>
              <b className="text-white">{category.name}</b> ranks everyone by their best single run on this mission.
            </>
          )}
        </p>
      </motion.section>

      <CategoryChips active={cat} ranks={ranks} onPick={pickCat} />

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <PeriodTabs period={period} onChange={(p) => (setPeriod(p), setOpenPid(null))} />
        </div>
        {signedIn && (
          <motion.button
            whileTap={{ scale: 0.9, rotate: 180 }}
            onClick={refresh}
            aria-label="Refresh"
            className="grid size-12 shrink-0 place-items-center rounded-2xl border-2 border-line bg-surface text-muted hover:text-fg"
          >
            <RefreshCw className={clsx("size-5", loading && "animate-spin")} />
          </motion.button>
        )}
      </div>

      {status === "loading" ? (
        <Skeleton />
      ) : !signedIn ? (
        <GuestView onPlay={onPlay} />
      ) : !board ? (
        error ? <p className="rounded-2xl bg-bad-soft p-4 text-center font-semibold text-bad">{error}</p> : <Skeleton />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={`${cat}:${period}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-5">
            <MyCard
              cat={category}
              me={me}
              participants={board.participants}
              above={above}
              moved={moved}
              period={period}
              onPlay={playCat}
              onShare={() => me && onShareRank({ category, rank: me.rank, participants: board.participants, points: me.score, period })}
            />

            {board.participants === 0 ? (
              <p className="rounded-[28px] border-2 border-dashed border-line bg-surface p-8 text-center font-display text-lg font-extrabold">
                No one has flown this mission {PERIOD_TEXT[period]} yet. Be the first! 🚀
              </p>
            ) : (
              <>
                <section className="rounded-[28px] border-2 border-line bg-surface px-3 pt-6 sm:px-6">
                  <h3 className="mb-4 flex items-center justify-center gap-2 font-display text-lg font-extrabold">
                    <Users className="size-5 text-[#7c3aed] dark:text-[#c084fc]" /> Top pilots · {board.participants.toLocaleString("en-IN")} flying
                  </h3>
                  <Podium top={board.top} onPick={(e) => !e.isMe && setOpenPid(e.pid)} />
                </section>

                {(rest.length > 0 || board.around.length > 0 || board.top.slice(0, 3).some((e) => e.pid === openPid)) && (
                  <ol className="grid gap-2">
                    {board.top
                      .slice(0, 3)
                      .filter((e) => e.pid === openPid)
                      .map((e, i) => (
                        <Row key={e.pid} e={e} me={me} open onToggle={() => setOpenPid(null)} index={i} overall={cat === OVERALL} />
                      ))}
                    {rest.map((e, i) => (
                      <Row key={e.pid} e={e} me={me} open={openPid === e.pid} onToggle={() => setOpenPid(openPid === e.pid ? null : e.pid)} index={i} overall={cat === OVERALL} />
                    ))}
                    {board.around.length > 0 && (
                      <li className="py-1 text-center font-display text-xl font-extrabold tracking-[0.5em] text-muted" aria-hidden>
                        ···
                      </li>
                    )}
                    {board.around.map((e, i) => (
                      <Row key={e.pid} e={e} me={me} open={openPid === e.pid} onToggle={() => setOpenPid(openPid === e.pid ? null : e.pid)} index={i} overall={cat === OVERALL} />
                    ))}
                  </ol>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {signedIn && <MyRanks ranks={ranks} active={cat} onPick={pickCat} />}
    </div>
  );
}
