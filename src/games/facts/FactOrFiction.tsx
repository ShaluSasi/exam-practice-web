import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { ArrowRight, Check, Flame, Heart, X, Zap } from "lucide-react";
import clsx from "clsx";
import { region } from "../../config/regions";
import { burst } from "../../lib/celebrate";
import { play } from "../../lib/sound";
import { SUBJECT_STYLE } from "../../lib/subjects";
import { useCurrentGrade } from "../../store/profile";
import { useGames } from "../../store/games";
import { GameIntro, GameOver, GameTopBar, PointsPop, useTopics, type Mistake, type SkillScore } from "../GameKit";
import { gameMeta } from "../registry";
import { FACTS, type Fact } from "./facts";

const meta = gameMeta("facts");
const LIVES = 3;
const SWIPE_PX = 110;

function shuffled<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Facts for a class: its own syllabus plus any earlier class's, as revision, but never a later class's.
 * Only the subjects switched on at the start screen; all of them if none of those have cards for this class.
 */
function factsFor(grade: number, subjects: string[]): Fact[] {
  const forGrade = FACTS.filter((f) => f.grade <= grade);
  const picked = forGrade.filter((f) => subjects.includes(region.subjects[f.subject]));
  return picked.length ? picked : forGrade;
}

interface Result {
  score: number;
  correct: number;
  answered: number;
  bestStreak: number;
  skills: SkillScore[];
  mistakes: Mistake[];
  newBest: boolean;
  /** Cards in this run's deck, which varies by class, so "cleared the deck" compares against the right size. */
  deckSize: number;
}

