import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Award, Check, Flame, Play, Sparkles, Target, Zap } from "lucide-react";
import clsx from "clsx";
import { region } from "../config/regions";
import { questionBank } from "../content";
import type { Question, SubjectId } from "../content/schema";
import { Button } from "../components/Button";
import { RichText } from "../components/RichText";
import { Logo, SettingsToggles, XpPill } from "../components/TopBar";
import { SUBJECT_STYLE } from "../lib/subjects";
import { useProfile } from "../store/profile";
import { TYPE_LABEL } from "../questions";

const SUBJECTS = Object.keys(region.subjects) as SubjectId[];
const GLYPHS = [
  { c: "∑", x: "6%", y: "18%", s: 64, d: 7 },
  { c: "π", x: "88%", y: "12%", s: 56, d: 9 },
  { c: "λ", x: "78%", y: "70%", s: 48, d: 8 },
  { c: "√", x: "12%", y: "78%", s: 52, d: 10 },
  { c: "∫", x: "48%", y: "6%", s: 44, d: 11 },
  { c: "Δ", x: "94%", y: "44%", s: 40, d: 7.5 },
];

function FloatingGlyphs() {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {GLYPHS.map((g) => (
        <motion.span
          key={g.c}
          className="absolute font-display font-extrabold text-fg/[0.06]"
          style={{ left: g.x, top: g.y, fontSize: g.s }}
          animate={reduce ? undefined : { y: [0, -18, 0], rotate: [0, 6, 0] }}
          transition={{ duration: g.d, repeat: Infinity, ease: "easeInOut" }}
        >
          {g.c}
        </motion.span>
      ))}
    </div>
  );
}

/** Looping mini demo of the practice flow: pick → correct → XP. */
function HeroDemo() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? 3 : 0);
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % 5), [1400, 700, 900, 1800, 600][step]);
    return () => clearTimeout(t);
  }, [step, reduce]);
  const opts = ["$\\sqrt{16}$", "$\\dfrac{22}{7}$", "$\\sqrt{2}$", "$0.\\overline{3}$"];

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <motion.div
        className="absolute inset-0 -rotate-6 rounded-3xl bg-maths/25"
        animate={reduce ? undefined : { rotate: [-6, -4, -6] }}
        transition={{ duration: 6, repeat: Infinity }}
      />
      <motion.div
        className="absolute inset-0 rotate-3 rounded-3xl bg-brand/30"
        animate={reduce ? undefined : { rotate: [3, 5, 3] }}
        transition={{ duration: 7, repeat: Infinity }}
      />
      <div className="relative rounded-3xl border-2 border-line bg-surface p-5 shadow-pop">
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-full bg-maths/12 px-2.5 py-1 text-xs font-bold text-maths">Maths · Class 9</span>
          <div className="flex items-center gap-1 text-sm font-bold text-brand">
            <Flame className="size-4 fill-brand" /> 4
          </div>
        </div>
        <p className="mb-4 font-semibold">Which of these is irrational?</p>
        <div className="grid grid-cols-2 gap-2">
          {opts.map((o, i) => {
            const picked = i === 2 && step >= 1;
            const right = i === 2 && step >= 2;
            return (
              <motion.div
                key={o}
                animate={right ? { scale: [1, 1.06, 1] } : undefined}
                className={clsx(
                  "flex h-14 items-center justify-center rounded-xl border-2 transition-colors duration-300",
                  right ? "border-ok bg-ok-soft" : picked ? "border-brand bg-brand-soft" : "border-line",
                )}
              >
                <RichText text={o} />
              </motion.div>
            );
          })}
        </div>
        <AnimatePresence>
          {step >= 2 && step <= 3 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-center justify-between rounded-xl bg-ok px-4 py-2.5 font-display font-bold text-white"
            >
              <span className="flex items-center gap-2">
                <Check className="size-5" strokeWidth={3} /> Spot on!
              </span>
              <motion.span initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="flex items-center gap-1">
                <Zap className="size-4 fill-white" /> +15
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
        {(step < 2 || step > 3) && <div className="mt-4 h-[44px]" />}
      </div>
    </div>
  );
}

