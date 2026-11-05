import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Flame, Infinity as InfinityIcon, Loader2, PartyPopper, Play, RefreshCw, Timer, Zap } from "lucide-react";
import clsx from "clsx";
import { RichText } from "../../components/RichText";
import { offeredGrades, region } from "../../config/regions";
import type { MatchSet, MatchSets } from "../../content/api";
import type { SubjectId } from "../../content/schema";
import { burst } from "../../lib/celebrate";
import { play } from "../../lib/sound";
import { SUBJECT_STYLE } from "../../lib/subjects";
import { api } from "../../store/auth";
import { useContent } from "../../store/content";
import { useGames } from "../../store/games";
import { useCurrentGrade } from "../../store/profile";
import { GameIntro, GameOver, GameTopBar, PointsPop, type Mistake } from "../GameKit";
import { gameMeta } from "../registry";
import { Countdown } from "../rush/NumberRush";

const meta = gameMeta("match");

/** The time limits on offer; null means no clock. Either way a game is every board of the chapter, once. */
const LIMITS: { ms: number | null; label: string }[] = [
  { ms: 60_000, label: "1 min" },
  { ms: 90_000, label: "1½ min" },
  { ms: 120_000, label: "2 min" },
  { ms: 180_000, label: "3 min" },
  { ms: null, label: "No limit" },
];
const PAIR_BONUS_MS = 1_000;
const BOARD_BONUS_MS = 3_000;
const PENALTY_MS = 3_000;
const PAIR_POINTS = 10;
const BOARD_POINTS = 25;
/** Points for each second left on the clock after clearing every board. */
const SECOND_POINTS = 5;
/** Seconds that earn them: the shortest limit, so choosing a longer one can't buy a higher score. */
const MAX_BONUS_SECONDS = 60;
/** Most pairs on one board: more would not fit a phone's screen. */
const MAX_PAIRS = 5;
const CLEARED_PAUSE_MS = 1_100;
const LOW_MS = 10_000;

const multiplier = (combo: number) => 1 + Math.min(3, Math.floor(combo / 3));

function shuffled<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Choice {
  key: string;
  title: string;
  limit: number | null;
}

interface Result {
  score: number;
  pairs: number;
  tries: number;
  bestCombo: number;
  boards: number;
  totalBoards: number;
  /** Every board was cleared, rather than the clock running out. */
  completed: boolean;
  timeBonus: number;
  mistakes: Mistake[];
  newBest: boolean;
}

function headline(r: Result): string {
  if (!r.completed) return r.boards > 0 ? `Time's up! ${r.boards} of ${r.totalBoards} boards cleared` : "Time's up!";
  const cleared = r.mistakes.length === 0 ? "Perfect! Every board cleared" : "Chapter complete!";
  return r.timeBonus > 0 ? `${cleared} +${r.timeBonus} time bonus` : cleared;
}

