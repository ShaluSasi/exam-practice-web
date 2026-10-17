import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { Check, ChevronDown, Clock, Flame, House, RotateCcw, Target, Trophy, X, Zap } from "lucide-react";
import clsx from "clsx";
import { region } from "../config/regions";
import type { Question, SubjectId } from "../content/schema";
import { Button } from "../components/Button";
import { SubjectChip } from "../components/QuestionHeader";
import { RichText } from "../components/RichText";
import { SettingsToggles, Logo } from "../components/TopBar";
import { burst } from "../lib/celebrate";
import { play } from "../lib/sound";
import { SUBJECT_STYLE, formatTime } from "../lib/subjects";
import { QuestionBody } from "../questions";
import { useSession } from "../store/session";

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

export function ResultsScreen({ onHome, onRetry }: { onHome: () => void; onRetry: (qs: Question[]) => void }) {
  const s = useSession();
  const [openId, setOpenId] = useState<string | null>(null);
  const byId = useMemo(() => Object.fromEntries(s.questions.map((q) => [q.id, q])), [s.questions]);

  const correct = s.attempts.filter((a) => a.correct).length;
  const total = s.attempts.length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const maxMarks = s.questions.reduce((n, q) => n + q.marks, 0);
  const marks = s.attempts.reduce((n, a) => {
    const q = byId[a.questionId];
    if (a.correct) return n + q.marks;
    return a.response === undefined ? n : n - (q.negativeMarks ?? 0);
  }, 0);
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
            <Stat icon={Clock} label="Time" value={formatTime((s.finishedAt ?? Date.now()) - s.startedAt)} tone="text-physics" delay={0.64} />
          </div>

          <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            {wrong.length > 0 && (
              <Button onClick={() => onRetry(wrong)}>
                <RotateCcw className="size-5" /> Retry {wrong.length} mistake{wrong.length === 1 ? "" : "s"}
              </Button>
            )}
            <Button variant={wrong.length ? "ghost" : "primary"} onClick={onHome}>
              <House className="size-5" /> Back to home
            </Button>
          </div>
        </section>

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
                          <QuestionBody q={q} response={a.response} onChange={() => {}} reveal />
                          <div className="mt-5 rounded-2xl bg-surface-2 p-4 leading-relaxed">
                            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Explanation</p>
                            <RichText text={q.explanation} />
                          </div>
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
