import { motion } from "motion/react";
import { region } from "../config/regions";
import type { QuestionOf, ResponseFor } from "../content/schema";
import { RichText } from "../components/RichText";
import { play } from "../lib/sound";
import { OptionCard, type OptionState } from "./OptionCard";

export interface QuestionProps<T extends "mcq" | "multi" | "numeric" | "assertion_reason" | "match" | "order"> {
  q: QuestionOf<T>;
  response: ResponseFor<T> | undefined;
  onChange: (r: ResponseFor<T>) => void;
  reveal: boolean;
}

function singleState(id: string, answer: string, picked: string | undefined, reveal: boolean): OptionState {
  if (!reveal) return picked === id ? "selected" : "idle";
  if (id === answer) return picked === id ? "correct" : "missed";
  return picked === id ? "wrong" : "dim";
}

export function McqQuestion({ q, response, onChange, reveal }: QuestionProps<"mcq">) {
  return (
    <ul className="grid gap-3" role="radiogroup">
      {q.options.map((o, i) => (
        <OptionCard
          key={o.id}
          index={i}
          text={o.text}
          state={singleState(o.id, q.answer, response, reveal)}
          disabled={reveal}
          onClick={() => {
            play("tap");
            onChange(o.id);
          }}
        />
      ))}
    </ul>
  );
}

export function MultiQuestion({ q, response = [], onChange, reveal }: QuestionProps<"multi">) {
  const state = (id: string): OptionState => {
    const picked = response.includes(id);
    const right = q.answers.includes(id);
    if (!reveal) return picked ? "selected" : "idle";
    if (right) return picked ? "correct" : "missed";
    return picked ? "wrong" : "dim";
  };
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-muted">Select all that apply</p>
      <ul className="grid gap-3">
        {q.options.map((o, i) => (
          <OptionCard
            key={o.id}
            index={i}
            multi
            text={o.text}
            state={state(o.id)}
            disabled={reveal}
            onClick={() => {
              play("tap");
              onChange(response.includes(o.id) ? response.filter((x) => x !== o.id) : [...response, o.id]);
            }}
          />
        ))}
      </ul>
    </div>
  );
}

function Statement({ tag, text, delay }: { tag: string; text: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex gap-3 rounded-2xl bg-surface-2 p-4"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-fg font-display text-sm font-bold text-bg">
        {tag}
      </span>
      <RichText text={text} className="pt-1 leading-relaxed" />
    </motion.div>
  );
}

export function AssertionReasonQuestion({ q, response, onChange, reveal }: QuestionProps<"assertion_reason">) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-2.5">
        <Statement tag="A" text={q.assertion} delay={0.05} />
        <Statement tag="R" text={q.reason} delay={0.12} />
      </div>
      <ul className="grid gap-3" role="radiogroup">
        {region.assertionReasonOptions.map((o, i) => (
          <OptionCard
            key={o.id}
            index={i}
            text={o.text}
            state={singleState(o.id, q.answer, response, reveal)}
            disabled={reveal}
            onClick={() => {
              play("tap");
              onChange(o.id);
            }}
          />
        ))}
      </ul>
    </div>
  );
}
