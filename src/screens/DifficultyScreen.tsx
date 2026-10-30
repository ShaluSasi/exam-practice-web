import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ListChecks, X } from "lucide-react";
import clsx from "clsx";
import type { AdminQuestion, AdminQuestions, Difficulty, DifficultyChanges } from "../content/api";
import type { QuestionType } from "../content/schema";
import {
  AnswerDetails,
  ChapterBrowser,
  DifficultyBar,
  Flags,
  LABEL,
  LEVELS,
  ROUND_WANTS,
  Stat,
  SubmitBar,
  TONE,
  TYPE_LABEL,
  countBy,
  useSubmit,
} from "../components/AdminParts";
import { Button } from "../components/Button";
import { Figure } from "../components/Figure";
import { RichText } from "../components/RichText";
import { ROUND_SIZE } from "../engine/scoring";
import { api } from "../store/auth";

// ---------- One chapter ----------

/** Picks a difficulty; the saved one is outlined when a different one is waiting to be submitted. */
function DifficultyPicker({ value, saved, onChange, big }: { value: Difficulty; saved: Difficulty; onChange: (d: Difficulty) => void; big?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Difficulty" className={clsx("grid grid-cols-3 gap-1.5", big ? "w-full" : "w-full sm:w-auto")}>
      {LEVELS.map((l, i) => (
        <motion.button
          key={l}
          type="button"
          role="radio"
          aria-checked={value === l}
          whileTap={{ scale: 0.94 }}
          onClick={() => onChange(l)}
          className={clsx(
            "relative rounded-xl border-2 font-bold transition-colors",
            big ? "px-1 py-3 font-display text-[15px] sm:px-3 sm:text-base" : "px-3 py-1.5 text-sm",
            value === l ? TONE[l].on : "border-line bg-surface text-muted hover:text-fg",
            value !== saved && saved === l && "border-dashed border-fg/40",
          )}
        >
          {LABEL[l]}
          {big && <span className="ml-1.5 hidden text-xs opacity-60 sm:inline">({i + 1})</span>}
        </motion.button>
      ))}
    </div>
  );
}


