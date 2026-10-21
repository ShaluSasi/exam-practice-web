import { Reorder, motion, useDragControls } from "motion/react";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";
import clsx from "clsx";
import type { Choice } from "../content/schema";
import { RichText } from "../components/RichText";
import { play } from "../lib/sound";
import type { QuestionProps } from "./ChoiceQuestions";

function OrderItem({
  item,
  index,
  total,
  state,
  onMove,
}: {
  item: Choice;
  index: number;
  total: number;
  state: "idle" | "correct" | "wrong";
  onMove: (dir: -1 | 1) => void;
}) {
  const controls = useDragControls();
  const locked = state !== "idle";
  return (
    <Reorder.Item
      value={item.id}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.03, boxShadow: "0 18px 40px -16px rgb(0 0 0 / 0.35)", zIndex: 10 }}
      animate={state === "wrong" ? { x: [0, -8, 8, -4, 4, 0] } : undefined}
      transition={{ duration: 0.4 }}
      style={{ position: "relative" }}
      className={clsx(
        "flex items-center gap-3 rounded-2xl border-2 bg-surface py-2.5 pl-2 pr-3 text-[16px]",
        state === "idle" && "border-line",
        state === "correct" && "border-ok bg-ok-soft",
        state === "wrong" && "border-bad bg-bad-soft",
      )}
    >
      <button
        type="button"
        aria-label={`Drag ${item.text}`}
        disabled={locked}
        onPointerDown={(e) => !locked && controls.start(e)}
        className="grid h-10 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted hover:bg-surface-2 active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
      >
        <GripVertical className="size-5" />
      </button>
      <span
        className={clsx(
          "grid size-7 shrink-0 place-items-center rounded-full font-display text-sm font-bold",
          state === "idle" && "bg-fg text-bg",
          state === "correct" && "bg-ok text-white",
          state === "wrong" && "bg-bad text-white",
        )}
      >
        {state === "correct" ? <Check className="size-4" strokeWidth={3} /> : state === "wrong" ? <X className="size-4" strokeWidth={3} /> : index + 1}
      </span>
      {item.image && (
        <img
          src={item.image.src}
          alt={item.image.alt}
          draggable={false}
          className="size-11 shrink-0 select-none rounded-xl sm:size-14"
        />
      )}
      <RichText text={item.text} className="min-w-0 flex-1 font-semibold" />
      {!locked && (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-25"
          >
            <ChevronUp className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-25"
          >
            <ChevronDown className="size-5" />
          </button>
        </div>
      )}
    </Reorder.Item>
  );
}

function EndLabel({ icon: Icon, text }: { icon: typeof ArrowUp; text: string }) {
  return (
    <div className="flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-wider text-muted">
      <Icon className="size-3.5" /> {text}
    </div>
  );
}

export function OrderQuestion({ q, response, onChange, reveal }: QuestionProps<"order">) {
  const order = response ?? q.items.map((i) => i.id);
  const byId = Object.fromEntries(q.items.map((i) => [i.id, i]));
  // The correct order arrives from the server once checked.
  const answer = q.answer ?? [];
  const allRight = order.every((id, i) => answer[i] === id);

  const move = (i: number, dir: -1 | 1) => {
    const next = [...order];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    play("tap");
    onChange(next);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
      <p className="mb-3 text-sm font-semibold text-muted">Drag the handles, or use the arrows</p>
      <div className="grid gap-2">
        {q.startLabel && <EndLabel icon={ArrowUp} text={q.startLabel} />}
        <Reorder.Group axis="y" values={order} onReorder={(v) => !reveal && onChange(v)} className="grid gap-2.5">
          {order.map((id, i) => (
            <OrderItem
              key={id}
              item={byId[id]}
              index={i}
              total={order.length}
              state={!reveal ? "idle" : answer[i] === id ? "correct" : "wrong"}
              onMove={(dir) => move(i, dir)}
            />
          ))}
        </Reorder.Group>
        {q.endLabel && <EndLabel icon={ArrowDown} text={q.endLabel} />}
      </div>
      {reveal && !allRight && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-ok"
        >
          Correct order:
          {answer.map((id, i) => (
            <span key={id} className="flex items-center gap-2">
              <span className="rounded-lg bg-ok-soft px-2 py-1">
                <RichText text={byId[id].text} />
              </span>
              {i < answer.length - 1 && "→"}
            </span>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
