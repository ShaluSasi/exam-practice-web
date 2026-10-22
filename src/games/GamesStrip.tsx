import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Brain, Crown, Flame, Play } from "lucide-react";
import clsx from "clsx";
import { useGames, useGameStreak } from "../store/games";
import { useNav } from "../store/nav";
import { useCurrentGrade } from "../store/profile";
import { GAMES, type GameMeta } from "./registry";

const TEASERS: Record<GameMeta["id"], string[]> = {
  galaxy: ["7 × 8", "√225", "2⁵ × 2³"],
  rush: ["7 × 8", "√144", "15% of 80", "2³ × 2⁴", "½ + ⅓", "13²"],
  balance: ["2H₂ + O₂ → 2H₂O", "N₂ + 3H₂ → 2NH₃", "4Fe + 3O₂ → 2Fe₂O₃", "CH₄ + 2O₂ → …"],
  facts: ["Sound in a vacuum?", "√2 is rational?", "Air is a mixture?", "Xylem carries food?"],
};

function Teaser({ items }: { items: string[] }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), 2200);
    return () => clearInterval(t);
  }, [items.length, reduce]);
  return (
    <div className="relative h-9 overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={i}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="absolute inset-x-0 truncate font-display text-2xl font-extrabold"
        >
          {items[i]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function GameTile({ g, index }: { g: GameMeta; index: number }) {
  const record = useGames((s) => s.records[g.id]);
  const playGame = useNav((s) => s.playGame);
  const Icon = g.icon;
  return (
    <motion.button
      type="button"
      onClick={() => playGame(g.id)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      whileHover={{ y: -4, rotate: index === 1 ? 0 : index === 0 ? -0.6 : 0.6 }}
      whileTap={{ scale: 0.97 }}
      className={clsx(
        "group relative w-[78%] shrink-0 snap-start overflow-hidden rounded-[26px] bg-gradient-to-br p-5 text-left text-white shadow-pop sm:w-auto",
        g.gradient,
      )}
    >
      <Icon className="pointer-events-none absolute -bottom-6 -right-6 size-36 rotate-12 text-white/10 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110" />
      <div className="relative flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-2xl bg-white text-[#1b1f3b] shadow-pop">
          <Icon className="size-6" strokeWidth={2.5} />
        </span>
        {record ? (
          <span className="flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-xs font-bold backdrop-blur">
            <Crown className="size-3.5 fill-[#ffd23f] text-[#ffd23f]" /> {record.best} {g.unit}
          </span>
        ) : (
          <motion.span
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="rounded-full bg-[#ffd23f] px-2.5 py-1 text-xs font-extrabold text-[#1b1f3b]"
          >
            NEW
          </motion.span>
        )}
      </div>
      <p className="relative mt-4 text-xs font-bold uppercase tracking-wider text-white/75">
        {g.subject} · {g.minutes}
      </p>
      <h3 className="relative font-display text-2xl font-extrabold tracking-tight">{g.title}</h3>
      <div className="relative mt-3 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur">
        <Teaser items={TEASERS[g.id]} />
      </div>
      <span className="relative mt-4 flex items-center gap-2 font-display font-extrabold">
        <span className="grid size-8 place-items-center rounded-full bg-white text-[#1b1f3b] transition-transform group-hover:scale-110">
          <Play className="size-4 fill-current" />
        </span>
        Play
      </span>
    </motion.button>
  );
}

/** Big animated card for the flagship game: asteroids fall, the ship fires, rocks burst. */
function FeaturedTile({ g }: { g: GameMeta }) {
  const reduce = useReducedMotion();
  const record = useGames((s) => s.records[g.id]);
  const playGame = useNav((s) => s.playGame);
  const rocks = [
    { label: "56", x: "18%", d: 0, dur: 4.2 },
    { label: "54", x: "42%", d: 1.3, dur: 4.8 },
    { label: "63", x: "66%", d: 0.6, dur: 4.4 },
    { label: "48", x: "86%", d: 2, dur: 5 },
  ];
  return (
    <motion.button
      type="button"
      onClick={() => playGame(g.id)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.985 }}
      className="group relative mb-3 block h-60 w-full overflow-hidden rounded-[28px] bg-[#060818] text-left text-white shadow-pop sm:h-56"
    >
      <div className="absolute inset-0 bg-[radial-gradient(70%_90%_at_15%_0%,rgba(124,58,237,0.55),transparent),radial-gradient(60%_80%_at_95%_30%,rgba(236,72,153,0.4),transparent),radial-gradient(60%_50%_at_60%_120%,rgba(56,189,248,0.5),transparent)]" />
      {Array.from({ length: 28 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute size-0.5 rounded-full bg-white"
          style={{ left: `${(i * 37) % 100}%`, top: `${(i * 61) % 100}%` }}
          animate={reduce ? undefined : { opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.5 + (i % 5) * 0.4, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
      {/* Falling asteroids, on the right half */}
      <div className="absolute inset-y-0 right-0 w-[58%] sm:w-1/2">
        {rocks.map((r) => (
          <motion.span
            key={r.label}
            className="absolute grid size-11 place-items-center font-display text-sm font-extrabold [text-shadow:0_1px_2px_#000]"
            style={{
              left: r.x,
              borderRadius: "46% 54% 42% 58% / 52% 44% 56% 48%",
              background: "radial-gradient(circle at 32% 28%, #8a6a5a, #3a2a24 70%)",
              boxShadow: "inset -4px -5px 0 rgba(0,0,0,0.35), 0 0 16px rgba(255,154,77,0.4)",
            }}
            initial={{ top: "-20%" }}
            animate={reduce ? { top: "30%" } : { top: ["-20%", "70%"], rotate: [0, 120] }}
            transition={{ duration: r.dur, repeat: Infinity, delay: r.d, ease: "linear" }}
          >
            {r.label}
          </motion.span>
        ))}
        <motion.span
          className="absolute bottom-3 left-1/2 h-16 w-11 -translate-x-1/2"
          animate={reduce ? undefined : { x: [-24, 24, -24] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg viewBox="0 0 60 90" className="h-full w-full" aria-hidden>
            <path d="M22 66 Q30 92 38 66 Z" fill="#ffb03a">
              <animate attributeName="d" values="M22 66 Q30 92 38 66 Z;M22 66 Q30 80 38 66 Z;M22 66 Q30 92 38 66 Z" dur="0.3s" repeatCount="indefinite" />
            </path>
            <path d="M30 2 C40 14 44 34 42 64 L18 64 C16 34 20 14 30 2 Z" fill="#f1f5f9" stroke="#334155" strokeWidth="2" />
            <circle cx="30" cy="30" r="7" fill="#5ee7ff" stroke="#1e3a8a" strokeWidth="2" />
            <path d="M18 44 L4 64 L18 60 Z M42 44 L56 64 L42 60 Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" />
          </svg>
        </motion.span>
        <motion.span
          className="absolute bottom-20 left-1/2 w-1 origin-bottom -translate-x-1/2 rounded-full bg-[#5ee7ff] shadow-[0_0_12px_#5ee7ff]"
          animate={reduce ? undefined : { height: [0, 120, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1.1 }}
        />
      </div>
      <div className="relative flex h-full max-w-[58%] flex-col p-5 sm:max-w-[50%] sm:p-6">
        <div className="flex items-center gap-2">
          <motion.span
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="rounded-full bg-gradient-to-r from-[#ffd23f] to-[#ff7ad9] px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-[#1b1f3b]"
          >
            {record ? "FEATURED" : "NEW · FEATURED"}
          </motion.span>
          {record && (
            <span className="flex items-center gap-1 text-xs font-bold text-white/80">
              <Crown className="size-3.5 fill-[#ffd23f] text-[#ffd23f]" /> {record.best}
            </span>
          )}
        </div>
        <h3 className="mt-2 font-display text-[28px] font-extrabold leading-none tracking-tight sm:text-4xl">{g.title}</h3>
        <p className="mt-1.5 text-sm font-semibold text-white/80 sm:text-base">{g.tagline}</p>
        <span className="mt-auto flex w-fit items-center gap-2 rounded-2xl bg-white px-4 py-2.5 font-display font-extrabold text-[#1b1f3b] shadow-[0_4px_0_0_rgb(0_0_0/0.3)] transition-transform group-hover:scale-105">
          <Play className="size-4 fill-current" /> Play now
        </span>
      </div>
    </motion.button>
  );
}

/** "Brain games" row on the home screen. */
export function GamesStrip() {
  const streak = useGameStreak();
  const solved = useGames((s) => s.solved);
  const grade = useCurrentGrade();
  // Hide games whose content is above the student's class, e.g. "Balance It!" needs Class 10 chemistry.
  const games = GAMES.filter((g) => !g.minGrade || grade >= g.minGrade);
  const [featured, ...rest] = games;
  return (
    <section id="games" className="mb-10 scroll-mt-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            <Brain className="size-7 text-english" /> Brain games
          </h2>
          <p className="text-muted">Quick games that build exam skills.</p>
        </div>
        <div className="flex gap-2">
          {streak > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-bad-soft px-3 py-1.5 font-display text-sm font-extrabold text-bad">
              <Flame className="size-4 fill-brand" /> {streak}-day streak
            </span>
          )}
          {solved > 0 && (
            <span className="rounded-full bg-ok-soft px-3 py-1.5 font-display text-sm font-extrabold text-ok">{solved} solved in games</span>
          )}
        </div>
      </div>
      {featured && <FeaturedTile g={featured} />}
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {rest.map((g, i) => (
          <GameTile key={g.id} g={g} index={i} />
        ))}
      </div>
    </section>
  );
}