function Toggle({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <motion.button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={clsx(
        "rounded-2xl border-2 font-display font-bold transition-colors",
        on ? "border-fg bg-fg text-bg" : "border-line bg-surface text-muted hover:border-fg/30 hover:text-fg",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

export function HomeScreen({ onStart }: { onStart: (qs: Question[]) => void }) {
  const profile = useProfile();
  const [grades, setGrades] = useState<number[]>([]);
  const [subjects, setSubjects] = useState<SubjectId[]>([]);

  const selection = useMemo(
    () =>
      questionBank.filter(
        (q) => (grades.length === 0 || grades.includes(q.grade)) && (subjects.length === 0 || subjects.includes(q.subject)),
      ),
    [grades, subjects],
  );
  const countFor = (s: SubjectId) =>
    questionBank.filter((q) => q.subject === s && (grades.length === 0 || grades.includes(q.grade))).length;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const types = [...new Set(questionBank.map((q) => q.type))];

  return (
    <div className="paper relative min-h-dvh">
      <FloatingGlyphs />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <header className="flex items-center justify-between py-5">
          <Logo />
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <XpPill xp={profile.totalXp} />
            </div>
            <SettingsToggles />
          </div>
        </header>

        {/* Hero */}
        <section className="grid items-center gap-12 pb-14 pt-8 md:grid-cols-[1.15fr_1fr] md:pt-14">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-line bg-surface px-3 py-1.5 text-sm font-semibold"
            >
              <Sparkles className="size-4 text-brand" />
              {region.boards.join(" · ")} · {region.gradeLabel(region.grades[0])}–{region.grades.at(-1)}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="font-display text-[42px] font-extrabold leading-[1.02] tracking-tight sm:text-6xl"
            >
              Practise like it's the{" "}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">board exam.</span>
                <motion.span
                  className="absolute inset-x-0 bottom-1 z-0 h-4 rounded-sm bg-brand/45 sm:h-5"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  style={{ originX: 0 }}
                  transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
                />
              </span>
              <br />
              Learn like it's a game.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="mt-5 max-w-md text-lg text-muted"
            >
              Bite-sized questions with instant feedback, step-by-step explanations, streaks and XP — for Maths,
              Physics, Chemistry and Biology.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <Button onClick={() => onStart(questionBank)} className="px-7 py-4 text-lg">
                <Play className="size-5 fill-current" /> Start mixed practice
              </Button>
              <a href="#build" className="font-semibold text-muted underline-offset-4 hover:text-fg hover:underline">
                or build your own set
              </a>
            </motion.div>
            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-10 flex gap-8"
            >
              {[
                { icon: Zap, label: "Total XP", value: profile.totalXp, cls: "fill-brand text-brand" },
                { icon: Flame, label: "Best streak", value: profile.bestStreak, cls: "fill-bad text-bad" },
                { icon: Award, label: "Sessions", value: profile.sessions, cls: "text-maths" },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{s.label}</dt>
                  <dd className="mt-1 flex items-center gap-1.5 font-display text-2xl font-extrabold tabular-nums">
                    <s.icon className={clsx("size-5", s.cls)} /> {s.value}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: 4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 140, damping: 16 }}
            className="px-4"
          >
            <HeroDemo />
          </motion.div>
        </section>

        {/* Builder */}
        <section id="build" className="scroll-mt-6 rounded-[28px] border-2 border-line bg-surface p-5 shadow-card sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-tight">Build your practice set</h2>
              <p className="mt-1 text-muted">Leave everything unselected for a mix of all classes and subjects.</p>
            </div>
          </div>

          <h3 className="mb-3 mt-7 text-sm font-bold uppercase tracking-wider text-muted">Class</h3>
          <div className="grid grid-cols-4 gap-2 sm:flex">
            {region.grades.map((g) => (
              <Toggle key={g} on={grades.includes(g)} onClick={() => setGrades(toggle(grades, g))} className="px-5 py-3 sm:min-w-28">
                <span className="hidden sm:inline">{region.gradeLabel(g)}</span>
                <span className="sm:hidden">{g}</span>
              </Toggle>
            ))}
          </div>

          <h3 className="mb-3 mt-7 text-sm font-bold uppercase tracking-wider text-muted">Subject</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SUBJECTS.map((s, i) => {
              const st = SUBJECT_STYLE[s];
              const on = subjects.includes(s);
              const n = countFor(s);
              return (
                <motion.button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSubjects(toggle(subjects, s))}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  className={clsx(
                    "group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-colors sm:p-5",
                    on ? "border-fg bg-surface shadow-[0_4px_0_0_var(--fg)]" : "border-line bg-surface hover:border-fg/30",
                  )}
                >
                  <span
                    className={clsx(
                      "pointer-events-none absolute -bottom-6 -right-2 font-display text-[110px] font-extrabold leading-none opacity-10 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110",
                      st.text,
                    )}
                  >
                    {st.glyph}
                  </span>
                  <span className={clsx("grid size-11 place-items-center rounded-xl text-white", st.bg)}>
                    <st.icon className="size-6" />
                  </span>
                  <span className="mt-4 block font-display text-lg font-bold">{region.subjects[s]}</span>
                  <span className="text-sm text-muted">
                    {n} question{n === 1 ? "" : "s"}
                  </span>
                  <AnimatePresence>
                    {on && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-fg text-bg"
                      >
                        <Check className="size-4" strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-7 flex flex-col gap-4 border-t-2 border-dashed border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {types.map((t) => (
                <span key={t} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
                  {TYPE_LABEL[t]}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2 font-semibold text-muted">
                <Target className="size-4" />
                <motion.span key={selection.length} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="tabular-nums">
                  {selection.length}
                </motion.span>
                question{selection.length === 1 ? "" : "s"}
              </span>
              <Button variant="dark" disabled={selection.length === 0} onClick={() => onStart(selection)}>
                Start <Play className="size-4 fill-current" />
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
