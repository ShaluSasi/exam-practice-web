import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Check, ChevronsUp, CloudOff, Gem, Loader2, Lock, Medal, Rocket, Share2, Shield, Skull, Sparkles, Target, Trophy } from "lucide-react";
import clsx from "clsx";
import { AccountButton } from "../../components/Account";
import { ShareSheet, type ShareTarget } from "../../components/ShareSheet";
import { burst } from "../../lib/celebrate";
import { play } from "../../lib/sound";
import { useAuth } from "../../store/auth";
import { OVERALL, loadGameRanks, submitGameRun, useGameBoard, useMyGameRanks } from "../../store/gameBoard";
import { useGames } from "../../store/games";
import { showGameUrl, useNav } from "../../store/nav";
import { GameIntro, GameOver, GameTopBar } from "../GameKit";
import { gameMeta } from "../registry";
import { Battle, type BattleResult } from "./Battle";
import { BADGES, LASERS, RANKS, UPGRADES, rankOf, useGalaxy, useTodayMissions, type Badge, type UpgradeId } from "./progress";
import { CATEGORIES, PERIOD_TEXT, Scoreboard, type Category } from "./Scoreboard";
import { SECTIONS, isSectionId, levelLabel, maxLevel, sectionOf, symbolSize, type SectionId } from "./sections";

const meta = gameMeta("galaxy");

interface Result extends BattleResult {
  newBest: boolean;
  /** Beat this device's earlier best on the mission. */
  newMissionBest: boolean;
  badges: Badge[];
  missions: string[];
  rankBefore: number;
  /** This week's rank on the mission before this run, if known. */
  boardRankBefore: number | null;
}

type Phase = "intro" | "play" | "over" | "board";
type Saving = "sending" | "saved" | "offline" | "guest" | "none";