function QuestionCard({
  item,
  index,
  value,
  onChange,
}: {
  item: AdminQuestion;
  index: number;
  value: Difficulty;
  onChange: (d: Difficulty) => void;
}) {
  const [open, setOpen] = useState(false);
  const q = item.question;
  const saved = q.difficulty;
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx("rounded-2xl border-2 bg-surface p-4", value !== saved ? "border-brand" : "border-line")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-muted">
            Question {index + 1}
            {value !== saved && (
              <span className="ml-2 normal-case tracking-normal text-brand">
                {LABEL[saved]} → {LABEL[value]} (not submitted)
              </span>
            )}
          </p>
          <p className="mt-1 font-semibold">
            <RichText text={q.prompt} />
          </p>
        </div>
        <DifficultyPicker value={value} saved={saved} onChange={onChange} />
      </div>
      <div className="mt-3">
        <Flags item={item} />
      </div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="mt-3 flex items-center gap-1 text-sm font-bold text-muted hover:text-fg"
      >
        <ChevronDown className={clsx("size-4 transition-transform", open && "rotate-180")} />
        {open ? "Hide answer" : "Show answer & explanation"}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-3">
              {q.image && <Figure media={q.image} className="mb-3" frameClassName="max-w-[360px]" />}
              <AnswerDetails q={q} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/** One question at a time; picking a difficulty (or keys 1–3) moves on to the next. */
function Review({
  items,
  start,
  valueOf,
  onChange,
  onClose,
}: {
  items: AdminQuestion[];
  start: number;
  valueOf: (item: AdminQuestion) => Difficulty;
  onChange: (item: AdminQuestion, d: Difficulty) => void;
  onClose: () => void;
}) {
  const [at, setAt] = useState(Math.min(start, items.length - 1));
  const item = items[at];
  const ref = useRef<HTMLElement>(null);

  // Each question starts at its top, so the difficulty buttons are in view.
  useEffect(() => {
    const top = ref.current?.getBoundingClientRect().top;
    if (top !== undefined && (top < 0 || top > window.innerHeight / 2)) ref.current?.scrollIntoView({ block: "start" });
  }, [at]);
  const next = useCallback(() => setAt((i) => Math.min(items.length - 1, i + 1)), [items.length]);
  const prev = useCallback(() => setAt((i) => Math.max(0, i - 1)), []);
  const pick = useCallback(
    (d: Difficulty) => {
      onChange(item, d);
      window.setTimeout(next, 250);
    },
    [item, onChange, next],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") onClose();
      else if (["1", "2", "3"].includes(e.key)) pick(LEVELS[Number(e.key) - 1]);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next, prev, pick, onClose]);

  if (!item) return null;
  const q = item.question;
  return (
    <section ref={ref} className="scroll-mt-4 rounded-[24px] border-2 border-fg/20 bg-surface p-5 shadow-pop">
      <div className="flex items-center gap-2">
        <p className="flex-1 font-display font-extrabold">
          Question {at + 1} <span className="text-muted">of {items.length}</span>
        </p>
        <button type="button" onClick={onClose} className="flex items-center gap-1 rounded-xl px-2 py-1 text-sm font-bold text-muted hover:bg-surface-2 hover:text-fg">
          <X className="size-4" /> Close
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={prev} disabled={at === 0} aria-label="Previous question" className="grid size-8 place-items-center rounded-lg border-2 border-line text-muted hover:text-fg disabled:opacity-30">
          <ChevronLeft className="size-4" />
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <motion.div className="h-full bg-fg" animate={{ width: `${((at + 1) / items.length) * 100}%` }} />
        </div>
        <button type="button" onClick={next} disabled={at === items.length - 1} aria-label="Next question" className="grid size-8 place-items-center rounded-lg border-2 border-line text-muted hover:text-fg disabled:opacity-30">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}>
          <p className="mt-4 text-lg font-semibold">
            <RichText text={q.prompt} />
          </p>
          <div className="mt-4 rounded-2xl bg-surface-2 p-3">
            <p className="mb-2 text-sm font-bold text-muted">
              How difficult is this question?
              {valueOf(item) !== q.difficulty && <span className="ml-2 text-brand">Saved as {LABEL[q.difficulty]}</span>}
            </p>
            <DifficultyPicker big value={valueOf(item)} saved={q.difficulty} onChange={pick} />
          </div>
          <div className="mt-3">
            <Flags item={item} />
          </div>
          {q.image && <Figure media={q.image} className="mt-3" frameClassName="max-w-[360px]" />}
          <div className="mt-4">
            <AnswerDetails q={q} />
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="mt-5">
        <div className="flex justify-between">
          <Button variant="ghost" className="px-4 py-2 text-sm" onClick={prev} disabled={at === 0}>
            <ChevronLeft className="size-4" /> Previous
          </Button>
          <Button variant="ghost" className="px-4 py-2 text-sm" onClick={next} disabled={at === items.length - 1}>
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}


