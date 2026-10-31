import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Image as ImageIcon, Layers, Lightbulb, MinusCircle, PencilLine, RotateCcw, Tag } from "lucide-react";
import clsx from "clsx";
import { region } from "../config/regions";
import type { AdminChapter, AdminQuestion, AdminQuestions, Difficulty } from "../content/api";
import type { Question, QuestionType, SubjectId } from "../content/schema";
import { ROUND_MIX, ROUND_SIZE } from "../engine/scoring";
import { SUBJECT_STYLE } from "../lib/subjects";
import { api } from "../store/auth";
import { useNav } from "../store/nav";
import { Button } from "./Button";
import { RichText } from "./RichText";
import { SettingsToggles } from "./TopBar";

/*
 * Pieces shared by the admin pages that work chapter by chapter
 * (DifficultyScreen, SequenceScreen): the chapter browser, question details
 * and the bar for submitting changes.
 */

export const LEVELS: Difficulty[] = ["easy", "medium", "hard"];
export const LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Moderate", hard: "Hard" };
export const TONE: Record<Difficulty, { bar: string; soft: string; on: string }> = {
  easy: { bar: "bg-ok", soft: "bg-ok-soft text-ok", on: "border-ok bg-ok text-white" },
  medium: { bar: "bg-brand", soft: "bg-brand-soft text-brand", on: "border-brand bg-brand text-brand-ink" },
  hard: { bar: "bg-bad", soft: "bg-bad-soft text-bad", on: "border-bad bg-bad text-white" },
};
export const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "Multiple choice",
  multi: "More than one answer",
  numeric: "Numeric",
  assertion_reason: "Assertion–reason",
  match: "Match the following",
  order: "Put in order",
  hotspot: "Tap the diagram",
};
/** Questions of each level one round asks for (scoring.ts pickRound). */
export const ROUND_WANTS: Record<Difficulty, number> = {
  easy: Math.round(ROUND_SIZE * ROUND_MIX.easy),
  hard: Math.round(ROUND_SIZE * ROUND_MIX.hard),
  medium: ROUND_SIZE - Math.round(ROUND_SIZE * ROUND_MIX.easy) - Math.round(ROUND_SIZE * ROUND_MIX.hard),
};

export const countBy = <T,>(items: readonly T[], key: (t: T) => string) => {
  const out = new Map<string, number>();
  for (const t of items) out.set(key(t), (out.get(key(t)) ?? 0) + 1);
  return out;
};

export const formatDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Easy / moderate / hard as one stacked bar. */
export function DifficultyBar({ counts, className }: { counts: Record<Difficulty, number>; className?: string }) {
  const total = LEVELS.reduce((n, l) => n + counts[l], 0) || 1;
  return (
    <div className={clsx("flex h-2.5 overflow-hidden rounded-full bg-line", className)} aria-hidden>
      {LEVELS.map((l) => (
        <motion.div
          key={l}
          className={TONE[l].bar}
          initial={{ width: 0 }}
          animate={{ width: `${(counts[l] / total) * 100}%` }}
          transition={{ type: "spring", stiffness: 160, damping: 24 }}
        />
      ))}
    </div>
  );
}

export function Counts({ counts }: { counts: Record<Difficulty, number> }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold">
      {LEVELS.map((l) => (
        <span key={l} className="flex items-center gap-1.5">
          <span className={clsx("size-2.5 rounded-full", TONE[l].bar)} />
          {LABEL[l]} {counts[l]}
        </span>
      ))}
    </span>
  );
}

export function Header({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-2 py-5">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onBack}
        aria-label="Back"
        className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-line bg-surface text-muted hover:text-fg"
      >
        <ArrowLeft className="size-5" />
      </motion.button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="truncate text-sm font-semibold text-muted">{subtitle}</p>}
      </div>
      <SettingsToggles />
    </header>
  );
}

export function Problem({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[24px] border-2 border-line bg-surface p-6 text-center">
      <p className="font-semibold">{message}</p>
      <Button variant="ghost" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="grid place-items-center py-24" role="status" aria-label="Loading">
      <div className="size-10 animate-spin rounded-full border-4 border-line border-t-brand" />
    </div>
  );
}

// ---------- Chapter list ----------

/** The class and subject picked last, kept while the page is open in this tab. */
const picked = { grade: 0, subject: "all" as SubjectId | "all" };

