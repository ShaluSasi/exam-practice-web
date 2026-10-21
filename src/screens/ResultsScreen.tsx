import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { Check, ChevronDown, Clock, Crown, Flame, House, Medal, RotateCcw, Share2, Swords, Target, Trophy, X, Zap } from "lucide-react";
import clsx from "clsx";
import { region } from "../config/regions";
import type { SubjectId } from "../content/schema";
import { Button } from "../components/Button";
import { Figure } from "../components/Figure";
import { scoreSession } from "../engine/scoring";
import { rankRounds, useStats } from "../store/profile";
import { SubjectChip } from "../components/QuestionHeader";
import { RichText } from "../components/RichText";
import { SettingsToggles, Logo } from "../components/TopBar";
import { burst } from "../lib/celebrate";
import { play } from "../lib/sound";
import { SUBJECT_STYLE, formatTime } from "../lib/subjects";
import { QuestionBody } from "../questions";
import { useSession } from "../store/session";
import { ShareSheet, type ShareTarget } from "../components/ShareSheet";
import { useNav, type Opponent } from "../store/nav";

/** Head-to-head result after playing a friend's challenge link. */
function VersusBanner({ opponent, mine, myMarks, myTimeMs, onReply }: { opponent: Opponent; mine: number; myMarks: number; myTimeMs: number; onReply: () => void }) {
  // Accuracy decides; equal accuracy goes to more marks, then to the faster player.
  const by = mine !== opponent.accuracy ? "accuracy" : myMarks !== opponent.marks ? "marks" : "time";
  const diff = by === "accuracy" ? mine - opponent.accuracy : by === "marks" ? myMarks - opponent.marks : opponent.timeMs - myTimeMs;
  const outcome = diff > 0 ? "win" : diff < 0 ? "lose" : "tie";
  const reason = by === "marks" ? " on marks" : by === "time" && outcome !== "tie" ? (outcome === "win" ? " — you were faster" : " by being faster") : "";
  const title =
    outcome === "win" ? `You beat ${opponent.name}${reason}! 🎉` : outcome === "lose" ? `${opponent.name} wins${reason} this time` : "It's a perfect tie!";
  const bars = [
    { who: "You", pct: mine, cls: "bg-brand" },
    { who: opponent.name, pct: opponent.accuracy, cls: "bg-white/70" },
  ];
  return (
    <motion.section
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="mt-4 overflow-hidden rounded-[28px] bg-[#1b1f3b] p-5 text-white shadow-pop sm:p-6"
    >
      <div className="flex items-center gap-3">
        <motion.span
          animate={{ rotate: [0, -12, 12, 0] }}
          transition={{ duration: 1.2, repeat: 2 }}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-brand-ink"
        >
          <Swords className="size-5" />
        </motion.span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Challenge result</p>
          <p className="font-display text-2xl font-extrabold tracking-tight">{title}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2.5">
        {bars.map((b, i) => (
          <div key={b.who} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3">
            <span className="truncate text-sm font-bold">{b.who}</span>
            <div className="h-3.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={clsx("h-full rounded-full", b.cls)}
                initial={{ width: 0 }}
                animate={{ width: `${b.pct}%` }}
                transition={{ delay: 0.3 + i * 0.25, duration: 0.9, ease: "easeOut" }}
              />
            </div>
            <span className="text-right font-display font-extrabold tabular-nums">{b.pct}%</span>
          </div>
        ))}
      </div>
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onReply}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 font-display font-bold text-brand-ink"
      >
        <Share2 className="size-5" /> {outcome === "win" ? `Tell ${opponent.name} you won` : "Challenge them back"}
      </motion.button>
    </motion.section>
  );
}

function ScoreRing({ pct }: { pct: number }) {
  const R = 70;
  const C = 2 * Math.PI * R;
  const mv = useMotionValue(0);
  const offset = useTransform(mv, (v) => C - (v / 100) * C);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const c = animate(mv, pct, { duration: 1.4, ease: [0.2, 0.8, 0.2, 1], delay: 0.3, onUpdate: (v) => setShown(Math.round(v)) });
    return () => c.stop();
  }, [pct, mv]);
  const color = pct >= 80 ? "var(--ok)" : pct >= 50 ? "var(--brand)" : "var(--bad)";
  return (
    <div className="relative size-48">
      <svg viewBox="0 0 160 160" className="size-full -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--line)" strokeWidth="14" />
        <motion.circle
          cx="80"
          cy="80"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={C}
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-5xl font-extrabold tabular-nums">{shown}%</div>
          <div className="text-sm font-semibold text-muted">accuracy</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone, delay }: { icon: typeof Zap; label: string; value: string; tone: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl border-2 border-line bg-surface p-4"
    >
      <Icon className={clsx("size-5", tone)} />
      <div className="mt-2 font-display text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
    </motion.div>
  );
}

