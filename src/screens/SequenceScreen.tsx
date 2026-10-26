import { useMemo, useState } from "react";
import { AnimatePresence, Reorder, motion, useDragControls } from "motion/react";
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, ChevronDown, GripVertical, ListOrdered, RotateCcw } from "lucide-react";
import clsx from "clsx";
import type { AdminQuestion, AdminQuestions, ChapterOrderIn } from "../content/api";
import { AnswerDetails, ChapterBrowser, Chip, Flags, LABEL, LEVELS, ROUND_WANTS, SubmitBar, TONE, TYPE_LABEL, formatDate, useSubmit } from "../components/AdminParts";
import { Button } from "../components/Button";
import { Figure } from "../components/Figure";
import { RichText } from "../components/RichText";
import { ROUND_SIZE } from "../engine/scoring";
import { api } from "../store/auth";

/** The order rounds use when no admin has set one: easiest first, bank order within a level. */
const defaultOrder = (items: readonly AdminQuestion[]) =>
  [...items].sort((a, b) => LEVELS.indexOf(a.question.difficulty) - LEVELS.indexOf(b.question.difficulty));

/** `items` in the saved order; any it does not list (added since) go last. */
function savedOrder(data: AdminQuestions): AdminQuestion[] {
  if (!data.order) return defaultOrder(data.questions);
  const at = new Map(data.order.ids.map((id, i) => [id, i]));
  const end = data.order.ids.length;
  return [...data.questions].sort((a, b) => (at.get(a.question.id) ?? end) - (at.get(b.question.id) ?? end));
}

const sameOrder = (a: readonly AdminQuestion[], b: readonly AdminQuestion[]) => a.every((q, i) => q.question.id === b[i]?.question.id);

