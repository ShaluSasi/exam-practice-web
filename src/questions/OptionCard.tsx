import { motion } from "motion/react";
import { Check, X } from "lucide-react";
import clsx from "clsx";
import { RichText } from "../components/RichText";

export type OptionState = "idle" | "selected" | "correct" | "wrong" | "missed" | "dim";

const CARD: Record<OptionState, string> = {
  idle: "border-line bg-surface hover:border-fg/25 hover:-translate-y-0.5",
  selected: "border-brand bg-brand-soft shadow-[0_3px_0_0_var(--brand)]",
  correct: "border-ok bg-ok-soft shadow-[0_3px_0_0_var(--ok)]",
  wrong: "border-bad bg-bad-soft shadow-[0_3px_0_0_var(--bad)]",
  missed: "border-ok border-dashed bg-surface",
  dim: "border-line bg-surface opacity-50",
};

const BADGE: Record<OptionState, string> = {
  idle: "bg-surface-2 text-muted",
  selected: "bg-brand text-brand-ink",
  correct: "bg-ok text-white",
  wrong: "bg-bad text-white",
  missed: "bg-ok-soft text-ok",
  dim: "bg-surface-2 text-muted",
};

const FEEDBACK_ANIM = {
  wrong: { x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.45 } },
  correct: { scale: [1, 1.035, 1], transition: { duration: 0.4 } },
};

export function OptionCard({
  index,
  text,
  state,
  multi,
  disabled,
  onClick,
}: {
  index: number;
  text: string;
  state: OptionState;
  multi?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const letter = String.fromCharCode(65 + index);
  const icon =
    state === "correct" || state === "missed" ? <Check className="size-4" strokeWidth={3} /> :
    state === "wrong" ? <X className="size-4" strokeWidth={3} /> :
    multi && state === "selected" ? <Check className="size-4" strokeWidth={3} /> : letter;

  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.05, type: "spring", stiffness: 400, damping: 30 }}
    >
      <motion.button
        type="button"
        role={multi ? "checkbox" : "radio"}
        aria-checked={state === "selected" || state === "correct" || state === "wrong"}
        disabled={disabled}
        onClick={onClick}
        animate={state === "wrong" || state === "correct" ? FEEDBACK_ANIM[state] : undefined}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        className={clsx(
          "flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-3.5 text-left text-[16px] leading-snug transition-[border-color,background-color,box-shadow,transform,opacity] duration-200 sm:px-5 sm:py-4",
          CARD[state],
          disabled && "cursor-default hover:translate-y-0",
        )}
      >
        <span
          className={clsx(
            "grid size-8 shrink-0 place-items-center font-display text-sm font-bold transition-colors",
            multi ? "rounded-lg" : "rounded-full",
            BADGE[state],
          )}
        >
          {icon}
        </span>
        <RichText text={text} className="min-w-0 flex-1" />
        {state === "missed" && <span className="shrink-0 text-xs font-semibold text-ok">Correct answer</span>}
      </motion.button>
    </motion.li>
  );
}
