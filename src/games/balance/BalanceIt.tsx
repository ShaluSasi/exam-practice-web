import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, ChevronDown, ChevronUp, Lightbulb, Lock, RotateCcw, Scale, Star, X } from "lucide-react";
import clsx from "clsx";
import { burst } from "../../lib/celebrate";
import { play } from "../../lib/sound";
import { useGames } from "../../store/games";
import { GameIntro, GameTopBar } from "../GameKit";
import { gameMeta } from "../registry";
import { ATOM_COLOR, EQUATIONS, countSide, elementsOf, type Equation } from "./equations";

const meta = gameMeta("balance");
const MAX_COEF = 15;
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Formula with subscripts: "Fe2O3" → Fe₂O₃. */
function Formula({ f, className }: { f: string; className?: string }) {
  return (
    <span className={className}>
      {f.split(/(\d+)/).map((p, i) => (/^\d+$/.test(p) ? <sub key={i} className="text-[0.62em]">{p}</sub> : p))}
    </span>
  );
}

function starsFor(eq: Equation, moves: number, hints: number) {
  const min = eq.solution.reduce((a, c) => a + c - 1, 0);
  const base = moves <= min + 2 ? 3 : moves <= min * 2 + 6 ? 2 : 1;
  return Math.min(base, hints === 0 ? 3 : hints === 1 ? 2 : 1);
}