export function MatchSprint({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<"setup" | "loading" | "play" | "over">("setup");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [sets, setSets] = useState<MatchSet[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [run, setRun] = useState(0);
  /** The load in progress: leaving before it answers must not start the game. */
  const loading = useRef(0);

  // Fetched each time, so a corrected question is in the very next game.
  const start = async (c: Choice) => {
    const id = ++loading.current;
    setChoice(c);
    setProblem(null);
    setPhase("loading");
    try {
      const data = await api<MatchSets>(`/api/games/match?chapter=${encodeURIComponent(c.key)}`);
      if (id !== loading.current) return;
      if (data.sets.length === 0) return setProblem("This chapter has no matching pairs to play right now. Try another one.");
      setSets(data.sets);
      setRun((n) => n + 1);
      setPhase("play");
    } catch (e) {
      if (id === loading.current) setProblem(e instanceof Error ? e.message : "Couldn't load the chapter. Check your connection and try again.");
    }
  };

  const toSetup = () => {
    loading.current++;
    setProblem(null);
    setPhase("setup");
  };

  return (
    <>
      <GameTopBar title={meta.title} onBack={phase === "setup" || phase === "over" ? onExit : toSetup} />
      {phase === "setup" && (
        <GameIntro meta={meta} glyphs={["↔", "A", "B", "✓", "⇄", "1", "2", "★"]}>
          <Setup choice={choice} onStart={(c) => void start(c)} />
        </GameIntro>
      )}
      {phase === "loading" && (
        <div className="grid h-[60vh] place-items-center p-4 text-center">
          {problem ? (
            <div className="rounded-[24px] border-2 border-line bg-surface p-6">
              <p className="font-semibold">{problem}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={toSetup} className="rounded-2xl border-2 border-line px-5 py-2.5 font-display font-bold">
                  Back
                </button>
                {choice && (
                  <button type="button" onClick={() => void start(choice)} className="flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 font-display font-bold text-brand-ink">
                    <RefreshCw className="size-4" /> Try again
                  </button>
                )}
              </div>
            </div>
          ) : (
            <Loader2 className="size-10 animate-spin text-muted" aria-label="Loading" />
          )}
        </div>
      )}
      {phase === "play" && choice && (
        <Round
          key={run}
          sets={sets}
          limit={choice.limit}
          onDone={(r) => {
            setResult(r);
            setPhase("over");
          }}
        />
      )}
      {phase === "over" && result && choice && (
        <GameOver
          meta={meta}
          score={result.score}
          newBest={result.newBest}
          headline={headline(result)}
          stats={[
            { label: "Pairs", value: result.pairs },
            { label: "Accuracy", value: `${result.tries ? Math.round((result.pairs / result.tries) * 100) : 0}%` },
            { label: "Best combo", value: result.bestCombo },
            { label: "Boards", value: `${result.boards}/${result.totalBoards}` },
          ]}
          skills={[]}
          mistakes={result.mistakes}
          noAnswers={result.tries === 0}
          onAgain={() => void start(choice)}
          onExit={onExit}
          actions={
            <button type="button" onClick={toSetup} className="rounded-2xl border-2 border-white/40 px-6 py-3.5 font-display text-lg font-bold hover:bg-white/10">
              Change chapter
            </button>
          }
        />
      )}
    </>
  );
}

/** Choose the class, subject, chapter and time limit. */
function Setup({ choice, onStart }: { choice: Choice | null; onStart: (c: Choice) => void }) {
  const status = useContent((s) => s.status);
  const load = useContent((s) => s.load);
  const all = useContent((s) => s.catalog?.chapters);
  // Only chapters with a board to play: some have match questions that all need their picture.
  const chapters = useMemo(() => (all ?? []).filter((c) => offeredGrades.includes(c.grade) && c.matchBoards > 0), [all]);
  const current = useCurrentGrade();
  const previous = chapters.find((c) => c.key === choice?.key);
  const grades = [...new Set(chapters.map((c) => c.grade))].sort((a, b) => a - b);
  const [pickedGrade, setGrade] = useState(previous?.grade ?? current);
  const grade = grades.includes(pickedGrade) ? pickedGrade : grades[0];
  const inGrade = chapters.filter((c) => c.grade === grade);
  const subjects = [...new Set(inGrade.map((c) => c.subject))];
  const [pickedSubject, setSubject] = useState<SubjectId | null>(previous?.subject ?? null);
  const subject = pickedSubject && subjects.includes(pickedSubject) ? pickedSubject : subjects[0];
  const list = inGrade.filter((c) => c.subject === subject);
  const [key, setKey] = useState<string | null>(choice?.key ?? null);
  const chosen = list.find((c) => c.key === key);
  const [limit, setLimit] = useState<number | null>(choice ? choice.limit : LIMITS[0].ms);

  const heading = "mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-muted first:mt-0";
  const chip = (on: boolean) =>
    clsx("rounded-2xl border-2 px-4 py-2.5 font-display text-sm font-bold transition-colors", on ? "border-fg bg-fg text-bg" : "border-line bg-surface text-muted hover:border-fg/30 hover:text-fg");

  if (chapters.length === 0) {
    return (
      <section className="mt-5 rounded-3xl border-2 border-line bg-surface p-6 text-center shadow-card">
        {status === "failed" ? (
          <>
            <p className="font-semibold">Chapters need a connection.</p>
            <button type="button" onClick={() => void load()} className="mt-3 rounded-2xl border-2 border-line px-5 py-2.5 font-display font-bold">
              Try again
            </button>
          </>
        ) : (
          <Loader2 className="mx-auto size-8 animate-spin text-muted" aria-label="Loading" />
        )}
      </section>
    );
  }

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="mt-5 rounded-3xl border-2 border-line bg-surface p-5 shadow-card">
      <h3 className={heading}>Class</h3>
      <div className="flex flex-wrap gap-2">
        {grades.map((g) => (
          <motion.button key={g} type="button" aria-pressed={g === grade} whileTap={{ scale: 0.94 }} onClick={() => { play("tap"); setGrade(g); setKey(null); }} className={clsx(chip(g === grade), "flex-1")}>
            {region.gradeLabel(g)}
          </motion.button>
        ))}
      </div>

      <h3 className={heading}>Subject</h3>
      <div className="flex flex-wrap gap-2">
        {subjects.map((s) => (
          <motion.button key={s} type="button" aria-pressed={s === subject} whileTap={{ scale: 0.94 }} onClick={() => { play("tap"); setSubject(s); setKey(null); }} className={chip(s === subject)}>
            {region.subjects[s]}
          </motion.button>
        ))}
      </div>

      <h3 className={heading}>Chapter</h3>
      <ul className="grid gap-2">
        {list.map((c, i) => {
          const on = c.key === key;
          const st = SUBJECT_STYLE[c.subject];
          return (
            <motion.li key={c.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
              <motion.button
                type="button"
                aria-pressed={on}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  play("tap");
                  setKey(c.key);
                }}
                className={clsx("flex min-h-12 w-full items-center gap-3 rounded-2xl border-2 p-2.5 text-left font-semibold leading-snug transition-colors", on ? "border-ok bg-ok-soft" : "border-line bg-surface hover:border-fg/30")}
              >
                <span className={clsx("grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-extrabold", on ? "bg-ok text-white" : clsx(st.soft, st.text))}>
                  {on ? <Check className="size-4" strokeWidth={3} /> : (c.no ?? i + 1)}
                </span>
                <span className="min-w-0 flex-1">{c.title}</span>
              </motion.button>
            </motion.li>
          );
        })}
      </ul>

      <h3 className={heading}>Time limit</h3>
      <div className="flex flex-wrap gap-2">
        {LIMITS.map((l) => (
          <motion.button key={l.label} type="button" aria-pressed={l.ms === limit} whileTap={{ scale: 0.94 }} onClick={() => { play("tap"); setLimit(l.ms); }} className={clsx(chip(l.ms === limit), "flex items-center gap-1.5")}>
            {l.ms === null ? <InfinityIcon className="size-4" /> : <Timer className="size-4" />}
            {l.label}
          </motion.button>
        ))}
      </div>

      {/* Stays in reach while the chapter list scrolls past on a phone. */}
      <div className="sticky bottom-3 z-10 mt-5">
        <motion.button
          type="button"
          disabled={!chosen}
          whileTap={chosen ? { scale: 0.97, y: 2 } : undefined}
          onClick={() => {
            if (!chosen) return;
            play("tap");
            onStart({ key: chosen.key, title: chosen.title, limit });
          }}
          // Solid even while disabled: the chapter list scrolls behind it.
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-6 py-4 font-display text-lg font-extrabold text-brand-ink shadow-[0_4px_0_0_rgb(0_0_0/0.18)] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted disabled:shadow-none"
        >
          <Play className="size-5 fill-current" /> {chosen ? "Start" : "Pick a chapter to start"}
        </motion.button>
      </div>
    </motion.section>
  );
}