function ChapterList({ chapters, onOpen, note }: { chapters: AdminChapter[]; onOpen: (key: string) => void; note?: (c: AdminChapter) => ReactNode }) {
  const grades = [...new Set(chapters.map((c) => c.grade))].sort((a, b) => a - b);
  const [chosenGrade, setGrade] = useState(picked.grade);
  const grade = grades.includes(chosenGrade) ? chosenGrade : grades[0];
  const inGrade = chapters.filter((c) => c.grade === grade);
  const subjects = [...new Set(inGrade.map((c) => c.subject))];
  const [chosenSubject, setSubject] = useState(picked.subject);
  const subject = chosenSubject !== "all" && subjects.includes(chosenSubject) ? chosenSubject : "all";
  picked.grade = grade;
  picked.subject = subject;
  const list = inGrade.filter((c) => subject === "all" || c.subject === subject);
  const total = (cs: AdminChapter[]) => {
    const counts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (const c of cs) for (const l of LEVELS) counts[l] += c.difficulty[l];
    return counts;
  };
  const overall = total(list);
  const changed = list.reduce((n, c) => n + c.changed, 0);
  const questions = list.reduce((n, c) => n + c.count, 0);

  return (
    <>
      <div role="tablist" aria-label="Class" className="mb-3 flex gap-1.5 rounded-2xl border-2 border-line bg-surface p-1.5">
        {grades.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={g === grade}
            onClick={() => setGrade(g)}
            className={clsx(
              "flex-1 rounded-xl px-3 py-2 font-display text-sm font-bold transition-colors sm:text-base",
              g === grade ? "bg-fg text-bg shadow-pop" : "text-muted hover:text-fg",
            )}
          >
            {region.gradeLabel(g)}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", ...subjects] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === subject}
            onClick={() => setSubject(s)}
            className={clsx(
              "rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition-colors",
              s === subject ? "border-fg bg-fg text-bg" : "border-line bg-surface text-muted hover:text-fg",
            )}
          >
            {s === "all" ? "All subjects" : region.subjects[s]}
          </button>
        ))}
      </div>

      <section className="mb-5 rounded-[24px] border-2 border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-extrabold">
            {region.gradeLabel(grade)} · {subject === "all" ? "all subjects" : region.subjects[subject]}
          </h2>
          <p className="text-sm font-semibold text-muted">
            {list.length} chapters · {questions} questions{changed ? ` · ${changed} changed by admins` : ""}
          </p>
        </div>
        <DifficultyBar counts={overall} className="mt-3" />
        <div className="mt-2">
          <Counts counts={overall} />
        </div>
      </section>

      <ul className="grid gap-2.5">
        {list.map((c, i) => {
          const style = SUBJECT_STYLE[c.subject];
          const short = LEVELS.filter((l) => c.difficulty[l] < ROUND_WANTS[l]);
          return (
            <motion.li key={c.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
              <button
                type="button"
                onClick={() => onOpen(c.key)}
                className="group flex w-full items-center gap-3 rounded-2xl border-2 border-line bg-surface p-3.5 text-left transition hover:border-fg/30 sm:gap-4 sm:p-4"
              >
                <span className={clsx("grid size-11 shrink-0 place-items-center rounded-xl", style.soft)}>
                  <style.icon className={clsx("size-5", style.text)} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-bold">
                    {c.no ? `${c.no}. ` : ""}
                    {c.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-muted">
                    {subject === "all" && <span>{region.subjects[c.subject]}</span>}
                    <span>{c.count} questions</span>
                    {c.changed > 0 && <span className="text-brand">{c.changed} changed</span>}
                    {note?.(c)}
                    {short.length > 0 && (
                      <span className="flex items-center gap-1 text-bad">
                        <AlertTriangle className="size-3" /> few {short.map((l) => LABEL[l].toLowerCase()).join(" & ")}
                      </span>
                    )}
                  </span>
                  <DifficultyBar counts={c.difficulty} className="mt-2 h-2" />
                  <span className="mt-1.5 block">
                    <Counts counts={c.difficulty} />
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-fg" />
              </button>
            </motion.li>
          );
        })}
      </ul>
    </>
  );
}

export function Chip({ icon: Icon, children, className }: { icon?: typeof Tag; children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted", className)}>
      {Icon && <Icon className="size-3.5" />}
      {children}
    </span>
  );
}

/** Type, topic, marks and the other flags of a question. */
export function Flags({ item }: { item: AdminQuestion }) {
  const q = item.question;
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip icon={Layers}>{TYPE_LABEL[q.type]}</Chip>
      <Chip>{q.topic}</Chip>
      <Chip>
        {q.marks} mark{q.marks === 1 ? "" : "s"}
      </Chip>
      {!!q.negativeMarks && <Chip icon={MinusCircle} className="text-bad">−{q.negativeMarks} if wrong</Chip>}
      {q.hint && <Chip icon={Lightbulb}>Hint</Chip>}
      {q.image && <Chip icon={ImageIcon}>Image</Chip>}
      {q.tags?.map((t) => (
        <Chip key={t} icon={Tag}>
          {t}
        </Chip>
      ))}
      {item.changedBy && (
        <Chip icon={PencilLine} className="bg-brand-soft text-brand">
          Was {LABEL[item.fileDifficulty]} · changed by {item.changedBy}
          {item.changedAt ? ` on ${formatDate(item.changedAt)}` : ""}
        </Chip>
      )}
    </div>
  );
}