/** One question in the list: dragged by its handle, so the list still scrolls on a phone. */
function Row({
  item,
  position,
  was,
  last,
  onMove,
}: {
  item: AdminQuestion;
  position: number;
  /** Its position before the unsubmitted changes, when different. */
  was: number | null;
  last: number;
  onMove: (to: number) => void;
}) {
  const controls = useDragControls();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const q = item.question;
  const moveTo = () => {
    const to = Number(target);
    if (Number.isInteger(to) && to >= 1 && to <= last + 1) onMove(to - 1);
    setTarget("");
  };

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.02, boxShadow: "0 12px 30px rgb(0 0 0 / 0.18)", zIndex: 10 }}
      className={clsx("relative rounded-2xl border-2 bg-surface", was !== null ? "border-brand" : "border-line")}
    >
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          aria-label={`Drag question ${position + 1}`}
          onPointerDown={(e) => controls.start(e)}
          className="flex w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-2xl text-muted hover:bg-surface-2 hover:text-fg active:cursor-grabbing sm:w-10"
        >
          <GripVertical className="size-5" />
        </button>
        <div className="min-w-0 flex-1 py-3 pr-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-display text-lg font-extrabold leading-none">{position + 1}</span>
            {was !== null && <span className="text-xs font-bold text-brand">was {was + 1}</span>}
            <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide", TONE[q.difficulty].soft)}>
              {LABEL[q.difficulty]}
            </span>
            <Chip className="py-0.5 text-[11px]">{TYPE_LABEL[q.type]}</Chip>
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm font-semibold">
            <RichText text={q.prompt} />
          </p>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="mt-1.5 flex items-center gap-1 text-xs font-bold text-muted hover:text-fg"
          >
            <ChevronDown className={clsx("size-3.5 transition-transform", open && "rotate-180")} />
            {open ? "Less" : "Details & move"}
          </button>
        </div>
        <div className="flex shrink-0 flex-col justify-center gap-1 py-2 pr-2">
          <button
            type="button"
            aria-label="Move up"
            disabled={position === 0}
            onClick={() => onMove(position - 1)}
            className="grid size-8 place-items-center rounded-lg border-2 border-line text-muted hover:text-fg disabled:opacity-30"
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={position === last}
            onClick={() => onMove(position + 1)}
            className="grid size-8 place-items-center rounded-lg border-2 border-line text-muted hover:text-fg disabled:opacity-30"
          >
            <ArrowDown className="size-4" />
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-3 border-t-2 border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" className="px-3 py-1.5 text-sm" disabled={position === 0} onClick={() => onMove(0)}>
                  <ArrowUpToLine className="size-4" /> To the top
                </Button>
                <Button variant="ghost" className="px-3 py-1.5 text-sm" disabled={position === last} onClick={() => onMove(last)}>
                  <ArrowDownToLine className="size-4" /> To the bottom
                </Button>
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    moveTo();
                  }}
                >
                  <label className="text-sm font-bold text-muted" htmlFor={`to-${q.id}`}>
                    Move to
                  </label>
                  <input
                    id={`to-${q.id}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={last + 1}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="#"
                    className="w-16 rounded-xl border-2 border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-fg/40"
                  />
                  <Button variant="dark" type="submit" className="px-3 py-1.5 text-sm" disabled={!target}>
                    Go
                  </Button>
                </form>
              </div>
              <Flags item={item} />
              {q.image && <Figure media={q.image} frameClassName="max-w-[320px]" />}
              <AnswerDetails q={q} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

/** Each question's difficulty, in sequence: shows at a glance how the chapter ramps up. */
function Strip({ items }: { items: readonly AdminQuestion[] }) {
  return (
    <div className="flex h-5 gap-px overflow-hidden rounded-lg" aria-hidden>
      {items.map((i) => (
        <motion.div layout key={i.question.id} className={clsx("min-w-0 flex-1", TONE[i.question.difficulty].bar)} />
      ))}
    </div>
  );
}

function ChapterSequence({ data, onSaved }: { data: AdminQuestions; onSaved: () => Promise<void> }) {
  const saved = useMemo(() => savedOrder(data), [data]);
  const [seq, setSeq] = useState(saved);
  // Once a new order is saved (or reset), the list starts again from it.
  const [base, setBase] = useState(saved);
  if (base !== saved) {
    setBase(saved);
    setSeq(saved);
  }
  const [resetting, setResetting] = useState(false);
  const savedAt = useMemo(() => new Map(saved.map((q, i) => [q.question.id, i])), [saved]);
  const moved = seq.filter((q, i) => savedAt.get(q.question.id) !== i).length;

  const { saving, message, setMessage, submit } = useSubmit(moved, async () => {
    const body: ChapterOrderIn = { chapter: data.chapter.key, ids: seq.map((q) => q.question.id) };
    await api("/api/admin/order", body);
    await onSaved();
    return `Saved the new order. Students see it from their next round.`;
  });

  const move = (from: number, to: number) => {
    setMessage(null);
    setSeq((s) => {
      const next = [...s];
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    });
  };

  const backToDefault = async () => {
    if (!window.confirm("Go back to the default order (easy, then moderate, then hard)?")) return;
    setResetting(true);
    try {
      await api("/api/admin/order", { chapter: data.chapter.key, ids: null } satisfies ChapterOrderIn);
      await onSaved();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not reset the order." });
    } finally {
      setResetting(false);
    }
  };

  const byDifficulty = defaultOrder(seq);
  return (
    <>
      <section className="mb-5 rounded-[24px] border-2 border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold">Question sequence</h2>
            <p className="mt-0.5 text-sm text-muted">
              {data.order
                ? `Custom order, set by ${data.order.updatedBy} on ${formatDate(data.order.updatedAt)}.`
                : "Default order: easy, then moderate, then hard."}
            </p>
          </div>
          {data.order && (
            <Button variant="ghost" className="px-3 py-1.5 text-sm" disabled={resetting || saving} onClick={() => void backToDefault()}>
              <RotateCcw className="size-4" /> Back to default
            </Button>
          )}
        </div>
        <div className="mt-4">
          <Strip items={seq} />
          <div className="mt-1 flex justify-between text-xs font-bold text-muted">
            <span>First</span>
            <span>Last</span>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          Each round picks {ROUND_SIZE} of these {seq.length} questions at random ({ROUND_WANTS.easy} easy, {ROUND_WANTS.medium} moderate, {ROUND_WANTS.hard} hard) and asks them in this order.
          Drag a question by its handle, or use the arrows.
        </p>
        {!sameOrder(seq, byDifficulty) && (
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setSeq(byDifficulty);
            }}
            className="mt-3 flex items-center gap-1.5 text-sm font-bold text-muted underline-offset-4 hover:text-fg hover:underline"
          >
            <ListOrdered className="size-4" /> Sort easy → hard
          </button>
        )}
      </section>

      <Reorder.Group axis="y" values={seq} onReorder={(s) => {
          setMessage(null);
          setSeq(s);
        }} className="grid gap-2.5">
        {seq.map((item, i) => {
          const was = savedAt.get(item.question.id) ?? null;
          return (
            <Row
              key={item.question.id}
              item={item}
              position={i}
              was={was !== i ? was : null}
              last={seq.length - 1}
              onMove={(to) => move(i, to)}
            />
          );
        })}
      </Reorder.Group>

      <SubmitBar count={moved} label="New order" saving={saving} message={message} onDiscard={() => setSeq(saved)} onSubmit={() => void submit()} />
    </>
  );
}

/** Admin page: the order each chapter's questions are shown in, changed by drag and drop. */
export function SequenceScreen() {
  return (
    <ChapterBrowser title="Question sequence" note={(c) => c.ordered && <span className="text-brand">custom order</span>}>
      {(data, reload) => <ChapterSequence data={data} onSaved={reload} />}
    </ChapterBrowser>
  );
}