interface Card {
  /** The pair it belongs to: a left and a right card match when these are equal. */
  pair: number;
  text: string;
}

interface Board {
  set: MatchSet;
  left: Card[];
  right: Card[];
}

function boardFrom(set: MatchSet): Board {
  const pairs = shuffled(set.pairs).slice(0, MAX_PAIRS);
  const cards = (side: "left" | "right") => pairs.map((p, i) => ({ pair: i, text: p[side] }));
  const left = shuffled(cards("left"));
  let right = shuffled(cards("right"));
  // Never lined up row by row, which would give the whole board away.
  for (let tries = 0; tries < 8 && right.every((c, i) => c.pair === left[i].pair); tries++) right = shuffled(right);
  return { set, left, right };
}

type Side = "left" | "right";
const SPARKS = [0, 60, 120, 180, 240, 300];

function GameCard({
  card,
  side,
  index,
  selected,
  matched,
  wrong,
  cardRef,
  onTap,
}: {
  card: Card;
  side: Side;
  index: number;
  selected: boolean;
  matched: boolean;
  wrong: boolean;
  cardRef: (el: HTMLButtonElement | null) => void;
  onTap: () => void;
}) {
  /** Only the entrance is staggered: later changes must answer a tap at once. */
  const [entered, setEntered] = useState(false);
  const animate = matched
    ? { opacity: [1, 1, 0], scale: [1, 1.08, 0.86], x: 0, y: 0, rotate: 0 }
    : wrong
      ? { opacity: 1, scale: 1, x: [0, -9, 9, -6, 6, 0], y: 0, rotate: 0 }
      : selected
        ? { opacity: 1, scale: 1.04, x: 0, y: -3, rotate: side === "left" ? -1 : 1 }
        : { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 };
  return (
    <motion.button
      ref={cardRef}
      type="button"
      disabled={matched}
      aria-pressed={selected}
      onClick={onTap}
      initial={{ opacity: 0, x: side === "left" ? -46 : 46, rotate: side === "left" ? -5 : 5, scale: 0.86 }}
      animate={animate}
      onAnimationComplete={() => setEntered(true)}
      transition={matched ? { duration: 0.6, times: [0, 0.35, 1] } : wrong ? { duration: 0.4 } : { type: "spring", stiffness: 420, damping: 24, delay: entered ? 0 : index * 0.05 }}
      whileTap={matched ? undefined : { scale: 0.95 }}
      className={clsx(
        "relative flex min-h-[64px] w-full min-w-0 items-center justify-center rounded-2xl border-2 p-2.5 text-center text-sm font-semibold leading-snug shadow-[0_3px_0_0_var(--line)] [overflow-wrap:anywhere] sm:min-h-20 sm:p-3 sm:text-base",
        matched ? "pointer-events-none border-ok bg-ok text-white" : wrong ? "border-bad bg-bad-soft text-bad" : selected ? "z-10 border-brand bg-brand-soft shadow-[0_4px_0_0_var(--brand)]" : "border-line bg-surface hover:border-fg/25",
      )}
    >
      <RichText text={card.text} className="min-w-0 [&_.katex]:text-[0.95em]" />
      {matched &&
        SPARKS.map((deg) => (
          <motion.span
            key={deg}
            aria-hidden
            className="absolute left-1/2 top-1/2 size-2 rounded-full bg-[#ffd23f]"
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos((deg * Math.PI) / 180) * 58, y: Math.sin((deg * Math.PI) / 180) * 40, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        ))}
    </motion.button>
  );
}