function Option({ text, right }: { text: string; right: boolean }) {
  return (
    <li className={clsx("flex items-start gap-2 rounded-xl border-2 px-3 py-2 text-sm", right ? "border-ok bg-ok-soft font-semibold" : "border-line")}>
      {right ? <Check className="mt-0.5 size-4 shrink-0 text-ok" /> : <span className="mt-0.5 size-4 shrink-0" />}
      <RichText text={text} />
    </li>
  );
}

/** The question's options with the answer marked, its hint and explanation. */
export function AnswerDetails({ q }: { q: Question }) {
  let answer: React.ReactNode;
  switch (q.type) {
    case "mcq":
      answer = <ul className="grid gap-1.5">{q.options.map((o) => <Option key={o.id} text={o.text} right={o.id === q.answer} />)}</ul>;
      break;
    case "multi":
      answer = <ul className="grid gap-1.5">{q.options.map((o) => <Option key={o.id} text={o.text} right={q.answers.includes(o.id)} />)}</ul>;
      break;
    case "numeric":
      answer = (
        <p className="text-sm">
          Answer: <strong>{q.answer}</strong>
          {q.unit ? ` ${q.unit}` : ""}
          {q.tolerance ? ` (± ${q.tolerance})` : ""}
        </p>
      );
      break;
    case "assertion_reason":
      answer = (
        <div className="grid gap-1.5 text-sm">
          <p>
            <strong>Assertion:</strong> <RichText text={q.assertion} />
          </p>
          <p>
            <strong>Reason:</strong> <RichText text={q.reason} />
          </p>
          <ul className="mt-1 grid gap-1.5">
            {region.assertionReasonOptions.map((o) => (
              <Option key={o.id} text={o.text} right={o.id === q.answer} />
            ))}
          </ul>
        </div>
      );
      break;
    case "match": {
      const right = new Map(q.right.map((r) => [r.id, r.text]));
      answer = (
        <ul className="grid gap-1.5 text-sm">
          {q.left.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-line px-3 py-2">
              <RichText text={l.text} />
              <ChevronRight className="size-4 text-muted" />
              <strong>
                <RichText text={right.get(q.pairs[l.id]) ?? "?"} />
              </strong>
            </li>
          ))}
        </ul>
      );
      break;
    }
    case "order": {
      const items = new Map(q.items.map((i) => [i.id, i.text]));
      answer = (
        <ol className="grid gap-1.5 text-sm">
          {q.answer.map((id, i) => (
            <li key={id} className="flex gap-2 rounded-xl border-2 border-line px-3 py-2">
              <strong>{i + 1}.</strong> <RichText text={items.get(id) ?? "?"} />
            </li>
          ))}
        </ol>
      );
      break;
    }
    case "hotspot":
      answer = (
        <p className="text-sm">
          Answer: <strong>{q.spots.find((s) => s.id === q.answer)?.label ?? q.answer}</strong>
        </p>
      );
      break;
  }
  return (
    <div className="grid gap-3">
      {answer}
      {q.hint && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
          <strong>Hint:</strong> <RichText text={q.hint} />
        </p>
      )}
      <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
        <strong>Explanation:</strong> <RichText text={q.explanation} />
      </p>
      <p className="text-xs text-muted">ID: {q.id}</p>
    </div>
  );
}


export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">{label}</p>
      <p className="font-display text-xl font-extrabold">{value}</p>
    </div>
  );
}

// ---------- Unsubmitted changes ----------

/** Unsubmitted changes on the open chapter, checked before leaving it. */
let unsaved = 0;
const leaveOk = () => unsaved === 0 || window.confirm(`Discard ${unsaved} unsubmitted change${unsaved === 1 ? "" : "s"}?`);

export type SaveMessage = { ok: boolean; text: string } | null;

/**
 * Submitting `count` unsubmitted changes with `save` (which returns the message to show).
 * Leaving the chapter, closing the tab or reloading asks first while there are any.
 */