/** Totals for the chapter, with unsubmitted changes already counted. */
function Summary({ items, valueOf }: { items: AdminQuestion[]; valueOf: (item: AdminQuestion) => Difficulty }) {
  const [topicsOpen, setTopicsOpen] = useState(false);
  const counts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const i of items) counts[valueOf(i)]++;
  const qs = items.map((i) => i.question);
  const types = [...countBy(qs, (q) => q.type)].sort((a, b) => b[1] - a[1]);
  const topics = [...new Set(qs.map((q) => q.topic))].map((t) => {
    const c: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (const i of items) if (i.question.topic === t) c[valueOf(i)]++;
    return { topic: t, counts: c, total: c.easy + c.medium + c.hard };
  });
  const short = LEVELS.filter((l) => counts[l] < ROUND_WANTS[l]);
  const marks = qs.reduce((n, q) => n + q.marks, 0);

  return (
    <section className="mb-5 rounded-[24px] border-2 border-line bg-surface p-5">
      <h2 className="font-display text-lg font-extrabold">Chapter summary</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Questions" value={qs.length} />
        <Stat label="Topics" value={topics.length} />
        <Stat label="Total marks" value={marks} />
        <Stat label="Changed by admins" value={items.filter((i) => i.changedBy).length} />
      </div>

      <h3 className="mt-5 text-sm font-extrabold uppercase tracking-wider text-muted">Difficulty</h3>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {LEVELS.map((l) => (
          <div key={l} className={clsx("rounded-2xl px-3 py-2.5", TONE[l].soft)}>
            <p className="text-xs font-extrabold uppercase tracking-wider">{LABEL[l]}</p>
            <p className="font-display text-2xl font-extrabold">
              {counts[l]} <span className="text-sm opacity-70">({Math.round((counts[l] / (qs.length || 1)) * 100)}%)</span>
            </p>
          </div>
        ))}
      </div>
      <DifficultyBar counts={counts} className="mt-3" />
      <p className="mt-2 text-sm text-muted">
        Each round of {ROUND_SIZE} asks for {ROUND_WANTS.easy} easy, {ROUND_WANTS.medium} moderate and {ROUND_WANTS.hard} hard questions, in that order.
      </p>
      {short.length > 0 && (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Too few {short.map((l) => `${LABEL[l].toLowerCase()} (${counts[l]} of ${ROUND_WANTS[l]})`).join(" and ")}: rounds fill the gap from the nearest level.
        </p>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted">Question types</h3>
          <ul className="mt-2 grid gap-1.5 text-sm">
            {types.map(([t, n]) => (
              <li key={t} className="flex justify-between gap-2">
                <span>{TYPE_LABEL[t as QuestionType]}</span>
                <strong>{n}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted">Flags</h3>
          <ul className="mt-2 grid gap-1.5 text-sm">
            <li className="flex justify-between gap-2"><span>With a hint</span><strong>{qs.filter((q) => q.hint).length}</strong></li>
            <li className="flex justify-between gap-2"><span>With an image</span><strong>{qs.filter((q) => q.image).length}</strong></li>
            <li className="flex justify-between gap-2"><span>Negative marking</span><strong>{qs.filter((q) => q.negativeMarks).length}</strong></li>
            <li className="flex justify-between gap-2"><span>Tagged</span><strong>{qs.filter((q) => q.tags?.length).length}</strong></li>
          </ul>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={topicsOpen}
        onClick={() => setTopicsOpen((o) => !o)}
        className="mt-5 flex items-center gap-1 text-sm font-extrabold uppercase tracking-wider text-muted hover:text-fg"
      >
        <ChevronDown className={clsx("size-4 transition-transform", topicsOpen && "rotate-180")} /> By topic ({topics.length})
      </button>
      <AnimatePresence initial={false}>
        {topicsOpen && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="grid gap-2.5 overflow-hidden pt-2">
            {topics.map((t) => (
              <li key={t.topic}>
                <div className="flex justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-semibold">{t.topic}</span>
                  <span className="shrink-0 text-xs font-bold text-muted">
                    {t.counts.easy} / {t.counts.medium} / {t.counts.hard}
                  </span>
                </div>
                <DifficultyBar counts={t.counts} className="mt-1 h-1.5" />
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}

type Filter = Difficulty | "all" | "changed";

function ChapterView({ data, onSaved }: { data: AdminQuestions; onSaved: () => Promise<void> }) {
  const [pending, setPending] = useState<Map<string, Difficulty>>(new Map());
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  /**
   * The questions being reviewed, fixed when the review opens: with a difficulty filter on, picking another
   * difficulty would drop the question from `shown`, shifting the rest up so the move to the next one skipped a question.
   */
  const [review, setReview] = useState<string[] | null>(null);
  const { saving, message, setMessage, submit } = useSubmit(pending.size, async () => {
    const body: DifficultyChanges = { changes: [...pending].map(([id, difficulty]) => ({ id, difficulty })) };
    const { saved } = await api<{ saved: number }>("/api/admin/difficulty", body);
    await onSaved();
    setPending(new Map());
    return `Saved ${saved} change${saved === 1 ? "" : "s"}. Students get the new difficulty in their next round.`;
  });

  const valueOf = useCallback((i: AdminQuestion) => pending.get(i.question.id) ?? i.question.difficulty, [pending]);
  const change = useCallback((i: AdminQuestion, d: Difficulty) => {
    setMessage(null);
    setPending((p) => {
      const next = new Map(p);
      if (d === i.question.difficulty) next.delete(i.question.id);
      else next.set(i.question.id, d);
      return next;
    });
  }, []);

  const shown = useMemo(() => {
    const words = search.trim().toLowerCase();
    return data.questions.filter((i) => {
      if (filter === "changed" ? !(i.changedBy || pending.has(i.question.id)) : filter !== "all" && valueOf(i) !== filter) return false;
      return !words || `${i.question.prompt} ${i.question.topic} ${i.question.id}`.toLowerCase().includes(words);
    });
  }, [data.questions, filter, search, pending, valueOf]);

  const reviewItems = useMemo(() => {
    if (!review) return [];
    const byId = new Map(data.questions.map((i) => [i.question.id, i]));
    return review.flatMap((id) => byId.get(id) ?? []);
  }, [review, data.questions]);

  const filterCount = (f: Filter) =>
    f === "all" ? data.questions.length : f === "changed" ? data.questions.filter((i) => i.changedBy || pending.has(i.question.id)).length : data.questions.filter((i) => valueOf(i) === f).length;

  return (
    <>
      <Summary items={data.questions} valueOf={valueOf} />

      {review !== null && reviewItems.length > 0 ? (
        <Review items={reviewItems} start={0} valueOf={valueOf} onChange={change} onClose={() => setReview(null)} />
      ) : (
        <>
          <div className="sticky top-0 z-20 -mx-4 mb-3 bg-bg/90 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              {(["all", ...LEVELS, "changed"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={clsx(
                    "rounded-full border-2 px-3 py-1 text-sm font-bold transition-colors",
                    filter === f ? "border-fg bg-fg text-bg" : "border-line bg-surface text-muted hover:text-fg",
                  )}
                >
                  {f === "all" ? "All" : f === "changed" ? "Changed" : LABEL[f]} <span className="opacity-60">{filterCount(f)}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions, topics or IDs"
                className="min-w-0 flex-1 rounded-xl border-2 border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-fg/40"
              />
              <Button variant="dark" className="shrink-0 px-4 py-2 text-sm" disabled={shown.length === 0} onClick={() => setReview(shown.map((i) => i.question.id))}>
                <ListChecks className="size-4" /> Review one by one
              </Button>
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="py-10 text-center font-semibold text-muted">No questions match.</p>
          ) : (
            <ul className="grid gap-3">
              {shown.map((i) => (
                <QuestionCard
                  key={i.question.id}
                  item={i}
                  index={data.questions.indexOf(i)}
                  value={valueOf(i)}
                  onChange={(d) => change(i, d)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <SubmitBar count={pending.size} saving={saving} message={message} onDiscard={() => setPending(new Map())} onSubmit={() => void submit()} />
    </>
  );
}

/** Admin page: every chapter's difficulty mix, and changing the difficulty of its questions. */
export function DifficultyScreen() {
  return <ChapterBrowser title="Question difficulty">{(data, reload) => <ChapterView data={data} onSaved={reload} />}</ChapterBrowser>;
}
