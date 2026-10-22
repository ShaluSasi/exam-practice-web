import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flame, Timer, Zap } from "lucide-react";
import clsx from "clsx";
import { RichText } from "../../components/RichText";
import { burst } from "../../lib/celebrate";
import { play } from "../../lib/sound";
import { useGames } from "../../store/games";
import { GameIntro, GameOver, GameTopBar, PointsPop, type Mistake, type SkillScore } from "../GameKit";
import { gameMeta } from "../registry";
import { ELEMENT_QUESTIONS, type ElementQ } from "./elements";

const meta = gameMeta("elements");
const START_MS = 60_000;
const MAX_MS = 60_000;
const BONUS_MS = 1_200;
const PENALTY_MS = 3_000;

const multiplier = (combo: number) => 1 + Math.min(3, Math.floor(combo / 3));

function shuffled<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Result {
  score: number;
  solved: number;
  answered: number;
  bestCombo: number;
  skills: SkillScore[];
  mistakes: Mistake[];
  newBest: boolean;
}

export function ElementLab({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [result, setResult] = useState<Result | null>(null);
  const [run, setRun] = useState(0);

  return (
    <>
      <GameTopBar title={meta.title} onBack={phase === "play" ? () => setPhase("intro") : onExit} />
      {phase === "intro" && <GameIntro meta={meta} glyphs={["H", "O", "Na", "Fe", "Cl", "Ca", "Cu", "Au"]} onPlay={() => setPhase("play")} />}
      {phase === "play" && (
        <Round
          key={run}
          onDone={(r) => {
            setResult(r);
            setPhase("over");
          }}
        />
      )}
      {phase === "over" && result && (
        <GameOver
          meta={meta}
          score={result.score}
          newBest={result.newBest}
          headline={
            result.solved >= 30 ? "Element expert!" : result.solved >= 18 ? "Sharp chemist!" : result.solved >= 8 ? "Nice run!" : "Good warm-up!"
          }
          stats={[
            { label: "Solved", value: result.solved },
            { label: "Accuracy", value: `${result.answered ? Math.round((result.solved / result.answered) * 100) : 0}%` },
            { label: "Best combo", value: result.bestCombo },
            { label: "Answered", value: result.answered },
          ]}
          skills={result.skills}
          mistakes={result.mistakes}
          onAgain={() => {
            setRun((n) => n + 1);
            setPhase("play");
          }}
          onExit={onExit}
        />
      )}
    </>
  );
}

function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    play(n === 0 ? "levelup" : "tick");
    const t = setTimeout(() => (n === 0 ? onDone() : setN(n - 1)), n === 0 ? 450 : 650);
    return () => clearTimeout(t);
  }, [n, onDone]);
  return (
    <div className="grid h-[60vh] place-items-center">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={n}
          initial={{ scale: 2.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="bg-gradient-to-br from-[#0b93d4] to-[#22c55e] bg-clip-text font-display text-[140px] font-extrabold leading-none text-transparent"
        >
          {n === 0 ? "Go!" : n}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/**
 * Hands out every question once, in a fresh random order, before any repeat.
 * Options are shuffled on every draw: the data lists the answer first, so an
 * unshuffled card would always have the right answer in the same place.
 */
function useQuestionDraw() {
  const queue = useRef<ElementQ[]>(shuffled(ELEMENT_QUESTIONS));
  const pos = useRef(0);
  return useCallback((): ElementQ => {
    if (pos.current >= queue.current.length) {
      const last = queue.current[queue.current.length - 1];
      const next = shuffled(ELEMENT_QUESTIONS);
      if (next[0] === last) [next[0], next[1]] = [next[1], next[0]];
      queue.current = next;
      pos.current = 0;
    }
    const q = queue.current[pos.current++];
    return { ...q, options: shuffled(q.options) };
  }, []);
}

function Round({ onDone }: { onDone: (r: Result) => void }) {
  const draw = useQuestionDraw();
  const [started, setStarted] = useState(false);
  const [question, setQuestion] = useState<ElementQ>(() => draw());
  const [qn, setQn] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [pops, setPops] = useState<{ id: number; text: string }[]>([]);
  const [now, setNow] = useState(Date.now());
  const endAt = useRef(0);
  const stats = useRef({ solved: 0, answered: 0, bestCombo: 0, skills: new Map<string, SkillScore>(), mistakes: [] as Mistake[] });
  const lastTick = useRef(0);
  const finished = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  // Short delays between questions; cleared on unmount so Back mid-delay leaves nothing running.
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const finish = useGames((s) => s.finish);

  const begin = useCallback(() => {
    endAt.current = Date.now() + START_MS;
    setNow(Date.now());
    setStarted(true);
  }, []);

  const left = started ? Math.max(0, endAt.current - now) : START_MS;

  const end = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const s = stats.current;
    const newBest = finish("elements", score, s.solved);
    onDone({ score, solved: s.solved, answered: s.answered, bestCombo: s.bestCombo, skills: [...s.skills.values()], mistakes: s.mistakes.slice(0, 8), newBest });
  }, [finish, onDone, score]);

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [started]);

  useEffect(() => {
    if (!started) return;
    if (left <= 0) end();
    const sec = Math.ceil(left / 1000);
    if (sec <= 5 && sec > 0 && sec !== lastTick.current) {
      lastTick.current = sec;
      play("tick");
    }
  }, [left, started, end]);

  const answer = (opt: string) => {
    if (picked || !started || finished.current) return;
    const right = opt === question.answer;
    const s = stats.current;
    s.answered++;
    const sk = s.skills.get(question.skill) ?? { name: question.skill, right: 0, total: 0 };
    sk.total++;
    s.skills.set(question.skill, sk);
    setPicked(opt);

    if (right) {
      sk.right++;
      s.solved++;
      const c = combo + 1;
      const mult = multiplier(c);
      const pts = 10 * mult;
      s.bestCombo = Math.max(s.bestCombo, c);
      setCombo(c);
      setScore((x) => x + pts);
      endAt.current = Math.min(Date.now() + MAX_MS, endAt.current + BONUS_MS);
      setPops((p) => [...p.slice(-3), { id: Date.now(), text: `+${pts}` }]);
      play(mult > multiplier(combo) ? "combo" : "correct");
      if (mult > multiplier(combo) && mult === 4) burst(cardRef.current);
      later(() => {
        setQuestion(draw());
        setQn((n) => n + 1);
        setPicked(null);
      }, 260);
    } else {
      setCombo(0);
      endAt.current -= PENALTY_MS;
      if (!s.mistakes.some((m) => m.prompt === question.prompt)) {
        s.mistakes.push({ prompt: question.prompt, given: opt, answer: question.answer, tip: question.tip });
      }
      play("wrong");
      later(() => {
        setQuestion(draw());
        setQn((n) => n + 1);
        setPicked(null);
      }, 900);
    }
  };

  // Keys 1–4 pick an option.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (i >= 0 && i < question.options.length) answer(question.options[i]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!started) return <Countdown onDone={begin} />;

  const mult = multiplier(combo);
  const low = left < 10_000;
  const wrongPick = picked !== null && picked !== question.answer;

  return (
    <div className="relative mx-auto max-w-xl pb-10">
      {/* Clock */}
      <div className="flex items-center gap-3">
        <span className={clsx("flex w-16 items-center gap-1 font-display text-lg font-extrabold tabular-nums", low ? "text-bad" : "text-fg")}>
          <Timer className="size-5" />
          {Math.ceil(left / 1000)}
        </span>
        <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-surface-2">
          <motion.div
            className={clsx("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", low ? "from-bad to-[#ff9a3c]" : "from-[#0b93d4] to-[#22c55e]")}
            animate={{ width: `${(left / MAX_MS) * 100}%`, opacity: low ? [1, 0.6, 1] : 1 }}
            transition={{ width: { duration: 0.1, ease: "linear" }, opacity: { duration: 0.6, repeat: Infinity } }}
          />
        </div>
        <motion.span
          key={score}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className="flex min-w-20 items-center justify-end gap-1 font-display text-xl font-extrabold tabular-nums"
        >
          <Zap className="size-5 fill-brand text-brand" />
          {score}
        </motion.span>
      </div>

      {/* Combo */}
      <div className="mt-4 flex items-center justify-end">
        <motion.span
          key={mult}
          initial={{ scale: mult > 1 ? 1.6 : 1, rotate: mult > 1 ? -10 : 0 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className={clsx(
            "flex items-center gap-1 rounded-full px-3 py-1 font-display font-extrabold",
            mult === 1 ? "bg-surface-2 text-muted" : mult === 2 ? "bg-brand-soft text-brand" : mult === 3 ? "bg-bad-soft text-bad" : "bg-bad text-white",
          )}
        >
          <Flame className={clsx("size-4", mult > 1 && "fill-current")} />
          {combo} {mult > 1 && <span>×{mult}</span>}
        </motion.span>
      </div>

      {/* Question */}
      <div ref={cardRef} className="relative mt-4">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={qn}
            initial={{ opacity: 0, scale: 0.85, rotate: -2 }}
            animate={wrongPick ? { opacity: 1, scale: 1, rotate: 0, x: [0, -14, 14, -9, 9, -4, 0] } : { opacity: 1, scale: 1, rotate: 0, x: 0 }}
            exit={{ opacity: 0, scale: 1.08, y: -20 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className={clsx(
              "relative grid min-h-44 place-items-center overflow-hidden rounded-[28px] bg-gradient-to-br p-6 text-white shadow-pop sm:min-h-52",
              mult >= 4
                ? "from-[#22c55e] via-[#0b93d4] to-[#7c4dff]"
                : mult === 3
                  ? "from-[#34d399] via-[#0b93d4] to-[#6d5cf0]"
                  : "from-[#0b93d4] via-[#6d5cf0] to-[#a24ee8]",
              mult >= 3 && "ring-4 ring-[#ffd23f]/70",
            )}
          >
            <span className="absolute left-4 top-3 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">{question.skill}</span>
            <RichText text={question.prompt} className="text-center font-display text-2xl font-extrabold leading-snug sm:text-3xl" />
          </motion.div>
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex justify-center">
          {pops.map((p) => (
            <PointsPop key={p.id} text={p.text} className="text-[#ffd23f]" />
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {question.options.map((o, i) => {
          const isAnswer = o === question.answer;
          const show = picked !== null;
          return (
            <motion.button
              key={`${qn}-${o}`}
              type="button"
              onClick={() => answer(o)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0, scale: show && isAnswer ? [1, 1.06, 1] : 1 }}
              transition={{ delay: i * 0.03 }}
              whileTap={{ scale: 0.94, y: 3 }}
              className={clsx(
                "relative flex h-20 items-center justify-center rounded-2xl border-2 px-2 text-center font-display text-lg font-extrabold shadow-[0_4px_0_0_var(--line)] transition-colors sm:h-24 sm:text-xl",
                show && isAnswer
                  ? "border-ok bg-ok text-white shadow-[0_4px_0_0_rgb(0_0_0/0.2)]"
                  : show && o === picked
                    ? "border-bad bg-bad text-white shadow-[0_4px_0_0_rgb(0_0_0/0.2)]"
                    : "border-line bg-surface hover:border-maths/50",
              )}
            >
              <span className="absolute left-2.5 top-1.5 hidden font-sans text-xs font-bold text-muted sm:block">{i + 1}</span>
              <RichText text={o} />
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {wrongPick && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-center font-display font-bold text-bad">
            −3 seconds
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