export function GalaxyGuardian({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [result, setResult] = useState<Result | null>(null);
  const [run, setRun] = useState(0);
  const [boardFor, setBoardFor] = useState<string>(OVERALL);
  const [share, setShare] = useState<ShareTarget | null>(null);
  const [saving, setSaving] = useState<Saving>("guest");
  /** The run whose save is in progress; an older save finishing late must not overwrite a newer result. */
  const savingRun = useRef<string | null>(null);
  /** The wait before the result screen; a new run started meanwhile cancels it. */
  const overTimer = useRef(0);
  const section = useGalaxy((s) => s.section);
  const setSection = useGalaxy((s) => s.setSection);
  const signedIn = useAuth((s) => s.status === "signedIn");
  const mission = sectionOf(section);

  // A shared link picks the mission: /games/galaxy?mode=mul
  useEffect(() => {
    const mode = useNav.getState().gameMode;
    if (isSectionId(mode)) setSection(mode);
    useNav.setState({ gameMode: null });
  }, [setSection]);
  useEffect(() => showGameUrl("galaxy", section === "mixed" ? null : section), [section]);
  useEffect(() => {
    if (signedIn) void loadGameRanks("galaxy", "week");
  }, [signedIn]);

  const onDone = (r: BattleResult) => {
    const rankBefore = useGalaxy.getState().lifetime.score;
    const missionBest = useGalaxy.getState().sections[r.section]?.best ?? 0;
    const boardRankBefore = useGameBoard.getState().ranks["galaxy:week"]?.data?.[r.section]?.rank ?? null;
    const newBest = useGames.getState().finish("galaxy", r.score, r.correct);
    const rec = useGalaxy.getState().recordRun(r, r.section);
    setResult({ ...r, newBest, newMissionBest: missionBest > 0 && r.score > missionBest, badges: rec.badges, missions: rec.missions, rankBefore, boardRankBefore });
    // The run is already recorded; the "SHIELDS DOWN" sequence plays out before the result screen.
    // Back pressed meanwhile goes to the intro and stays there.
    window.clearTimeout(overTimer.current);
    overTimer.current = window.setTimeout(() => setPhase((p) => (p === "play" ? "over" : p)), 2200);

    if (r.score <= 0) {
      setSaving("none");
      return;
    }
    if (!useAuth.getState().user) {
      setSaving("guest");
      return;
    }
    setSaving("sending");
    const runId = crypto.randomUUID();
    savingRun.current = runId;
    void submitGameRun({
      id: runId,
      game: "galaxy",
      section: r.section,
      at: Date.now(),
      score: r.score,
      wave: r.wave,
      level: r.level,
      correct: r.correct,
      answered: r.answered,
      bestCombo: r.bestCombo,
    }).then(async (ok) => {
      if (ok) await loadGameRanks("galaxy", "week", true);
      if (savingRun.current === runId) setSaving(ok ? "saved" : "offline");
    });
  };

  const openBoard = (id: string) => {
    setBoardFor(id);
    setPhase("board");
    window.scrollTo({ top: 0 });
  };
  const playMission = (id: SectionId) => {
    window.clearTimeout(overTimer.current);
    setSection(id);
    setRun((n) => n + 1);
    setPhase("play");
    window.scrollTo({ top: 0 });
  };
  const shareGame = (c?: Pick<Category, "id" | "name" | "symbol">) => {
    const sec = c ?? { id: section, name: mission.name, symbol: mission.symbol };
    setShare({ kind: "game", game: "galaxy", gameTitle: meta.title, section: sec.id, sectionName: sec.name, symbol: sec.symbol });
  };

  return (
    <>
      <GameTopBar title={phase === "board" ? `${meta.title} · Scoreboard` : meta.title} onBack={phase === "intro" ? onExit : () => setPhase("intro")}>
        {phase === "intro" && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => openBoard(OVERALL)}
            aria-label="Scoreboard"
            title="Scoreboard"
            className="grid size-10 place-items-center rounded-xl border-2 border-line bg-surface text-muted transition-colors hover:text-fg"
          >
            <Trophy className="size-[18px]" />
          </motion.button>
        )}
      </GameTopBar>
      {phase === "intro" && (
        <GameIntro
          meta={meta}
          glyphs={["★", "✦", "☄", "✧", "★", "✺", "⋆", "☄"]}
          onPlay={() => playMission(section)}
          playLabel={
            <span className="flex items-center gap-2">
              Play
              <span className="rounded-lg px-1.5 py-0.5 text-base text-[#0b1030]" style={{ background: mission.color }}>
                {mission.symbol}
              </span>
              <span className="hidden min-[400px]:inline">{mission.name}</span>
            </span>
          }
          actions={
            <>
              <motion.button
                type="button"
                onClick={() => openBoard(OVERALL)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 rounded-2xl bg-white/20 px-5 py-4 font-display text-lg font-extrabold backdrop-blur hover:bg-white/30"
              >
                <Trophy className="size-5" /> Scoreboard
              </motion.button>
              <motion.button
                type="button"
                onClick={() => shareGame()}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 rounded-2xl bg-white/20 px-5 py-4 font-display text-lg font-extrabold backdrop-blur hover:bg-white/30"
              >
                <Share2 className="size-5" /> Share
              </motion.button>
            </>
          }
        >
          <MissionPicker selected={section} onSelect={setSection} onPlay={playMission} onBoard={openBoard} />
          <Hangar />
        </GameIntro>
      )}
      {phase === "play" && <Battle key={run} section={section} onDone={onDone} />}
      {phase === "over" && result && (
        <GameOver
          meta={meta}
          score={result.score}
          newBest={result.newBest}
          headline={`${sectionOf(result.section).symbol} ${sectionOf(result.section).name} · ${
            result.wave >= 12 ? "Galactic legend!" : result.wave >= 8 ? "Deep-space hero!" : result.wave >= 5 ? "Earth is safe… for now!" : "Good flight, cadet!"
          }`}
          stats={[
            { label: "Level", value: `${result.level}/${maxLevel(result.section)}` },
            { label: "Correct", value: result.correct },
            { label: "Accuracy", value: `${result.answered ? Math.round((result.correct / result.answered) * 100) : 0}%` },
            { label: "Best combo", value: result.bestCombo },
          ]}
          actions={
            <>
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() =>
                  setShare({
                    kind: "game",
                    game: "galaxy",
                    gameTitle: meta.title,
                    section: result.section,
                    sectionName: sectionOf(result.section).name,
                    symbol: sectionOf(result.section).symbol,
                    score: { points: result.score, level: result.level, wave: result.wave, correct: result.correct },
                  })
                }
                className="flex items-center gap-2 rounded-2xl bg-[#ffd23f] px-6 py-3.5 font-display text-lg font-extrabold text-[#1b1f3b] shadow-[0_5px_0_0_rgb(0_0_0/0.25)]"
              >
                <Share2 className="size-5" /> Share
              </motion.button>
              <button
                type="button"
                onClick={() => openBoard(result.section)}
                className="flex items-center gap-2 rounded-2xl border-2 border-white/40 px-6 py-3.5 font-display text-lg font-bold hover:bg-white/10"
              >
                <Trophy className="size-5" /> Scoreboard
              </button>
            </>
          }
          extra={
            <>
              <RunRank result={result} saving={saving} onBoard={openBoard} />
              <Rewards result={result} />
            </>
          }
          skills={result.skills}
          mistakes={result.mistakes}
          onAgain={() => playMission(result.section)}
          onExit={onExit}
        />
      )}
      {phase === "board" && (
        <Scoreboard
          key={boardFor}
          initial={boardFor}
          onPlay={playMission}
          onShareGame={(c) => shareGame(c)}
          onShareRank={(r) =>
            setShare({
              kind: "game",
              game: "galaxy",
              gameTitle: meta.title,
              section: r.category.id,
              sectionName: r.category.name,
              symbol: r.category.symbol,
              rank: { rank: r.rank, participants: r.participants, period: r.period, points: r.points },
            })
          }
        />
      )}
      <ShareSheet target={share} onClose={() => setShare(null)} />
    </>
  );
}