export function BalanceIt({ onExit }: { onExit: () => void }) {
  const [level, setLevel] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const stars = useGames((s) => s.stars);
  const firstOpen = EQUATIONS.findIndex((e) => !stars[e.id]);

  if (level === null) {
    return (
      <>
        <GameTopBar title={meta.title} onBack={onExit} />
        <GameIntro meta={meta} glyphs={["H₂", "O₂", "→", "CO₂", "Fe", "⚗", "NaCl", "+"]} onPlay={() => setLevel(firstOpen === -1 ? 0 : firstOpen)}>
          <LevelMap onPick={setLevel} />
        </GameIntro>
      </>
    );
  }

  return (
    <Puzzle
      key={`${level}-${attempt}`}
      index={level}
      onBack={() => setLevel(null)}
      onNext={() => setLevel(level + 1 < EQUATIONS.length ? level + 1 : null)}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}

function LevelMap({ onPick }: { onPick: (i: number) => void }) {
  const stars = useGames((s) => s.stars);
  const total = EQUATIONS.reduce((a, e) => a + (stars[e.id] ?? 0), 0);
  return (
    <section className="mt-5 rounded-3xl border-2 border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-extrabold">Levels</h3>
        <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 font-display font-extrabold tabular-nums">
          <Star className="size-4 fill-[#ffc53d] text-[#ffc53d]" /> {total}/{EQUATIONS.length * 3}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-8">
        {EQUATIONS.map((e, i) => {
          const s = stars[e.id] ?? 0;
          const open = i === 0 || (stars[EQUATIONS[i - 1].id] ?? 0) > 0;
          const isNext = open && s === 0;
          return (
            <motion.button
              key={e.id}
              type="button"
              disabled={!open}
              onClick={() => {
                play("tap");
                onPick(i);
              }}
              title={open ? e.name : "Solve the level before to unlock"}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: isNext ? [1, 1.07, 1] : 1 }}
              transition={isNext ? { scale: { duration: 1.4, repeat: Infinity } } : { delay: i * 0.02 }}
              whileHover={open ? { y: -3 } : undefined}
              whileTap={open ? { scale: 0.92 } : undefined}
              className={clsx(
                "flex aspect-square flex-col items-center justify-center rounded-2xl font-display font-extrabold",
                !open
                  ? "bg-surface-2 text-muted"
                  : s > 0
                    ? "bg-gradient-to-br from-[#0b93d4] to-[#a24ee8] text-white shadow-[0_4px_0_0_rgb(0_0_0/0.2)]"
                    : "border-2 border-dashed border-chemistry bg-chemistry/10 text-chemistry",
              )}
            >
              {open ? <span className="text-xl sm:text-2xl">{i + 1}</span> : <Lock className="size-5" />}
              {open && (
                <span className="mt-0.5 flex gap-px">
                  {[1, 2, 3].map((k) => (
                    <Star key={k} className={clsx("size-3", k <= s ? "fill-[#ffd23f] text-[#ffd23f]" : s > 0 ? "text-white/40" : "text-chemistry/40")} />
                  ))}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

function AtomDots({ el, n, align }: { el: string; n: number; align: "left" | "right" }) {
  const shown = Math.min(n, 12);
  return (
    <div className={clsx("flex min-w-0 flex-1 flex-wrap items-center gap-1", align === "left" ? "justify-end" : "justify-start")}>
      {align === "right" && <span className="mr-1 font-display text-lg font-extrabold tabular-nums">{n}</span>}
      <AnimatePresence initial={false}>
        {Array.from({ length: shown }, (_, i) => (
          <motion.span
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="size-3 rounded-full ring-1 ring-black/10 sm:size-3.5"
            style={{ background: ATOM_COLOR[el] ?? "#888" }}
          />
        ))}
      </AnimatePresence>
      {n > shown && <span className="text-xs font-bold text-muted">+{n - shown}</span>}
      {align === "left" && <span className="ml-1 font-display text-lg font-extrabold tabular-nums">{n}</span>}
    </div>
  );
}

/** A see-saw that tips towards the side with more atoms and levels out when balanced. */
function SeeSaw({ left, right, balanced }: { left: number; right: number; balanced: boolean }) {
  const reduce = useReducedMotion();
  const tilt = balanced ? 0 : Math.max(-14, Math.min(14, (right - left) * 2.5));
  const wobble = !balanced && left === right;
  return (
    <svg viewBox="0 0 300 120" className="mx-auto h-28 w-full max-w-sm" aria-hidden>
      <path d="M150 62 L128 108 H172 Z" fill="var(--line)" stroke="var(--muted)" strokeWidth="2" strokeLinejoin="round" />
      <motion.g
        style={{ originX: "150px", originY: "58px" }}
        animate={{ rotate: wobble && !reduce ? [-3, 3, -3] : tilt }}
        transition={wobble ? { duration: 1.2, repeat: Infinity } : { type: "spring", stiffness: 120, damping: 9 }}
      >
        <rect x="24" y="54" width="252" height="8" rx="4" fill={balanced ? "var(--ok)" : "var(--fg)"} />
        {[
          { x: 48, n: left },
          { x: 252, n: right },
        ].map((p) => (
          <g key={p.x}>
            <line x1={p.x} y1="54" x2={p.x} y2="46" stroke="var(--fg)" strokeWidth="3" />
            <path d={`M${p.x - 34} 26 Q${p.x} 66 ${p.x + 34} 26 Z`} fill="var(--surface-2)" stroke="var(--fg)" strokeWidth="2.5" strokeLinejoin="round" />
            <text x={p.x} y="40" textAnchor="middle" className="fill-fg font-display text-[15px] font-extrabold">
              {p.n}
            </text>
          </g>
        ))}
      </motion.g>
      <circle cx="150" cy="58" r="6" fill={balanced ? "var(--ok)" : "var(--brand)"} />
    </svg>
  );
}

function Puzzle({ index, onBack, onNext, onRetry }: { index: number; onBack: () => void; onNext: () => void; onRetry: () => void }) {
  const eq = EQUATIONS[index];
  const all = [...eq.left, ...eq.right];
  const nl = eq.left.length;
  const [coefs, setCoefs] = useState<number[]>(() => all.map(() => 1));
  const [moves, setMoves] = useState(0);
  const [hinted, setHinted] = useState<number[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [earned, setEarned] = useState<number | null>(null);
  const completeLevel = useGames((s) => s.completeLevel);
  const prevStars = useRef(useGames.getState().stars[eq.id] ?? 0);
  const eqRef = useRef<HTMLDivElement>(null);

  const els = useMemo(() => elementsOf(eq), [eq]);
  const L = countSide(eq.left, coefs.slice(0, nl));
  const R = countSide(eq.right, coefs.slice(nl));
  const balanced = els.every((el) => L[el] === R[el]);
  const simplest = coefs.reduce(gcd) === 1;
  const sum = (side: Record<string, number>) => Object.values(side).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (!balanced || !simplest || earned !== null) return;
    const s = starsFor(eq, moves, hinted.length);
    setEarned(s);
    completeLevel(eq.id, s);
    play("finish");
    setTimeout(() => burst(eqRef.current, true), 150);
  }, [balanced, simplest, earned, eq, moves, hinted.length, completeLevel]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3800);
    return () => clearTimeout(t);
  }, [note]);

  const change = (k: number, d: number) => {
    if (earned !== null || hinted.includes(k)) return;
    const v = coefs[k] + d;
    if (v < 1 || v > MAX_COEF) return;
    play("tap");
    setMoves((m) => m + 1);
    setCoefs(coefs.map((c, i) => (i === k ? v : c)));
  };

  const hint = () => {
    if (earned !== null) return;
    const k = all.findIndex((_, i) => !hinted.includes(i) && coefs[i] !== eq.solution[i]);
    const target = k === -1 ? all.findIndex((_, i) => !hinted.includes(i)) : k;
    if (target === -1) return;
    play("levelup");
    setHinted([...hinted, target]);
    setCoefs(coefs.map((c, i) => (i === target ? eq.solution[i] : c)));
    setNote(`Hint: put ${eq.solution[target]} in front of ${all[target]}. It is now locked.`);
  };

  const species = (k: number) => {
    const locked = hinted.includes(k);
    return (
      <div key={k} className="flex flex-col items-center">
        <motion.button
          type="button"
          aria-label={`More ${all[k]}`}
          onClick={() => change(k, 1)}
          whileTap={{ scale: 0.85, y: -2 }}
          disabled={locked || earned !== null}
          className="grid h-8 w-12 place-items-center rounded-xl bg-chemistry/12 text-chemistry disabled:opacity-0 sm:h-9 sm:w-14"
        >
          <ChevronUp className="size-6" strokeWidth={3} />
        </motion.button>
        <div
          className={clsx(
            "my-1 flex items-baseline gap-0.5 rounded-2xl border-2 px-2 py-1.5 font-display font-extrabold sm:px-3",
            locked ? "border-[#ffc53d] bg-[#ffc53d]/15" : "border-line bg-surface",
          )}
        >
          <motion.button
            type="button"
            key={coefs[k]}
            onClick={() => change(k, 1)}
            initial={{ scale: 1.6, color: "var(--brand)" }}
            animate={{ scale: 1, color: coefs[k] === 1 ? "var(--muted)" : "var(--chemistry)" }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className="min-w-[1ch] text-3xl tabular-nums sm:text-4xl"
          >
            {coefs[k]}
          </motion.button>
          <button
            type="button"
            onClick={() => setNote("Never change the small numbers! They are part of the formula. H₂O₂ is hydrogen peroxide, not water. Only the big numbers in front can change.")}
            className="text-2xl sm:text-3xl"
          >
            <Formula f={all[k]} />
          </button>
        </div>
        <motion.button
          type="button"
          aria-label={`Less ${all[k]}`}
          onClick={() => change(k, -1)}
          whileTap={{ scale: 0.85, y: 2 }}
          disabled={locked || earned !== null || coefs[k] === 1}
          className="grid h-8 w-12 place-items-center rounded-xl bg-surface-2 text-muted disabled:opacity-30 sm:h-9 sm:w-14"
        >
          <ChevronDown className="size-6" strokeWidth={3} />
        </motion.button>
      </div>
    );
  };

  const plus = (k: number) => (
    <span key={`p${k}`} className="font-display text-2xl font-extrabold text-muted">
      +
    </span>
  );

  return (
    <>
      <GameTopBar title={`Level ${index + 1} of ${EQUATIONS.length}`} onBack={onBack}>
        <span className="rounded-full bg-surface-2 px-3 py-1.5 font-display font-extrabold tabular-nums">
          {moves} {moves === 1 ? "move" : "moves"}
        </span>
      </GameTopBar>

      <div className="mx-auto max-w-3xl pb-12">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{eq.name}</h2>
          <span className="rounded-full bg-chemistry/12 px-2.5 py-1 text-xs font-bold text-chemistry">{eq.kind}</span>
        </div>
        <p className="mt-1 text-sm text-muted">Atoms are never made or destroyed in a reaction. Make both sides equal.</p>

        {/* Equation */}
        <div
          ref={eqRef}
          className={clsx(
            "mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-3 rounded-[28px] border-2 p-4 shadow-card transition-colors sm:gap-x-3 sm:p-6",
            balanced ? "border-ok bg-ok-soft" : "border-line bg-surface",
          )}
        >
          {eq.left.flatMap((_, k) => (k === 0 ? [species(k)] : [plus(k), species(k)]))}
          <motion.span
            animate={balanced ? { scale: [1, 1.3, 1] } : { x: [0, 4, 0] }}
            transition={balanced ? { duration: 0.5 } : { duration: 1.4, repeat: Infinity }}
            className={clsx("px-1 font-display text-3xl font-extrabold", balanced ? "text-ok" : "text-fg")}
          >
            →
          </motion.span>
          {eq.right.flatMap((_, j) => (j === 0 ? [species(nl + j)] : [plus(nl + j), species(nl + j)]))}
        </div>

        <AnimatePresence>
          {note && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-[15px] font-semibold"
            >
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" /> {note}
            </motion.p>
          )}
          {balanced && !simplest && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-[15px] font-semibold"
            >
              <Scale className="mt-0.5 size-4 shrink-0 text-brand" />
              Balanced, but not finished! All the numbers can be divided by {coefs.reduce(gcd)}. Use the smallest whole numbers.
            </motion.p>
          )}
        </AnimatePresence>

        {/* Scale + atom count */}
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.3fr]">
          <div className="rounded-3xl border-2 border-line bg-surface p-4 shadow-card">
            <div className="flex justify-between px-2 text-xs font-bold uppercase tracking-wider text-muted">
              <span>Left atoms</span>
              <span>Right atoms</span>
            </div>
            <SeeSaw left={sum(L)} right={sum(R)} balanced={balanced} />
          </div>
          <div className="rounded-3xl border-2 border-line bg-surface p-4 shadow-card">
            <ul className="space-y-2.5">
              {els.map((el) => {
                const ok = L[el] === R[el];
                return (
                  <motion.li key={el} layout className="flex items-center gap-2">
                    <AtomDots el={el} n={L[el] ?? 0} align="left" />
                    <span
                      className="grid h-9 w-11 shrink-0 place-items-center rounded-xl font-display text-base font-extrabold shadow-[0_2px_0_0_rgb(0_0_0/0.15)]"
                      style={{ background: ATOM_COLOR[el] ?? "#888", color: el === "H" || el === "S" || el === "Ag" ? "#1b1f3b" : "#fff" }}
                    >
                      {el}
                    </span>
                    <AtomDots el={el} n={R[el] ?? 0} align="right" />
                    <motion.span
                      key={String(ok)}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={clsx("grid size-6 shrink-0 place-items-center rounded-full text-white", ok ? "bg-ok" : "bg-bad")}
                    >
                      {ok ? <Check className="size-4" strokeWidth={3} /> : <X className="size-4" strokeWidth={3} />}
                    </motion.span>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={hint}
            disabled={earned !== null}
            className="flex items-center gap-2 rounded-2xl border-2 border-line bg-surface px-5 py-3 font-display font-bold hover:border-brand disabled:opacity-40"
          >
            <Lightbulb className="size-5 text-brand" /> Hint <span className="text-sm font-semibold text-muted">(−1★)</span>
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-2 rounded-2xl border-2 border-line bg-surface px-5 py-3 font-display font-bold hover:border-fg/30"
          >
            <RotateCcw className="size-5" /> Reset
          </button>
        </div>
      </div>

      <AnimatePresence>
        {earned !== null && (
          <Solved
            eq={eq}
            coefs={coefs}
            stars={earned}
            improved={earned > prevStars.current && prevStars.current > 0}
            hasNext={index + 1 < EQUATIONS.length}
            onNext={onNext}
            onRetry={onRetry}
            onBack={onBack}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Solved({
  eq,
  coefs,
  stars,
  improved,
  hasNext,
  onNext,
  onRetry,
  onBack,
}: {
  eq: Equation;
  coefs: number[];
  stars: number;
  improved: boolean;
  hasNext: boolean;
  onNext: () => void;
  onRetry: () => void;
  onBack: () => void;
}) {
  useEffect(() => {
    const ts = Array.from({ length: stars }, (_, i) => setTimeout(() => play("combo"), 750 + (i + 1) * 220));
    return () => ts.forEach(clearTimeout);
  }, [stars]);
  const side = (from: number, list: string[]) =>
    list.map((f, i) => (
      <span key={f} className="whitespace-nowrap">
        {i > 0 && <span className="mx-1.5 text-white/60">+</span>}
        {coefs[from + i] > 1 && <span className="text-[#ffd23f]">{coefs[from + i]}</span>}
        <Formula f={f} />
      </span>
    ));
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.7, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.25 }}
        className="w-full max-w-md overflow-hidden rounded-[28px] bg-surface shadow-pop"
      >
        <div className="bg-gradient-to-br from-[#0b93d4] via-[#6d5cf0] to-[#a24ee8] px-6 pb-6 pt-7 text-center text-white">
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map((k) => (
              <motion.span
                key={k}
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.5 + k * 0.22, type: "spring", stiffness: 300, damping: 12 }}
                className={k === 2 ? "-mt-3" : ""}
              >
                <Star className={clsx("size-14", k <= stars ? "fill-[#ffd23f] text-[#ffd23f] drop-shadow" : "fill-white/15 text-white/30")} />
              </motion.span>
            ))}
          </div>
          <p className="mt-3 font-display text-3xl font-extrabold">{stars === 3 ? "Perfect balance!" : "Balanced!"}</p>
          {improved && <p className="font-semibold text-white/85">New best for this level</p>}
          <p className="mt-3 flex flex-wrap items-center justify-center gap-y-1 font-display text-xl font-extrabold sm:text-2xl">
            {side(0, eq.left)}
            <span className="mx-2">→</span>
            {side(eq.left.length, eq.right)}
          </p>
          {stars < 3 && <p className="mt-2 text-sm font-semibold text-white/80">Fewer moves and no hints get 3 stars.</p>}
        </div>
        <div className="p-5">
          <p className="flex gap-2 text-[15px]">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-brand" />
            <span>
              <strong className="font-bold">Did you know? </strong>
              {eq.fact}
            </span>
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {hasNext && (
              <motion.button
                type="button"
                onClick={onNext}
                whileTap={{ scale: 0.96 }}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3.5 font-display text-lg font-extrabold text-brand-ink shadow-[0_4px_0_0_rgb(0_0_0/0.18)]"
              >
                Next level <ArrowRight className="size-5" />
              </motion.button>
            )}
            {stars < 3 && (
              <button type="button" onClick={onRetry} className="rounded-2xl border-2 border-line px-4 py-3 font-display font-bold">
                Try for 3★
              </button>
            )}
            <button type="button" onClick={onBack} className="rounded-2xl border-2 border-line px-4 py-3 font-display font-bold">
              Levels
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