function ScoreHistory({ currentId }: { currentId: string | undefined }) {
  const { rounds } = useStats();
  const ranked = useMemo(() => rankRounds(rounds), [rounds]);
  if (rounds.length === 0) return null;
  const best = ranked[0];
  const rank = ranked.findIndex((r) => r.id === currentId) + 1;
  const date = (t: number) => new Date(t).toLocaleDateString(region.locale, { day: "numeric", month: "short" });

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Your scoreboard</h2>
        {rank > 0 && rounds.length > 1 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8, type: "spring", stiffness: 400, damping: 14 }}
            className={clsx(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold",
              rank === 1 ? "bg-brand text-brand-ink" : "bg-surface-2 text-muted",
            )}
          >
            {rank === 1 ? <Crown className="size-4" /> : <Medal className="size-4" />}
            {rank === 1 ? "New personal best!" : `Your #${rank} round of ${rounds.length}`}
          </motion.span>
        )}
      </div>
      <div className="overflow-hidden rounded-[28px] border-2 border-line bg-surface">
        <div className="flex items-center gap-4 border-b-2 border-dashed border-line bg-brand-soft/50 p-4 sm:p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-brand-ink">
            <Crown className="size-6" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-muted">Personal best</div>
            <div className="font-display text-2xl font-extrabold tabular-nums">
              {best.accuracy}% <span className="text-base text-muted">· {best.marks}/{best.maxMarks} marks</span>
            </div>
          </div>
        </div>
        <ol className="divide-y-2 divide-line">
          {rounds.slice(0, 8).map((r, i) => {
            const current = r.id === currentId;
            return (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                className={clsx("grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_9rem_auto] sm:px-5", current && "bg-ok-soft/60")}
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">
                    {r.title || "Practice round"}
                    {current && <span className="ml-2 rounded-full bg-ok px-2 py-0.5 text-[11px] font-bold text-white">This round</span>}
                  </div>
                  <div className="text-xs font-semibold text-muted">
                    {date(r.at)} · {r.correct}/{r.total} correct · {formatTime(r.timeMs)}
                  </div>
                </div>
                <div className="hidden h-2.5 overflow-hidden rounded-full bg-surface-2 sm:block">
                  <motion.div
                    className={clsx("h-full rounded-full", r.accuracy >= 80 ? "bg-ok" : r.accuracy >= 50 ? "bg-brand" : "bg-bad")}
                    initial={{ width: 0 }}
                    animate={{ width: `${r.accuracy}%` }}
                    transition={{ delay: 0.6 + i * 0.05, duration: 0.7 }}
                  />
                </div>
                <div className="text-right font-display font-extrabold tabular-nums">
                  {r.marks}/{r.maxMarks}
                  <div className="text-xs font-semibold text-muted">{r.accuracy}%</div>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

export function ResultsScreen({ onHome, onRetry }: { onHome: () => void; onRetry: (questionIds: string[], title: string) => void }) {
  const s = useSession();
  const [openId, setOpenId] = useState<string | null>(null);
  const [share, setShare] = useState<ShareTarget | null>(null);
  const opponent = useNav((n) => n.opponent);
  const go = useNav((n) => n.go);
  const byId = useMemo(() => Object.fromEntries(s.questions.map((q) => [q.id, q])), [s.questions]);

  const { marks, maxMarks, accuracy: pct } = scoreSession(s.questions, s.attempts);
  const wrong = s.questions.filter((q) => !s.attempts.find((a) => a.questionId === q.id)?.correct);

  const subjects = Object.entries(
    s.attempts.reduce<Record<string, { c: number; t: number }>>((acc, a) => {
      const sub = byId[a.questionId].subject;
      acc[sub] ??= { c: 0, t: 0 };
      acc[sub].t++;
      if (a.correct) acc[sub].c++;
      return acc;
    }, {}),
  ) as [SubjectId, { c: number; t: number }][];

  useEffect(() => {
    play("finish");
    if (pct >= 50) {
      const t = setTimeout(() => burst(null, true), 500);
      return () => clearTimeout(t);
    }
  }, [pct]);

  const timeMs = (s.finishedAt ?? Date.now()) - s.startedAt;
  const openShare = () =>
    setShare({
      kind: "round",
      roundId: s.roundId,
      questionIds: s.questions.map((q) => q.id),
      title: s.title || "Mixed practice",
      accuracy: pct,
      marks,
      maxMarks,
      xp: s.xp,
      streak: s.bestStreak,
      timeMs,
    });

  const headline = pct >= 80 ? "Outstanding!" : pct >= 50 ? "Good work!" : "Keep practising!";
  const sub =
    pct >= 80 ? "You're exam-ready on these topics." : pct >= 50 ? "Solid effort — review the misses below." : "Every mistake is a lesson. Check the explanations below.";

  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <header className="flex items-center justify-between py-5">
          <Logo />
          <SettingsToggles />
        </header>

        {opponent && <VersusBanner opponent={opponent} mine={pct} myMarks={marks} myTimeMs={timeMs} onReply={openShare} />}

        <section className="mt-4 flex flex-col items-center rounded-[28px] border-2 border-line bg-surface p-6 text-center shadow-card sm:p-10">
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 12 }}
            className="mb-3 grid size-14 place-items-center rounded-2xl bg-brand text-brand-ink"
          >
            <Trophy className="size-7" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="font-display text-4xl font-extrabold tracking-tight"
          >
            {headline}
          </motion.h1>
          <p className="mt-1 text-muted">{sub}</p>
          <div className="my-7">
            <ScoreRing pct={pct} />
          </div>
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={Target} label="Marks" value={`${marks}/${maxMarks}`} tone="text-maths" delay={0.4} />
            <Stat icon={Zap} label="XP earned" value={`+${s.xp}`} tone="fill-brand text-brand" delay={0.48} />
            <Stat icon={Flame} label="Best streak" value={String(s.bestStreak)} tone="fill-bad/30 text-bad" delay={0.56} />
            <Stat icon={Clock} label="Time" value={formatTime(timeMs)} tone="text-physics" delay={0.64} />
          </div>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={openShare}
            className="group relative mt-7 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#ffc53d] to-brand px-6 py-4 font-display text-lg font-extrabold text-brand-ink shadow-pop"
          >
            <motion.span
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-white/40"
              animate={{ left: ["-35%", "135%"] }}
              transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
            />
            <Share2 className="relative size-5" /> <span className="relative">Share &amp; challenge friends</span>
          </motion.button>

          <div className="mt-3 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            {wrong.length > 0 && (
              <Button variant="dark" onClick={() => onRetry(wrong.map((q) => q.id), s.title ? `${s.title} · mistakes` : "Mistakes")}>
                <RotateCcw className="size-5" /> Retry {wrong.length} mistake{wrong.length === 1 ? "" : "s"}
              </Button>
            )}
            <Button variant="ghost" onClick={() => go("board")}>
              <Trophy className="size-5" /> Leaderboard
            </Button>
            <Button variant="ghost" onClick={onHome}>
              <House className="size-5" /> Back to home
            </Button>
          </div>
        </section>
        <ShareSheet target={share} onClose={() => setShare(null)} />

        <ScoreHistory currentId={s.finishedAt ? s.roundId : undefined} />

        {/* Subject breakdown */}
        <section className="mt-8">
          <h2 className="mb-4 font-display text-2xl font-extrabold tracking-tight">By subject</h2>
          <div className="grid gap-3 rounded-[28px] border-2 border-line bg-surface p-5 sm:p-6">
            {subjects.map(([sub, v], i) => (
              <div key={sub} className="grid grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-3 sm:grid-cols-[10rem_1fr_auto]">
                <span className="truncate font-semibold">{region.subjects[sub]}</span>
                <div className="h-3.5 overflow-hidden rounded-full bg-surface-2">
                  <motion.div
                    className={clsx("h-full rounded-full", SUBJECT_STYLE[sub].bg)}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(v.c / v.t) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * i, duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <span className="font-display font-bold tabular-nums text-muted">
                  {v.c}/{v.t}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Review */}
        <section className="mt-8">
          <h2 className="mb-4 font-display text-2xl font-extrabold tracking-tight">Review answers</h2>
          <ul className="grid gap-3">
            {s.attempts.map((a, i) => {
              const q = byId[a.questionId];
              const open = openId === q.id;
              return (
                <motion.li
                  key={q.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.04 }}
                  className="overflow-hidden rounded-2xl border-2 border-line bg-surface"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : q.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 p-4 text-left hover:bg-surface-2/50"
                  >
                    <span
                      className={clsx(
                        "grid size-8 shrink-0 place-items-center rounded-full text-white",
                        a.correct ? "bg-ok" : "bg-bad",
                      )}
                    >
                      {a.correct ? <Check className="size-4" strokeWidth={3} /> : <X className="size-4" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-muted">Q{i + 1}</span>
                        <SubjectChip subject={q.subject} />
                        {a.response === undefined && <span className="text-xs font-semibold text-muted">Skipped</span>}
                      </span>
                      <span className="mt-1.5 line-clamp-2 block text-[15px]">
                        <RichText text={q.prompt} />
                      </span>
                    </span>
                    <motion.span animate={{ rotate: open ? 180 : 0 }} className="shrink-0 text-muted">
                      <ChevronDown className="size-5" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t-2 border-dashed border-line p-4 sm:p-5">
                          {q.image && q.type !== "hotspot" && <Figure media={q.image} className="mb-4" frameClassName="max-w-[380px]" />}
                          <QuestionBody q={q} response={a.response} onChange={() => {}} reveal />
                          {q.explanation && (
                            <div className="mt-5 rounded-2xl bg-surface-2 p-4 leading-relaxed">
                              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Explanation</p>
                              <RichText text={q.explanation} />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
