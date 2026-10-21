import { motion } from "motion/react";
import clsx from "clsx";
import type { QuestionProps } from "./ChoiceQuestions";

export function NumericQuestion({ q, response = "", onChange, reveal }: QuestionProps<"numeric">) {
  const correct = reveal && q.answer !== undefined && Math.abs(Number(response) - q.answer) <= (q.tolerance ?? 0) + 1e-9;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <label htmlFor={`num-${q.id}`} className="mb-2 block text-sm font-semibold text-muted">
        Your answer
      </label>
      <motion.div
        animate={reveal ? (correct ? { scale: [1, 1.03, 1] } : { x: [0, -10, 10, -6, 6, 0] }) : undefined}
        transition={{ duration: 0.45 }}
        className={clsx(
          "flex items-center gap-3 rounded-2xl border-2 px-5 transition-colors focus-within:border-brand focus-within:shadow-[0_3px_0_0_var(--brand)]",
          !reveal && "border-line bg-surface",
          reveal && correct && "border-ok bg-ok-soft shadow-[0_3px_0_0_var(--ok)]",
          reveal && !correct && "border-bad bg-bad-soft shadow-[0_3px_0_0_var(--bad)]",
        )}
      >
        <input
          id={`num-${q.id}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          value={response}
          disabled={reveal}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.\-]/g, ""))}
          placeholder="0"
          className="min-w-0 flex-1 bg-transparent py-4 font-display text-4xl font-bold tabular-nums outline-none placeholder:text-muted/40 focus-visible:outline-none"
        />
        {q.unit && <span className="font-display text-xl font-semibold text-muted">{q.unit}</span>}
      </motion.div>
      {reveal && !correct && (
        <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 font-semibold text-ok">
          Correct answer: <span className="font-display text-lg">{q.answer}</span> {q.unit}
        </motion.p>
      )}
    </motion.div>
  );
}
