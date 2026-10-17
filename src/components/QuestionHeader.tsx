import { motion } from "motion/react";
import clsx from "clsx";
import { region } from "../config/regions";
import type { Question } from "../content/schema";
import { SUBJECT_STYLE } from "../lib/subjects";
import { TYPE_LABEL } from "../questions";

const DIFF_DOTS = { easy: 1, medium: 2, hard: 3 } as const;

export function SubjectChip({ subject }: { subject: Question["subject"] }) {
  const s = SUBJECT_STYLE[subject];
  const Icon = s.icon;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", s.soft, s.text)}>
      <Icon className="size-3.5" strokeWidth={2.5} />
      {region.subjects[subject]}
    </span>
  );
}

export function QuestionHeader({ q }: { q: Question }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
      <SubjectChip subject={q.subject} />
      <span className="rounded-full bg-surface-2 px-2.5 py-1">{region.gradeLabel(q.grade)}</span>
      <span className="rounded-full bg-surface-2 px-2.5 py-1">{TYPE_LABEL[q.type]}</span>
      <span className="ml-auto flex items-center gap-3">
        <span className="flex items-center gap-1" title={`Difficulty: ${q.difficulty}`}>
          {[1, 2, 3].map((n) => (
            <motion.span
              key={n}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 + n * 0.06 }}
              className={clsx("h-2.5 w-1.5 rounded-full", n <= DIFF_DOTS[q.difficulty] ? "bg-brand" : "bg-line")}
            />
          ))}
          <span className="ml-1 capitalize">{q.difficulty}</span>
        </span>
        <span>
          {q.marks} {q.marks === 1 ? "mark" : "marks"}
        </span>
      </span>
    </div>
  );
}