export function FactOrFiction({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [result, setResult] = useState<Result | null>(null);
  const [run, setRun] = useState(0);

  return (
    <>
      <GameTopBar title={meta.title} onBack={phase === "play" ? () => setPhase("intro") : onExit} />
      {phase === "intro" && <GameIntro meta={meta} glyphs={["✓", "✗", "?", "!", "✓", "✗", "?", "★"]} onPlay={() => setPhase("play")} />}
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
            result.answered === result.deckSize && result.correct > result.answered - LIVES
              ? "You cleared the whole deck!"
              : result.correct >= 25
                ? "Walking encyclopedia!"
                : result.correct >= 12
                  ? "Sharp mind!"
                  : "Nice try. Every card teaches you something!"
          }
          stats={[
            { label: "Correct", value: result.correct },
            { label: "Accuracy", value: `${result.answered ? Math.round((result.correct / result.answered) * 100) : 0}%` },
            { label: "Best streak", value: result.bestStreak },
            { label: "Cards", value: result.answered },
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

function SubjectChip({ fact, light }: { fact: Fact; light?: boolean }) {
  const st = SUBJECT_STYLE[fact.subject];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", light ? "bg-white/20 text-white" : clsx(st.soft, st.text))}>
      <st.icon className="size-3.5" /> {region.subjects[fact.subject]} · {fact.topic}
    </span>
  );
}

/** The top card. Drag it sideways, or use the buttons or arrow keys. */
function SwipeCard({ fact, onAnswer }: { fact: Fact; onAnswer: (truth: boolean) => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-16, 16]);
  const factStamp = useTransform(x, [20, 110], [0, 1]);
  const fictionStamp = useTransform(x, [-110, -20], [1, 0]);
  const st = SUBJECT_STYLE[fact.subject];

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_PX || info.velocity.x > 700) onAnswer(true);
    else if (info.offset.x < -SWIPE_PX || info.velocity.x < -700) onAnswer(false);
  };

  return (
    <motion.div
      drag="x"
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      style={{ x, rotate }}
      initial={{ scale: 0.9, y: 18, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="absolute inset-0 cursor-grab touch-pan-y select-none overflow-hidden rounded-[32px] border-2 border-line bg-surface shadow-pop active:cursor-grabbing"
    >
      <div className={clsx("h-3", st.bg)} />
      <div className="flex h-[calc(100%-12px)] flex-col p-6">
        <SubjectChip fact={fact} />
        <p className="my-auto py-4 text-center font-display text-[26px] font-extrabold leading-tight tracking-tight sm:text-3xl">{fact.text}</p>
        <div className="flex justify-between text-sm font-bold text-muted">
          <span>← Fiction</span>
          <span>Fact →</span>
        </div>
      </div>
      <motion.span
        style={{ opacity: factStamp }}
        className="absolute left-5 top-10 -rotate-12 rounded-xl border-4 border-ok px-3 py-1 font-display text-3xl font-extrabold text-ok"
      >
        FACT
      </motion.span>
      <motion.span
        style={{ opacity: fictionStamp }}
        className="absolute right-5 top-10 rotate-12 rounded-xl border-4 border-bad px-3 py-1 font-display text-3xl font-extrabold text-bad"
      >
        FICTION
      </motion.span>
    </motion.div>
  );
}

function Round({ onDone }: { onDone: (r: Result) => void }) {
  const grade = useCurrentGrade();
  const subjects = useTopics(meta);
  const [deck] = useState(() => shuffled(factsFor(grade, subjects)));
  const [idx, setIdx] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [reveal, setReveal] = useState<{ fact: Fact; right: boolean } | null>(null);
  const [pop, setPop] = useState<{ id: number; text: string } | null>(null);
  const stats = useRef({ correct: 0, answered: 0, bestStreak: 0, skills: new Map<string, SkillScore>(), mistakes: [] as Mistake[] });
  const done = useRef(false);
  const revealRef = useRef<HTMLDivElement>(null);
  const finish = useGames((s) => s.finish);
  const fact = deck[idx];

  const answer = (truth: boolean) => {
    if (reveal || !fact) return;
    const right = truth === fact.truth;
    const s = stats.current;
    s.answered++;
    const name = region.subjects[fact.subject];
    const sk = s.skills.get(name) ?? { name, right: 0, total: 0 };
    sk.total++;
    s.skills.set(name, sk);
    if (right) {
      sk.right++;
      s.correct++;
      const st = streak + 1;
      const pts = 10 + Math.min(st - 1, 10) * 2;
      s.bestStreak = Math.max(s.bestStreak, st);
      setStreak(st);
      setScore((x) => x + pts);
      setPop({ id: Date.now(), text: `+${pts}` });
      play(st > 0 && st % 5 === 0 ? "combo" : "correct");
      if (st > 0 && st % 5 === 0) setTimeout(() => burst(revealRef.current), 120);
    } else {
      setStreak(0);
      setLives((l) => l - 1);
      s.mistakes.push({ prompt: fact.text, answer: fact.truth ? "Fact" : "Fiction", given: fact.truth ? "Fiction" : "Fact", tip: fact.why });
      play("wrong");
    }
    setReveal({ fact, right });
  };

  const next = () => {
    if (!reveal || done.current) return;
    if (lives <= 0 || idx + 1 >= deck.length) {
      done.current = true;
      const s = stats.current;
      const newBest = finish("facts", score, s.correct);
      onDone({ score, correct: s.correct, answered: s.answered, bestStreak: s.bestStreak, skills: [...s.skills.values()], mistakes: s.mistakes, newBest, deckSize: deck.length });
      return;
    }
    play("tap");
    setReveal(null);
    setIdx(idx + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (reveal) {
        if (["Enter", " ", "ArrowRight", "ArrowLeft"].includes(e.key)) {
          e.preventDefault();
          next();
        }
      } else if (e.key === "ArrowRight") answer(true);
      else if (e.key === "ArrowLeft") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const behind = deck.slice(idx + 1, idx + 3);

  return (
    <div className="mx-auto max-w-md pb-10">
      <div className="flex items-center justify-between">
        <div className="flex gap-1" aria-label={`${lives} lives left`}>
          {Array.from({ length: LIVES }, (_, i) => (
            <motion.span key={i} animate={i >= lives ? { scale: [1.4, 0.8], opacity: 0.35 } : { scale: 1, opacity: 1 }}>
              <Heart className={clsx("size-7", i < lives ? "fill-bad text-bad" : "text-muted")} />
            </motion.span>
          ))}
        </div>
        <motion.span
          key={streak}
          initial={{ scale: streak > 1 ? 1.5 : 1 }}
          animate={{ scale: 1 }}
          className={clsx("flex items-center gap-1 font-display text-lg font-extrabold", streak >= 3 ? "text-bad" : "text-muted")}
        >
          <Flame className={clsx("size-5", streak >= 3 && "fill-brand")} /> {streak}
        </motion.span>
        <span className="relative flex items-center gap-1 font-display text-xl font-extrabold tabular-nums">
          <Zap className="size-5 fill-brand text-brand" /> {score}
          {pop && <PointsPop key={pop.id} text={pop.text} className="-top-2 right-0 text-xl text-brand" />}
        </span>
      </div>

      <p className="mt-2 text-center text-sm font-semibold text-muted">
        Card {idx + 1} of {deck.length}
      </p>

      <div ref={revealRef} className="relative mt-3 h-[400px] sm:h-[420px]">
        {!reveal &&
          behind
            .slice()
            .reverse()
            .map((f, i, arr) => {
              const depth = arr.length - i;
              return (
                <div
                  key={f.text}
                  className="absolute inset-0 overflow-hidden rounded-[32px] border-2 border-line bg-surface shadow-card"
                  style={{ transform: `translateY(${depth * 12}px) scale(${1 - depth * 0.05}) rotate(${depth % 2 ? 2 : -2}deg)` }}
                >
                  <div className={clsx("h-3", SUBJECT_STYLE[f.subject].bg)} />
                </div>
              );
            })}
        <AnimatePresence mode="popLayout">
          {!reveal && fact && <SwipeCard key={fact.text} fact={fact} onAnswer={answer} />}
          {reveal && (
            <motion.div
              key={`r-${reveal.fact.text}`}
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className={clsx(
                "absolute inset-0 flex flex-col overflow-hidden rounded-[32px] p-6 text-white shadow-pop",
                reveal.right ? "bg-gradient-to-br from-[#0f9f5f] to-[#0b7f8f]" : "bg-gradient-to-br from-[#e5483b] to-[#c0306a]",
              )}
            >
              <SubjectChip fact={reveal.fact} light />
              <div className="mt-4 flex items-center gap-3">
                <motion.span
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 400, damping: 12 }}
                  className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-[#1b1f3b]"
                >
                  {reveal.right ? <Check className="size-7 text-ok" strokeWidth={3.5} /> : <X className="size-7 text-bad" strokeWidth={3.5} />}
                </motion.span>
                <div>
                  <p className="font-display text-2xl font-extrabold leading-tight">{reveal.right ? "Correct!" : "Not quite!"}</p>
                  <p className="font-semibold text-white/85">It's {reveal.fact.truth ? "a FACT" : "FICTION"}.</p>
                </div>
              </div>
              <p className="mt-4 text-[17px] font-semibold leading-snug text-white/90">“{reveal.fact.text}”</p>
              <div className="mt-auto rounded-2xl bg-black/20 p-4 backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-wider text-white/70">Why</p>
                <p className="mt-1 text-[16px] font-semibold leading-snug">{reveal.fact.why}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-center gap-6">
        {reveal ? (
          <motion.button
            type="button"
            onClick={next}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-16 items-center gap-2 rounded-full bg-fg px-10 font-display text-xl font-extrabold text-bg shadow-pop"
          >
            {lives <= 0 ? "See results" : idx + 1 >= deck.length ? "Finish" : "Next card"} <ArrowRight className="size-5" />
          </motion.button>
        ) : (
          <>
            <motion.button
              type="button"
              aria-label="Fiction"
              onClick={() => answer(false)}
              whileHover={{ scale: 1.08, rotate: -6 }}
              whileTap={{ scale: 0.88 }}
              className="flex flex-col items-center gap-1"
            >
              <span className="grid size-[72px] place-items-center rounded-full border-4 border-bad bg-surface text-bad shadow-pop">
                <X className="size-9" strokeWidth={3.5} />
              </span>
              <span className="font-display text-sm font-extrabold text-bad">FICTION</span>
            </motion.button>
            <motion.button
              type="button"
              aria-label="Fact"
              onClick={() => answer(true)}
              whileHover={{ scale: 1.08, rotate: 6 }}
              whileTap={{ scale: 0.88 }}
              className="flex flex-col items-center gap-1"
            >
              <span className="grid size-[72px] place-items-center rounded-full border-4 border-ok bg-surface text-ok shadow-pop">
                <Check className="size-9" strokeWidth={3.5} />
              </span>
              <span className="font-display text-sm font-extrabold text-ok">FACT</span>
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
}