export function useSubmit(count: number, save: () => Promise<string>) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SaveMessage>(null);

  useEffect(() => {
    unsaved = count;
    if (count === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      unsaved = 0;
      window.removeEventListener("beforeunload", warn);
    };
  }, [count]);

  useEffect(() => {
    if (!message?.ok) return;
    const t = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(t);
  }, [message]);

  const submit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      setMessage({ ok: true, text: await save() });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not save the changes." });
    } finally {
      setSaving(false);
    }
  };
  return { saving, message, setMessage, submit };
}

/** The bar at the bottom while there are unsubmitted changes, and the result once submitted. */
export function SubmitBar({
  count,
  label,
  saving,
  message,
  onDiscard,
  onSubmit,
}: {
  count: number;
  /** What is waiting to be submitted; by default "N changes". */
  label?: string;
  saving: boolean;
  message: SaveMessage;
  onDiscard: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <AnimatePresence>
        {message && count === 0 && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={clsx(
              "fixed inset-x-4 bottom-4 z-40 mx-auto max-w-xl rounded-2xl px-4 py-3 text-center text-sm font-bold shadow-pop",
              message.ok ? "bg-ok text-white" : "bg-bad text-white",
            )}
          >
            {message.text}
          </motion.p>
        )}
        {count > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-surface/95 px-4 py-3 backdrop-blur"
          >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 whitespace-nowrap font-display font-extrabold">
                {label ?? `${count} change${count === 1 ? "" : "s"}`}
                <span className="hidden sm:inline"> not submitted yet</span>
                {message && !message.ok && <span className="block text-sm font-semibold text-bad">{message.text}</span>}
              </p>
              <Button variant="ghost" aria-label="Discard changes" className="px-3.5 py-2.5 text-sm" disabled={saving} onClick={onDiscard}>
                <RotateCcw className="size-4" /> <span className="hidden min-[400px]:inline">Discard</span>
              </Button>
              <Button variant="ok" className="px-5 py-2.5 text-sm" disabled={saving} onClick={onSubmit}>
                <Check className="size-4" /> {saving ? "Saving…" : "Submit"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Room for the submit bar, so it never covers the last question. */}
      <div className="h-24" />
    </>
  );
}

// ---------- The page ----------

/**
 * An admin page that lists every chapter in every class; picking one loads its
 * questions and shows `children` for them. `reload` fetches them again after a save.
 */
export function ChapterBrowser({
  title,
  note,
  children,
}: {
  title: string;
  /** Extra detail on each chapter in the list. */
  note?: (c: AdminChapter) => ReactNode;
  children: (data: AdminQuestions, reload: () => Promise<void>) => ReactNode;
}) {
  const go = useNav((s) => s.go);
  const [chapters, setChapters] = useState<AdminChapter[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [data, setData] = useState<AdminQuestions | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /** The chapter open now: a slow answer for one opened before must not show under this one. */
  const openRef = useRef<string | null>(null);

  const loadChapters = useCallback(async () => {
    setProblem(null);
    try {
      setChapters((await api<{ chapters: AdminChapter[] }>("/api/admin/chapters")).chapters);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not load the chapters.");
    }
  }, []);

  const loadChapter = useCallback(async (key: string) => {
    setProblem(null);
    try {
      const questions = await api<AdminQuestions>(`/api/admin/questions?chapter=${encodeURIComponent(key)}`);
      if (openRef.current === key) setData(questions);
    } catch (e) {
      if (openRef.current === key) setProblem(e instanceof Error ? e.message : "Could not load the questions.");
    }
  }, []);

  useEffect(() => {
    void loadChapters();
  }, [loadChapters]);

  const openChapter = (key: string) => {
    setData(null);
    setOpen(key);
    openRef.current = key;
    window.scrollTo({ top: 0 });
    void loadChapter(key);
  };

  const back = () => {
    if (!leaveOk()) return;
    if (open) {
      setOpen(null);
      openRef.current = null;
      setData(null);
      setProblem(null);
      // The list includes what was just saved.
      void loadChapters();
      window.scrollTo({ top: 0 });
    } else go("admin");
  };

  const chapter = data?.chapter ?? chapters?.find((c) => c.key === open);
  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <Header
          title={open && chapter ? chapter.title : title}
          subtitle={open && chapter ? `${region.gradeLabel(chapter.grade)} · ${region.subjects[chapter.subject]}` : "All chapters in every class"}
          onBack={back}
        />
        {problem ? (
          <Problem message={problem} onRetry={() => void (open ? loadChapter(open) : loadChapters())} />
        ) : open ? (
          data ? <div key={open}>{children(data, () => loadChapter(open))}</div> : <Spinner />
        ) : chapters ? (
          <ChapterList chapters={chapters} onOpen={openChapter} note={note} />
        ) : (
          <Spinner />
        )}
      </div>
    </div>
  );
}