/** Pick a mission: what kind of questions the asteroids carry. */
function MissionPicker({
  selected,
  onSelect,
  onPlay,
  onBoard,
}: {
  selected: SectionId;
  onSelect: (id: SectionId) => void;
  onPlay: (id: SectionId) => void;
  onBoard: (id: string) => void;
}) {
  const records = useGalaxy((s) => s.sections);
  const ranks = useMyGameRanks("galaxy", "week");
  const reduce = useReducedMotion();
  const sel = sectionOf(selected);
  const top = maxLevel(selected);
  const reached = records[selected]?.bestLevel ?? 0;

  return (
    <section className="mt-5 rounded-3xl border-2 border-line bg-surface p-5 shadow-card">
      <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
        <Rocket className="size-5 text-maths" /> Choose your mission
      </h3>
      <p className="text-sm text-muted">Pick the questions you want to practise. Every wave you clear is a level up!</p>

      <div role="radiogroup" aria-label="Mission" className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {SECTIONS.map((s, i) => {
          const on = s.id === selected;
          const rec = records[s.id];
          const r = ranks?.[s.id];
          const lv = maxLevel(s.id);
          const best = rec?.bestLevel ?? 0;
          return (
            <motion.button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              initial={{ opacity: 0, y: 14, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.05 + i * 0.03, type: "spring", stiffness: 320, damping: 24 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (!on) play("tap");
                onSelect(s.id);
              }}
              onDoubleClick={() => onPlay(s.id)}
              className={clsx(
                "relative flex flex-col items-start overflow-hidden rounded-2xl border-2 p-3 text-left transition-colors",
                on ? "border-transparent bg-[#0b1030] text-white" : "border-line bg-surface hover:border-fg/30",
              )}
              style={on ? { boxShadow: `0 0 0 3px ${s.color}, 0 10px 30px -8px ${s.color}` } : undefined}
            >
              {on && (
                <motion.span
                  layoutId="mission-glow"
                  className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full blur-2xl"
                  style={{ background: `${s.color}66` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <div className="relative flex w-full items-start justify-between gap-2">
                <motion.span
                  animate={on && !reduce ? { rotate: [0, -8, 8, 0], scale: [1, 1.12, 1] } : { rotate: 0, scale: 1 }}
                  transition={{ duration: 0.6 }}
                  className={clsx("grid h-11 min-w-11 place-items-center rounded-xl px-1.5 font-display font-extrabold text-[#0b1030]", symbolSize(s.symbol, "text-3xl", "text-lg"))}
                  style={{ background: s.color }}
                >
                  {s.symbol}
                </motion.span>
                {r ? (
                  <span className={clsx("rounded-full px-2 py-0.5 font-display text-xs font-extrabold", on ? "bg-white/15" : "bg-surface-2")} title="Your rank this week">
                    #{r.rank}
                  </span>
                ) : !rec ? (
                  <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider", on ? "bg-white/15" : "bg-surface-2 text-muted")}>New</span>
                ) : null}
              </div>
              <span className="relative mt-2 flex items-center gap-1 font-display font-extrabold leading-tight">
                {s.name}
                {on && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-4 place-items-center rounded-full" style={{ background: s.color }}>
                    <Check className="size-3 text-[#0b1030]" strokeWidth={4} />
                  </motion.span>
                )}
              </span>
              <span className={clsx("relative text-xs leading-snug", on ? "text-white/70" : "text-muted")}>{s.blurb}</span>
              <span className="relative mt-2 flex w-full gap-0.5" aria-label={`Best level ${best} of ${lv}`}>
                {Array.from({ length: lv }, (_, k) => (
                  <span key={k} className={clsx("h-1.5 flex-1 rounded-full", k >= best && (on ? "bg-white/15" : "bg-surface-2"))} style={k < best ? { background: s.color } : undefined} />
                ))}
              </span>
              <span className={clsx("relative mt-1 text-[11px] font-bold tabular-nums", on ? "text-white/70" : "text-muted")}>
                {rec ? `Best ${rec.best.toLocaleString("en-IN")} · Lvl ${rec.bestLevel}` : `${lv} levels`}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* The selected mission's level ladder */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selected}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="relative mt-4 overflow-hidden rounded-2xl bg-[#0b1030] p-4 text-white"
        >
          <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(60% 90% at 100% 0%, ${sel.color}40, transparent)` }} />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-display font-extrabold">
              <ChevronsUp className="size-5" style={{ color: sel.color }} /> {sel.name}: level ladder
            </p>
            <div className="flex gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => onBoard(selected)}
                className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 font-display text-sm font-bold hover:bg-white/20"
              >
                <Trophy className="size-4" /> Ranking
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                whileHover={{ scale: 1.04 }}
                onClick={() => onPlay(selected)}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 font-display text-sm font-extrabold text-[#0b1030]"
                style={{ background: sel.color }}
              >
                <Rocket className="size-4" /> Launch
              </motion.button>
            </div>
          </div>
          <ol className="relative mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {Array.from({ length: top }, (_, k) => {
              const lvl = k + 1;
              const done = lvl <= reached;
              return (
                <motion.li
                  key={lvl}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: k * 0.04 }}
                  className={clsx("w-32 shrink-0 rounded-xl border p-2", !done && "border-white/15 bg-white/5")}
                  style={done ? { background: `${sel.color}30`, borderColor: `${sel.color}80` } : undefined}
                >
                  <p className="flex items-center justify-between font-display text-xs font-extrabold tracking-wider" style={{ color: done ? sel.color : "rgba(255,255,255,0.6)" }}>
                    LEVEL {lvl}
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : lvl === reached + 1 ? <Target className="size-3.5" /> : <Lock className="size-3 opacity-60" />}
                  </p>
                  <p className="mt-0.5 text-[13px] font-semibold leading-snug text-white/90">{levelLabel(selected, lvl)}</p>
                </motion.li>
              );
            })}
          </ol>
          <p className="relative mt-2 text-xs font-semibold text-white/60">Each wave you clear moves you up a level: bigger numbers, trickier questions, faster asteroids.</p>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

/** Where this run put the student on the scoreboard. */
function RunRank({ result, saving, onBoard }: { result: Result; saving: Saving; onBoard: (id: string) => void }) {
  const ranks = useMyGameRanks("galaxy", "week");
  const mission = sectionOf(result.section);
  const mine = ranks?.[result.section];
  const overall = ranks?.[OVERALL];
  const ref = useRef<HTMLElement>(null);
  const climbed = mine && result.boardRankBefore ? result.boardRankBefore - mine.rank : 0;
  const fresh = !!mine && result.boardRankBefore === null;

  useEffect(() => {
    if (saving === "saved" && mine && (climbed > 0 || mine.rank <= 3)) {
      const t = setTimeout(() => {
        burst(ref.current, true);
        play("levelup");
      }, 300);
      return () => clearTimeout(t);
    }
  }, [saving, mine, climbed]);

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-5 rounded-3xl border-2 border-line bg-surface p-5 shadow-card"
    >
      <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
        <Trophy className="size-5 text-[#e0a100]" /> Scoreboard
      </h3>
      {saving === "none" ? (
        <p className="mt-2 text-sm text-muted">Score some points to get on the {mission.name} scoreboard.</p>
      ) : saving === "guest" ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-sm text-muted">Sign in to put this score on the {mission.name} scoreboard and see your rank among other pilots.</p>
          <AccountButton />
        </div>
      ) : saving === "sending" || (saving === "saved" && !ranks) ? (
        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-muted">
          <Loader2 className="size-4 animate-spin" /> Sending your score to the scoreboard…
        </p>
      ) : saving === "offline" ? (
        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-muted">
          <CloudOff className="size-4" /> Saved on this device. It goes on the scoreboard when you're back online.
        </p>
      ) : (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {[
            { id: result.section as string, name: mission.name, symbol: mission.symbol, color: mission.color, r: mine },
            { id: OVERALL, name: "Overall", symbol: "🏆", color: CATEGORIES[0].color, r: overall },
          ].map((b, i) => (
            <motion.button
              key={b.id}
              type="button"
              onClick={() => onBoard(b.id)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.12, type: "spring", stiffness: 300, damping: 20 }}
              whileHover={{ y: -2 }}
              className="flex items-center gap-3 rounded-2xl border-2 border-line p-3 text-left hover:border-fg/30"
            >
              <span className={clsx("grid h-12 min-w-12 place-items-center rounded-xl px-1 font-display font-extrabold text-[#0b1030]", symbolSize(b.symbol, "text-3xl", "text-lg"))} style={{ background: b.color }}>
                {b.symbol}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wider text-muted">
                  {b.name} {PERIOD_TEXT.week}
                </span>
                {b.r ? (
                  <span className="font-display text-2xl font-extrabold tabular-nums">
                    #{b.r.rank} <span className="text-sm font-semibold text-muted">of {b.r.participants}</span>
                  </span>
                ) : (
                  <span className="font-display font-bold text-muted">Not ranked yet</span>
                )}
              </span>
              {b.id === result.section && climbed > 0 && (
                <motion.span
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 text-xs font-extrabold text-ok"
                >
                  <ArrowUp className="size-3.5" /> {climbed}
                </motion.span>
              )}
              {b.id === result.section && fresh && <span className="rounded-full bg-[#ffd23f] px-2.5 py-1 text-xs font-extrabold text-[#1b1f3b]">NEW!</span>}
            </motion.button>
          ))}
        </div>
      )}
      {result.newMissionBest && (
        <p className="mt-3 flex items-center gap-2 text-sm font-bold text-ok">
          <Sparkles className="size-4" /> New personal best on {mission.name}!
        </p>
      )}
    </motion.section>
  );
}

function Ship({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      viewBox="0 0 60 90"
      className={className}
      animate={reduce ? undefined : { y: [0, -8, 0], rotate: [-3, 3, -3] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    >
      <path d="M22 66 Q30 92 38 66 Z" fill="#ffb03a">
        <animate attributeName="d" values="M22 66 Q30 92 38 66 Z;M22 66 Q30 80 38 66 Z;M22 66 Q30 92 38 66 Z" dur="0.3s" repeatCount="indefinite" />
      </path>
      <path d="M30 2 C40 14 44 34 42 64 L18 64 C16 34 20 14 30 2 Z" fill="#f1f5f9" stroke="#334155" strokeWidth="2" />
      <circle cx="30" cy="30" r="7" fill="#5ee7ff" stroke="#1e3a8a" strokeWidth="2" />
      <path d="M18 44 L4 64 L18 60 Z M42 44 L56 64 L42 60 Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" />
    </motion.svg>
  );
}

function Count({ from = 0, to }: { from?: number; to: number }) {
  const [n, setN] = useState(from);
  useEffect(() => {
    const c = animate(from, to, { duration: 1.2, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [from, to]);
  return <>{n.toLocaleString()}</>;
}

function RankEmblem({ index, className }: { index: number; className?: string }) {
  const tones = ["#94a3b8", "#5ee7ff", "#6bff8f", "#ffd23f", "#ff9a3c", "#ff7ad9", "#c084fc"];
  return (
    <span className={clsx("relative grid place-items-center rounded-2xl font-display font-extrabold text-[#0b1030]", className)} style={{ background: tones[index], boxShadow: `0 0 24px ${tones[index]}88` }}>
      <span className="flex gap-px">
        {Array.from({ length: Math.min(3, index + 1) }, (_, i) => (
          <Sparkles key={i} className="size-3.5" />
        ))}
      </span>
      <span className="text-[10px] leading-none">{index >= 3 ? "★".repeat(index - 2) : ""}</span>
    </span>
  );
}

/** Pilot rank, stardust, daily missions, shop and badges. */
function Hangar() {
  const g = useGalaxy();
  const rank = rankOf(g.lifetime.score);
  const missions = useTodayMissions();
  const dustRef = useRef<HTMLSpanElement>(null);

  const claim = (id: string, el: HTMLElement) => {
    const got = g.claimMission(id);
    if (got) {
      play("power");
      burst(el);
    }
  };

  return (
    <div className="mt-5 space-y-4">
      {/* Pilot card */}
      <section className="relative overflow-hidden rounded-3xl bg-[#0b1030] p-5 text-white shadow-pop">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_20%,rgba(192,38,211,0.35),transparent),radial-gradient(50%_60%_at_10%_90%,rgba(56,189,248,0.25),transparent)]" />
        <div className="relative flex items-center gap-4">
          <Ship className="h-24 w-16 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Pilot rank</p>
            <div className="flex items-center gap-2">
              <RankEmblem index={rank.index} className="h-9 w-12" />
              <p className="font-display text-3xl font-extrabold tracking-tight">{rank.name}</p>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#5ee7ff] via-[#a78bfa] to-[#ff7ad9]"
                initial={{ width: 0 }}
                animate={{ width: `${rank.progress * 100}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            <p className="mt-1 text-xs font-semibold text-white/70">
              {rank.next ? `${rank.toNext.toLocaleString()} points to ${rank.next}` : "Highest rank reached!"}
            </p>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/10 py-2">
            <p className="flex items-center justify-center gap-1 font-display text-xl font-extrabold text-[#ffd23f]">
              <Gem className="size-4" />
              <span ref={dustRef}>{g.stardust.toLocaleString()}</span>
            </p>
            <p className="text-[11px] font-semibold text-white/70">Stardust</p>
          </div>
          <div className="rounded-2xl bg-white/10 py-2">
            <p className="font-display text-xl font-extrabold">{g.lifetime.bestWave || "–"}</p>
            <p className="text-[11px] font-semibold text-white/70">Best wave</p>
          </div>
          <div className="rounded-2xl bg-white/10 py-2">
            <p className="flex items-center justify-center gap-1 font-display text-xl font-extrabold">
              <Skull className="size-4 text-[#ff7ad9]" />
              {g.lifetime.bosses}
            </p>
            <p className="text-[11px] font-semibold text-white/70">Bosses</p>
          </div>
        </div>
      </section>

      {/* Daily missions */}
      <section className="rounded-3xl border-2 border-line bg-surface p-5 shadow-card">
        <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
          <Target className="size-5 text-english" /> Today's missions
        </h3>
        <p className="text-sm text-muted">New missions every day. Finish them for bonus stardust.</p>
        <ul className="mt-3 space-y-3">
          {missions.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={clsx("text-[15px] font-semibold", m.claimed && "text-muted line-through")}>{m.text}</span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-muted">
                    {m.progress.toLocaleString()}/{m.goal.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                  <motion.div
                    className={clsx("h-full rounded-full", m.done ? "bg-ok" : "bg-gradient-to-r from-[#a78bfa] to-[#ff7ad9]")}
                    initial={{ width: 0 }}
                    animate={{ width: `${(m.progress / m.goal) * 100}%` }}
                  />
                </div>
              </div>
              {m.claimed ? (
                <span className="grid size-10 place-items-center rounded-xl bg-ok-soft text-ok">
                  <Check className="size-5" strokeWidth={3} />
                </span>
              ) : (
                <motion.button
                  type="button"
                  disabled={!m.done}
                  onClick={(e) => claim(m.id, e.currentTarget)}
                  animate={m.done ? { scale: [1, 1.08, 1] } : undefined}
                  transition={{ duration: 1, repeat: Infinity }}
                  className={clsx(
                    "flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 font-display text-sm font-extrabold",
                    m.done ? "bg-[#ffd23f] text-[#1b1f3b] shadow-pop" : "bg-surface-2 text-muted",
                  )}
                >
                  <Gem className="size-3.5" /> {m.done ? "Claim" : ""} {m.reward}
                </motion.button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Shop */}
      <section className="rounded-3xl border-2 border-line bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
            <Rocket className="size-5 text-maths" /> Hangar
          </h3>
          <span className="flex items-center gap-1 rounded-full bg-[#ffd23f]/20 px-3 py-1 font-display font-extrabold text-[#b7791f] dark:text-[#ffd23f]">
            <Gem className="size-4" /> {g.stardust.toLocaleString()}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
            const u = UPGRADES[id];
            const lvl = g.upgrades[id];
            const cost = u.costs[lvl];
            const can = cost !== undefined && g.stardust >= cost;
            const Icon = id === "shield" ? Shield : id === "cryo" ? Sparkles : Trophy;
            return (
              <div key={id} className="rounded-2xl border-2 border-line p-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-xl bg-maths/12 text-maths">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display font-extrabold leading-tight">{u.name}</p>
                    <p className="text-xs text-muted">{u.desc}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="flex gap-1">
                    {u.costs.map((_, i) => (
                      <span key={i} className={clsx("h-2 w-5 rounded-full", i < lvl ? "bg-maths" : "bg-surface-2")} />
                    ))}
                  </span>
                  {cost === undefined ? (
                    <span className="text-xs font-extrabold text-ok">MAX</span>
                  ) : (
                    <motion.button
                      type="button"
                      disabled={!can}
                      whileTap={{ scale: 0.92 }}
                      onClick={(e) => {
                        if (g.buyUpgrade(id)) {
                          play("levelup");
                          burst(e.currentTarget);
                        }
                      }}
                      className={clsx(
                        "flex items-center gap-1 rounded-lg px-2.5 py-1 font-display text-sm font-extrabold",
                        can ? "bg-maths text-white" : "bg-surface-2 text-muted",
                      )}
                    >
                      <Gem className="size-3.5" /> {cost}
                    </motion.button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-sm font-bold uppercase tracking-wider text-muted">Lasers</p>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {LASERS.map((l) => {
            const owned = g.owned.includes(l.id);
            const on = g.laser === l.id;
            const can = !owned && g.stardust >= l.cost;
            return (
              <motion.button
                key={l.id}
                type="button"
                whileTap={{ scale: 0.92 }}
                title={l.name}
                disabled={!owned && !can}
                onClick={(e) => {
                  if (owned) g.selectLaser(l.id);
                  else if (g.buyLaser(l.id)) {
                    play("power");
                    burst(e.currentTarget);
                  }
                }}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-2xl border-2 p-2 transition-colors",
                  on ? "border-fg bg-surface-2" : "border-line",
                  !owned && !can && "opacity-50",
                )}
              >
                <span
                  className="h-8 w-2.5 rounded-full"
                  style={{
                    background: l.color === "rainbow" ? "linear-gradient(#ff5f5f,#ffd23f,#6bff8f,#5ee7ff,#a78bfa,#ff5fd2)" : l.color,
                    boxShadow: `0 0 14px ${l.color === "rainbow" ? "#a78bfa" : l.color}`,
                  }}
                />
                <span className="text-[10px] font-bold leading-tight">{l.name}</span>
                <span className="text-[10px] font-extrabold text-muted">
                  {on ? "ON" : owned ? "Use" : (
                    <span className="flex items-center gap-0.5">
                      <Gem className="size-2.5" />
                      {l.cost}
                    </span>
                  )}
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Badges */}
      <section className="rounded-3xl border-2 border-line bg-surface p-5 shadow-card">
        <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
          <Medal className="size-5 text-brand" /> Badges
          <span className="text-sm font-semibold text-muted">
            {g.badges.length}/{BADGES.length}
          </span>
        </h3>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {BADGES.map((b) => {
            const got = g.badges.includes(b.id);
            return (
              <div key={b.id} title={`${b.name}: ${b.desc}`} className="flex flex-col items-center text-center">
                <span
                  className={clsx(
                    "grid size-12 place-items-center rounded-2xl",
                    got ? "bg-gradient-to-br from-[#ffd23f] to-[#ff7ad9] text-[#1b1f3b] shadow-pop" : "bg-surface-2 text-muted",
                  )}
                >
                  {got ? <b.icon className="size-6" /> : <Lock className="size-4" />}
                </span>
                <span className={clsx("mt-1 text-[10px] font-bold leading-tight", !got && "text-muted")}>{b.name}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border-2 border-dashed border-line p-4 text-sm text-muted">
        <span className="font-bold text-fg">Ranks: </span>
        {RANKS.map((r) => r.name).join(" → ")}
      </section>
    </div>
  );
}

/** Stardust, rank progress, new badges and missions earned in this run. */
function Rewards({ result }: { result: Result }) {
  const before = rankOf(result.rankBefore);
  const after = rankOf(result.rankBefore + result.score);
  const rankUp = after.index > before.index;
  const total = useGalaxy((s) => s.stardust);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (rankUp || result.badges.length) {
      const t = setTimeout(() => {
        burst(ref.current, true);
        play("levelup");
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [rankUp, result.badges.length]);

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="relative mt-5 overflow-hidden rounded-3xl bg-[#0b1030] p-5 text-white shadow-pop"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_90%_10%,rgba(192,38,211,0.35),transparent)]" />
      <div className="relative grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Stardust earned</p>
          <p className="mt-1 flex items-center gap-2 font-display text-4xl font-extrabold text-[#ffd23f]">
            <Gem className="size-7" /> +<Count to={result.stardust} />
          </p>
          <p className="text-sm font-semibold text-white/70">You now have {total.toLocaleString()}. Spend it in the hangar!</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Pilot rank</p>
          <div className="mt-1 flex items-center gap-2">
            <RankEmblem index={after.index} className="h-9 w-12" />
            <p className="font-display text-2xl font-extrabold">{after.name}</p>
            {rankUp && (
              <motion.span
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: -4 }}
                transition={{ delay: 1.4, type: "spring", stiffness: 300, damping: 10 }}
                className="rounded-full bg-[#6bff8f] px-2.5 py-0.5 font-display text-sm font-extrabold text-[#0b1030]"
              >
                RANK UP!
              </motion.span>
            )}
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#5ee7ff] via-[#a78bfa] to-[#ff7ad9]"
              initial={{ width: `${(rankUp ? 0 : before.progress) * 100}%` }}
              animate={{ width: `${after.progress * 100}%` }}
              transition={{ delay: 0.8, duration: 1.2, ease: "easeOut" }}
            />
          </div>
          <p className="mt-1 text-xs font-semibold text-white/70">{after.next ? `${after.toNext.toLocaleString()} points to ${after.next}` : "Highest rank reached!"}</p>
        </div>
      </div>

      {(result.badges.length > 0 || result.missions.length > 0) && (
        <div className="relative mt-4 flex flex-wrap gap-2">
          {result.badges.map((b, i) => (
            <motion.span
              key={b.id}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 1.2 + i * 0.2, type: "spring", stiffness: 300, damping: 12 }}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#ffd23f] to-[#ff7ad9] px-3 py-2 font-display font-extrabold text-[#1b1f3b]"
            >
              <b.icon className="size-5" /> New badge: {b.name}
            </motion.span>
          ))}
          {result.missions.map((m, i) => (
            <motion.span
              key={m}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.4 + i * 0.15 }}
              className="flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 text-sm font-bold"
            >
              <Check className="size-4 text-[#6bff8f]" strokeWidth={3} /> Mission done: {m}. Claim it in the hangar!
            </motion.span>
          ))}
        </div>
      )}
    </motion.section>
  );
}