function Round({ sets, limit, onDone }: { sets: MatchSet[]; limit: number | null; onDone: (r: Result) => void }) {
  const queue = useRef(shuffled(sets));
  const at = useRef(0);
  const [board, setBoard] = useState(() => boardFrom(queue.current[0]));
  const [boardNo, setBoardNo] = useState(0);
  const [started, setStarted] = useState(false);
  const [selected, setSelected] = useState<{ side: Side; pair: number } | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [wrong, setWrong] = useState<{ left: number; right: number } | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [cleared, setCleared] = useState(false);
  const [flash, setFlash] = useState<{ id: number; bad: boolean } | null>(null);
  const [beam, setBeam] = useState<{ id: number; d: string } | null>(null);
  const [pops, setPops] = useState<{ id: number; text: string; x: number; y: number }[]>([]);
  const [now, setNow] = useState(Date.now());
  const endAt = useRef(0);
  const startedAt = useRef(0);
  const stats = useRef({ score: 0, pairs: 0, tries: 0, bestCombo: 0, boards: 0, mistakes: [] as Mistake[] });
  const finished = useRef(false);
  const locked = useRef(false);
  const lastTick = useRef(0);
  const uid = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const cards = useRef<Record<string, HTMLButtonElement | null>>({});
  const finish = useGames((s) => s.finish);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const begin = useCallback(() => {
    const t = Date.now();
    startedAt.current = t;
    if (limit !== null) endAt.current = t + limit;
    setNow(t);
    setStarted(true);
  }, [limit]);

  const end = useCallback(
    (completed: boolean) => {
      if (finished.current) return;
      finished.current = true;
      const s = stats.current;
      const timeBonus = completed && limit !== null ? Math.min(MAX_BONUS_SECONDS, Math.ceil(Math.max(0, endAt.current - Date.now()) / 1000)) * SECOND_POINTS : 0;
      s.score += timeBonus;
      onDone({
        score: s.score,
        pairs: s.pairs,
        tries: s.tries,
        bestCombo: s.bestCombo,
        boards: s.boards,
        totalBoards: queue.current.length,
        completed,
        timeBonus,
        mistakes: s.mistakes.slice(0, 8),
        // A clock that ran out untouched is not a game played: no play, no day of streak.
        newBest: s.tries > 0 && finish("match", s.score, s.pairs),
      });
    },
    [finish, limit, onDone],
  );

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [started]);

  // Never above the limit: `now` can be a moment behind a bonus that filled the clock.
  const left = limit === null || !started ? (limit ?? 0) : Math.min(limit, Math.max(0, endAt.current - now));

  useEffect(() => {
    if (!started || limit === null) return;
    // Not while a cleared board is on screen: the last one has already beaten the clock.
    if (left <= 0 && !locked.current) end(false);
    const sec = Math.ceil(left / 1000);
    if (sec <= 5 && sec > 0 && sec !== lastTick.current) {
      lastTick.current = sec;
      play("tick");
    }
  }, [left, limit, started, end]);

  const addTime = (ms: number) => {
    if (limit !== null) endAt.current = Math.min(Date.now() + limit, endAt.current + ms);
  };

  const center = (el: HTMLElement | null | undefined) => {
    const box = boardRef.current?.getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    return box && r ? { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top } : null;
  };

  const nextBoard = () => {
    at.current++;
    // Every board has been played once, and that is the game.
    if (at.current >= queue.current.length) return end(true);
    // The clock can run out during the pause (a phone locked mid-game); nothing else would notice once it stays at zero.
    if (limit !== null && Date.now() >= endAt.current) return end(false);
    setBoard(boardFrom(queue.current[at.current]));
    setBoardNo((n) => n + 1);
    setMatched([]);
    setWrong(null);
    setSelected(null);
    setCleared(false);
    locked.current = false;
  };

  const tryPair = (leftPair: number, rightPair: number) => {
    const s = stats.current;
    s.tries++;
    setSelected(null);
    if (leftPair === rightPair) {
      const c = combo + 1;
      const mult = multiplier(c);
      const pts = PAIR_POINTS * mult;
      const done = [...matched, leftPair];
      s.pairs++;
      s.score += pts;
      s.bestCombo = Math.max(s.bestCombo, c);
      setCombo(c);
      setScore(s.score);
      setMatched(done);
      addTime(PAIR_BONUS_MS);
      const a = center(cards.current[`left-${leftPair}`]);
      const b = center(cards.current[`right-${rightPair}`]);
      if (a && b) {
        const id = ++uid.current;
        setBeam({ id, d: `M${a.x},${a.y} C${(a.x + b.x) / 2},${a.y - 26} ${(a.x + b.x) / 2},${b.y + 26} ${b.x},${b.y}` });
        setPops((p) => [...p.slice(-3), { id, text: `+${pts}`, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }]);
        later(() => setBeam((x) => (x?.id === id ? null : x)), 500);
      }
      setFlash({ id: ++uid.current, bad: false });
      if (mult > multiplier(combo)) {
        play("combo");
        if (mult === 4) burst(boardRef.current);
      } else play("correct");
      if (done.length === board.left.length) {
        locked.current = true;
        s.score += BOARD_POINTS;
        s.boards++;
        setScore(s.score);
        addTime(BOARD_BONUS_MS);
        setCleared(true);
        later(() => {
          play("levelup");
          burst(boardRef.current);
        }, 180);
        later(nextBoard, CLEARED_PAUSE_MS);
      }
    } else {
      setCombo(0);
      addTime(-PENALTY_MS);
      setWrong({ left: leftPair, right: rightPair });
      setFlash({ id: ++uid.current, bad: true });
      play("wrong");
      navigator.vibrate?.(60);
      const leftCard = board.left.find((c) => c.pair === leftPair)!;
      const answer = board.right.find((c) => c.pair === leftPair)!.text;
      // The same term can have a different match on another board (say $l$ for two kinds of class), so both are compared.
      if (!s.mistakes.some((m) => m.prompt === leftCard.text && m.answer === answer)) {
        s.mistakes.push({
          prompt: leftCard.text,
          given: board.right.find((c) => c.pair === rightPair)!.text,
          answer,
          tip: board.set.explanation,
        });
      }
      later(() => setWrong((w) => (w?.left === leftPair && w.right === rightPair ? null : w)), 480);
    }
  };

  const tap = (side: Side, pair: number) => {
    if (!started || locked.current || finished.current || matched.includes(pair)) return;
    if (!selected || selected.side === side) {
      play("tap");
      setSelected(selected?.side === side && selected.pair === pair ? null : { side, pair });
      return;
    }
    if (side === "left") tryPair(pair, selected.pair);
    else tryPair(selected.pair, pair);
  };

  // Keys 1–5 pick from the left column, 6–9 and 0 from the right.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const i = "1234567890".indexOf(e.key);
      if (i < 0) return;
      const card = i < 5 ? board.left[i] : board.right[i - 5];
      if (card) tap(i < 5 ? "left" : "right", card.pair);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!started) return <Countdown onDone={begin} />;

  const mult = multiplier(combo);
  const low = limit !== null && left < LOW_MS;
  const elapsed = Math.max(0, now - startedAt.current);

  return (
    <div className="relative mx-auto max-w-2xl pb-8">
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.id}
            aria-hidden
            className={clsx("pointer-events-none fixed inset-0 z-30", flash.bad ? "bg-bad" : "bg-ok")}
            initial={{ opacity: flash.bad ? 0.22 : 0.1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onAnimationComplete={() => setFlash((f) => (f?.id === flash.id ? null : f))}
          />
        )}
      </AnimatePresence>

      {/* Clock and score */}
      <div className="flex items-center gap-3">
        <span className={clsx("flex w-16 shrink-0 items-center gap-1 font-display text-lg font-extrabold tabular-nums", low ? "text-bad" : "text-fg")}>
          {limit === null ? <InfinityIcon className="size-5" /> : <Timer className="size-5" />}
          {limit === null ? Math.floor(elapsed / 1000) : Math.ceil(left / 1000)}
        </span>
        <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-surface-2">
          <motion.div
            className={clsx("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", low ? "from-bad to-[#ff9a3c]" : "from-[#0f9f5f] to-[#0b93d4]")}
            animate={limit === null ? { width: `${((at.current + matched.length / board.left.length) / queue.current.length) * 100}%` } : { width: `${(left / limit) * 100}%`, opacity: low ? [1, 0.55, 1] : 1 }}
            // Only pulses while low: a repeating transition would keep flashing after a bonus lifts it out.
            transition={{ width: { duration: limit === null ? 0.3 : 0.1, ease: "linear" }, opacity: low ? { duration: 0.6, repeat: Infinity } : { duration: 0.2 } }}
          />
        </div>
        <motion.span key={score} initial={{ scale: 1.35 }} animate={{ scale: 1 }} className="flex min-w-16 items-center justify-end gap-1 font-display text-xl font-extrabold tabular-nums">
          <Zap className="size-5 fill-brand text-brand" />
          {score}
        </motion.span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="rounded-full bg-surface-2 px-3 py-1 font-display text-sm font-extrabold text-muted">
          Board {boardNo + 1} of {queue.current.length}
        </span>
        <motion.span
          key={mult}
          initial={{ scale: mult > 1 ? 1.6 : 1, rotate: mult > 1 ? -10 : 0 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className={clsx("flex items-center gap-1 rounded-full px-3 py-1 font-display font-extrabold", mult === 1 ? "bg-surface-2 text-muted" : mult === 2 ? "bg-brand-soft text-brand" : mult === 3 ? "bg-bad-soft text-bad" : "bg-bad text-white")}
        >
          <Flame className={clsx("size-4", mult > 1 && "fill-current")} />
          {combo} {mult > 1 && <span>×{mult}</span>}
        </motion.span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={boardNo} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }} className="mt-3 text-center text-sm font-semibold leading-snug text-muted sm:text-[15px]">
          <RichText text={board.set.prompt} />
        </motion.div>
      </AnimatePresence>

      {/* Board. Every row is the same height, and a matched card keeps its place so nothing jumps under a finger. */}
      <div ref={boardRef} className="relative mt-3 grid auto-rows-fr grid-cols-2 gap-2.5 sm:gap-3">
        {board.left.map((l, i) => {
          const r = board.right[i];
          return [
            <GameCard
              key={`${boardNo}-l${l.pair}`}
              card={l}
              side="left"
              index={i}
              selected={selected?.side === "left" && selected.pair === l.pair}
              matched={matched.includes(l.pair)}
              wrong={wrong?.left === l.pair}
              cardRef={(el) => {
                cards.current[`left-${l.pair}`] = el;
              }}
              onTap={() => tap("left", l.pair)}
            />,
            <GameCard
              key={`${boardNo}-r${r.pair}`}
              card={r}
              side="right"
              index={i}
              selected={selected?.side === "right" && selected.pair === r.pair}
              matched={matched.includes(r.pair)}
              wrong={wrong?.right === r.pair}
              cardRef={(el) => {
                cards.current[`right-${r.pair}`] = el;
              }}
              onTap={() => tap("right", r.pair)}
            />,
          ];
        })}

        <svg aria-hidden className="pointer-events-none absolute inset-0 z-20 size-full overflow-visible">
          <AnimatePresence>
            {beam && (
              <motion.path
                key={beam.id}
                d={beam.d}
                fill="none"
                stroke="#ffd23f"
                strokeWidth={5}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 1 }}
                animate={{ pathLength: 1, opacity: [1, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.42, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>
        </svg>

        {pops.map((p) => (
          <div key={p.id} className="pointer-events-none absolute z-20" style={{ left: p.x, top: p.y }}>
            <PointsPop text={p.text} className="-translate-x-1/2 text-brand" />
          </div>
        ))}

        <AnimatePresence>
          {cleared && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.4, rotate: -6 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 1.2, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 320, damping: 14 }}
                className="rounded-3xl bg-fg px-7 py-4 text-center text-bg shadow-pop"
              >
                <p className="flex items-center justify-center gap-2 whitespace-nowrap font-display text-2xl font-extrabold">
                  <PartyPopper className="size-6 text-brand" /> Board cleared!
                </p>
                <p className="mt-0.5 font-semibold opacity-80">
                  +{BOARD_POINTS}
                  {limit !== null && ` · +${BOARD_BONUS_MS / 1000} seconds`}
                </p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {wrong && limit !== null && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-center font-display font-bold text-bad">
            −{PENALTY_MS / 1000} seconds
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
