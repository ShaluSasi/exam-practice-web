import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, BookOpenCheck, Check, Crown, GraduationCap, Lightbulb, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import clsx from "clsx";
import { RichText } from "../components/RichText";
import { IconToggle } from "../components/TopBar";
import { burst } from "../lib/celebrate";
import { play } from "../lib/sound";
import { useGames } from "../store/games";
import { useProfile } from "../store/profile";
import type { GameMeta } from "./registry";

export function GameTopBar({ title, onBack, children }: { title: string; onBack: () => void; children?: ReactNode }) {
  const { soundOn, toggleSound } = useProfile();
  return (
    <header className="flex items-center gap-3 py-4">
      <IconToggle label="Back" onClick={onBack}>
        <ArrowLeft className="size-[18px]" />
      </IconToggle>
      <h1 className="min-w-0 flex-1 truncate font-display text-lg font-extrabold tracking-tight sm:text-xl">{title}</h1>
      {children}
      <IconToggle label={soundOn ? "Mute sounds" : "Turn sounds on"} onClick={toggleSound}>
        {soundOn ? <Volume2 className="size-[18px]" /> : <VolumeX className="size-[18px]" />}
      </IconToggle>
    </header>
  );
}

/** Decorative floating shapes inside a game's gradient hero. */
export function Sparkles({ glyphs }: { glyphs: string[] }) {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {glyphs.map((g, i) => (
        <motion.span
          key={i}
          className="absolute font-display font-extrabold text-white/15"
          style={{ left: `${(i * 37 + 8) % 92}%`, top: `${(i * 53 + 12) % 80}%`, fontSize: 28 + ((i * 13) % 34) }}
          animate={reduce ? undefined : { y: [0, -10, 0], rotate: [0, i % 2 ? 8 : -8, 0] }}
          transition={{ duration: 4 + (i % 4), repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
        >
          {g}
        </motion.span>
      ))}
    </div>
  );
}

/** Start screen: what the game is, how to play, what it teaches, and the best score so far. */
export function GameIntro({
  meta,
  glyphs,
  onPlay,
  playLabel = "Play",
  actions,
  children,
}: {
  meta: GameMeta;
  glyphs: string[];
  onPlay?: () => void;
  playLabel?: ReactNode;
  /** More buttons next to Play, e.g. a scoreboard or share button. */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const record = useGames((s) => s.records[meta.id]);
  const Icon = meta.icon;
  return (
    <div className="pb-12">
      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={clsx("relative overflow-hidden rounded-[28px] bg-gradient-to-br p-6 text-white shadow-pop sm:p-8", meta.gradient)}
      >
        <Sparkles glyphs={glyphs} />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
            {meta.subject} · {meta.minutes}
          </span>
          <motion.div
            initial={{ rotate: -20, scale: 0.4 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
            className="mt-5 grid size-16 place-items-center rounded-2xl bg-white text-[#1b1f3b] shadow-pop"
          >
            <Icon className="size-9" strokeWidth={2.5} />
          </motion.div>
          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{meta.title}</h2>
          <p className="mt-1 text-lg font-semibold text-white/90">{meta.tagline}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {onPlay && (
              <motion.button
                type="button"
                onClick={() => {
                  play("tap");
                  onPlay();
                }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96, y: 2 }}
                animate={{ boxShadow: ["0 6px 0 0 rgb(0 0 0 / 0.25)", "0 6px 24px 4px rgb(255 255 255 / 0.45)", "0 6px 0 0 rgb(0 0 0 / 0.25)"] }}
                transition={{ boxShadow: { duration: 2, repeat: Infinity } }}
                className="flex items-center gap-2 rounded-2xl bg-white px-8 py-4 font-display text-xl font-extrabold text-[#1b1f3b]"
              >
                <Play className="size-5 fill-current" /> {playLabel}
              </motion.button>
            )}
            {actions}
            {record && (
              <span className="flex items-center gap-2 rounded-2xl bg-black/20 px-4 py-3 font-display font-bold backdrop-blur">
                <Crown className="size-5 fill-[#ffd23f] text-[#ffd23f]" />
                Best {record.best} {meta.unit}
                <span className="font-sans text-sm font-semibold text-white/70">· played {record.plays}×</span>
              </span>
            )}
          </div>
        </div>
      </motion.section>

      {children}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl border-2 border-line bg-surface p-5 shadow-card"
        >
          <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
            <Lightbulb className="size-5 text-brand" /> How to play
          </h3>
          <ol className="mt-3 space-y-2.5">
            {meta.how.map((h, i) => (
              <li key={h} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-fg font-display text-xs font-extrabold text-bg">{i + 1}</span>
                <span className="text-[15px] leading-snug">{h}</span>
              </li>
            ))}
          </ol>
        </motion.section>
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="rounded-3xl border-2 border-line bg-surface p-5 shadow-card"
        >
          <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
            <GraduationCap className="size-5 text-maths" /> What you practise
          </h3>
          <p className="mt-1 text-sm text-muted">Straight from the CBSE syllabus.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {meta.learn.map((l) => (
              <span key={l} className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-semibold">
                <Check className="size-3.5 text-ok" strokeWidth={3} /> {l}
              </span>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration: Math.min(1.6, 0.4 + to / 400), ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [to]);
  return <>{n}</>;
}

export interface Stat {
  label: string;
  value: string | number;
}

export interface SkillScore {
  name: string;
  right: number;
  total: number;
}

export interface Mistake {
  prompt: string;
  /** What the student picked, if it helps to show it. */
  given?: string;
  answer: string;
  tip: string;
}

/** End screen: score, personal best, skill breakdown and a review of every mistake with its explanation. */
export function GameOver({
  meta,
  score,
  newBest,
  headline,
  stats,
  skills,
  mistakes,
  onAgain,
  onExit,
  extra,
  actions,
}: {
  extra?: ReactNode;
  /** More buttons next to "Play again", e.g. share or scoreboard. */
  actions?: ReactNode;
  meta: GameMeta;
  score: number;
  newBest: boolean;
  headline: string;
  stats: Stat[];
  skills: SkillScore[];
  mistakes: Mistake[];
  onAgain: () => void;
  onExit: () => void;
}) {
  const best = useGames((s) => s.records[meta.id]?.best ?? 0);
  const scoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    play("finish");
    if (newBest) {
      const t = setTimeout(() => burst(scoreRef.current, true), 500);
      return () => clearTimeout(t);
    }
  }, [newBest]);

  return (
    <div className="pb-12">
      <motion.section
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className={clsx("relative overflow-hidden rounded-[28px] bg-gradient-to-br p-6 text-center text-white shadow-pop sm:p-8", meta.gradient)}
      >
        <Sparkles glyphs={["★", "✦", "★", "✧", "✦", "★"]} />
        <div className="relative">
          <p className="font-display text-xl font-bold text-white/90">{headline}</p>
          <div ref={scoreRef} className="mt-2 font-display text-7xl font-extrabold tabular-nums tracking-tight sm:text-8xl">
            <CountUp to={score} />
          </div>
          <p className="font-semibold uppercase tracking-widest text-white/80">{meta.unit}</p>
          {newBest ? (
            <motion.div
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: -3 }}
              transition={{ delay: 0.9, type: "spring", stiffness: 300, damping: 12 }}
              className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-[#ffd23f] px-4 py-2 font-display text-lg font-extrabold text-[#1b1f3b] shadow-pop"
            >
              <Crown className="size-5 fill-current" /> New personal best!
            </motion.div>
          ) : (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-black/20 px-4 py-2 font-display font-bold">
              <Crown className="size-4 fill-[#ffd23f] text-[#ffd23f]" /> Best {best} · {Math.max(0, best - score)} to beat it
            </p>
          )}
          <dl className="mx-auto mt-6 grid max-w-lg grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur"
              >
                <dd className="font-display text-2xl font-extrabold tabular-nums">{s.value}</dd>
                <dt className="text-xs font-semibold text-white/80">{s.label}</dt>
              </motion.div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <motion.button
              type="button"
              onClick={onAgain}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 rounded-2xl bg-white px-7 py-3.5 font-display text-lg font-extrabold text-[#1b1f3b] shadow-[0_5px_0_0_rgb(0_0_0/0.25)]"
            >
              <RotateCcw className="size-5" /> Play again
            </motion.button>
            {actions}
            <button
              type="button"
              onClick={onExit}
              className="rounded-2xl border-2 border-white/40 px-6 py-3.5 font-display text-lg font-bold hover:bg-white/10"
            >
              All games
            </button>
          </div>
        </div>
      </motion.section>

      {extra}

      {skills.length > 0 && (
        <section className="mt-5 rounded-3xl border-2 border-line bg-surface p-5 shadow-card">
          <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
            <GraduationCap className="size-5 text-maths" /> What you practised
          </h3>
          <ul className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {skills.map((s, i) => {
              const pct = Math.round((s.right / s.total) * 100);
              return (
                <li key={s.name}>
                  <div className="flex items-baseline justify-between gap-2 text-sm font-semibold">
                    <span>{s.name}</span>
                    <span className="tabular-nums text-muted">
                      {s.right}/{s.total}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-2">
                    <motion.div
                      className={clsx("h-full rounded-full", pct >= 80 ? "bg-ok" : pct >= 50 ? "bg-brand" : "bg-bad")}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(pct, 4)}%` }}
                      transition={{ delay: 0.4 + i * 0.06, duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-5 rounded-3xl border-2 border-line bg-surface p-5 shadow-card">
        <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
          <BookOpenCheck className="size-5 text-ok" /> {mistakes.length ? "Learn from your mistakes" : "No mistakes. Brilliant!"}
        </h3>
        {mistakes.length === 0 && <p className="mt-1 text-muted">Every answer was right. Try to beat your score next time.</p>}
        <ul className="mt-3 space-y-3">
          {mistakes.map((m, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              className="rounded-2xl border-2 border-line p-4"
            >
              <RichText text={m.prompt} className="block font-semibold" />
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {m.given && (
                  <span className="flex items-center gap-1 rounded-lg bg-bad-soft px-2 py-1 font-semibold">
                    <X className="size-3.5 text-bad" strokeWidth={3} /> <RichText text={m.given} />
                  </span>
                )}
                <span className="flex items-center gap-1 rounded-lg bg-ok-soft px-2 py-1 font-semibold">
                  <Check className="size-3.5 text-ok" strokeWidth={3} /> <RichText text={m.answer} />
                </span>
              </div>
              <p className="mt-2 flex gap-2 text-[15px] text-muted">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" />
                <RichText text={m.tip} />
              </p>
            </motion.li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** A "+20" that floats up and fades out. Re-mount with a new key for each score. */
export function PointsPop({ text, className }: { text: string; className?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 0, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], y: -56, scale: [0.6, 1.25, 1, 1] }}
      transition={{ duration: 0.9, ease: "easeOut" }}
      className={clsx("pointer-events-none absolute font-display text-3xl font-extrabold drop-shadow", className)}
      aria-hidden
    >
      {text}
    </motion.span>
  );
}
