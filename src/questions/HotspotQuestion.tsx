import type { MouseEvent } from "react";
import { motion } from "motion/react";
import { Check, X } from "lucide-react";
import clsx from "clsx";
import { Figure } from "../components/Figure";
import { play } from "../lib/sound";
import type { QuestionProps } from "./ChoiceQuestions";

type SpotState = "idle" | "selected" | "correct" | "wrong" | "missed" | "dim";

const SPOT: Record<SpotState, string> = {
  idle: "bg-white text-[#2B2F4A] ring-brand",
  selected: "bg-brand text-brand-ink ring-white scale-125",
  correct: "bg-ok text-white ring-white scale-125",
  wrong: "bg-bad text-white ring-white",
  missed: "bg-ok text-white ring-white scale-110",
  dim: "bg-white/80 text-[#2B2F4A]/60 ring-transparent",
};

const LINE: Record<SpotState, string> = {
  idle: "#2B2F4A",
  selected: "var(--brand)",
  correct: "var(--ok)",
  wrong: "var(--bad)",
  missed: "var(--ok)",
  dim: "#2B2F4A",
};

/** Tap a part of the diagram, or its numbered marker, that matches the prompt. */
export function HotspotQuestion({ q, response, onChange, reveal }: QuestionProps<"hotspot">) {
  const state = (id: string): SpotState => {
    if (!reveal) return response === id ? "selected" : "idle";
    if (id === q.answer) return response === id ? "correct" : "missed";
    return response === id ? "wrong" : "dim";
  };

  const pick = (id: string) => {
    play("tap");
    onChange(id);
  };

  /** A tap off the markers picks the nearest part, so a whole card or organelle can be tapped. */
  const pickNearest = (e: MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const away = (s: { x: number; y: number }) =>
      Math.hypot((s.x / 100) * box.width - (e.clientX - box.left), (s.y / 100) * box.height - (e.clientY - box.top));
    pick(q.spots.reduce((best, s) => (away(s) < away(best) ? s : best)).id);
  };

  return (
    <div>
      <p className="mb-3 text-center text-sm font-semibold text-muted">
        {reveal ? "Every part, labelled" : "Tap the part on the diagram, or its number"}
      </p>
      <Figure media={q.image} zoomable={false} frameClassName="max-w-[620px]">
        {!reveal && <div aria-hidden onClick={pickNearest} className="absolute inset-0 z-[1] cursor-pointer" />}
        <svg aria-hidden className="pointer-events-none absolute inset-0 z-[1] size-full overflow-visible">
          {q.spots.map((s) => {
            if (!s.marker) return null;
            const ends = { x1: `${s.marker.x}%`, y1: `${s.marker.y}%`, x2: `${s.x}%`, y2: `${s.y}%` };
            return (
              <g key={s.id}>
                <line {...ends} stroke="#fff" strokeWidth={3.5} strokeLinecap="round" />
                <line {...ends} stroke={LINE[state(s.id)]} strokeWidth={1.5} strokeLinecap="round" />
                <circle cx={ends.x2} cy={ends.y2} r={3} fill={LINE[state(s.id)]} stroke="#fff" strokeWidth={1} />
              </g>
            );
          })}
        </svg>
        {q.spots.map((s, i) => {
          const st = state(s.id);
          const showLabel = reveal && (st === "correct" || st === "missed" || st === "wrong");
          const at = s.marker ?? s;
          return (
            <div
              key={s.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${at.x}%`, top: `${at.y}%`, zIndex: showLabel ? 3 : 2 }}
            >
              {st === "idle" && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full border-2 border-brand"
                  animate={{ scale: [1, 1.6], opacity: [0.8, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2 }}
                />
              )}
              <motion.button
                type="button"
                disabled={reveal}
                aria-label={reveal ? s.label : `Marker ${i + 1}`}
                aria-pressed={response === s.id}
                onClick={() => pick(s.id)}
                initial={{ scale: 0 }}
                animate={st === "wrong" ? { scale: 1, x: [0, -6, 6, -3, 3, 0] } : { scale: 1 }}
                transition={{ delay: reveal ? 0 : 0.15 + i * 0.06, type: "spring", stiffness: 500, damping: 20 }}
                whileHover={reveal ? undefined : { scale: 1.2 }}
                whileTap={reveal ? undefined : { scale: 0.9 }}
                className={clsx(
                  // Small so it does not hide the diagram; after: keeps a finger-sized tap area.
                  "relative grid size-5 place-items-center rounded-full font-display text-[11px] font-extrabold shadow-pop ring-2 transition-[background-color,color,transform] duration-200 after:absolute after:-inset-2 after:rounded-full sm:size-6 sm:text-xs",
                  SPOT[st],
                )}
              >
                {st === "correct" || st === "missed" ? (
                  <Check className="size-3 sm:size-3.5" strokeWidth={3.5} />
                ) : st === "wrong" ? (
                  <X className="size-3 sm:size-3.5" strokeWidth={3.5} />
                ) : (
                  i + 1
                )}
              </motion.button>
              {showLabel && (
                <motion.span
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={clsx(
                    "absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-bold text-white shadow-pop",
                    st === "wrong" ? "bg-bad" : "bg-ok",
                  )}
                >
                  {s.label}
                </motion.span>
              )}
            </div>
          );
        })}
      </Figure>

      {reveal && (
        <motion.ol
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mx-auto mt-4 flex max-w-[620px] flex-wrap justify-center gap-2"
        >
          {q.spots.map((s, i) => (
            <li
              key={s.id}
              className={clsx(
                "flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-semibold",
                s.id === q.answer ? "border-ok bg-ok-soft text-ok" : "border-line bg-surface text-muted",
              )}
            >
              <span className="font-display font-extrabold">{i + 1}</span> {s.label}
            </li>
          ))}
        </motion.ol>
      )}
    </div>
  );
}
