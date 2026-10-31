import { useId } from "react";
import clsx from "clsx";
import { region } from "../config/regions";
import { CHOICE_LISTS, choicesOf } from "../content/edit";
import type { Question } from "../content/schema";

/*
 * Edits a question's wording and answer (src/content/edit.ts): used by a
 * student suggesting a fix (ReportSheet) and by an admin modifying one
 * (ReportsScreen). IDs, images and the question type cannot change here.
 */

const field = "w-full rounded-xl border-2 border-line bg-bg px-3 py-2 text-[15px] leading-snug outline-none focus:border-brand";

function TextArea({ label, value, onChange, optional }: { label: string; value: string; onChange: (v: string) => void; optional?: boolean }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-muted">
        {label}
        {optional && <span className="font-semibold normal-case tracking-normal"> (optional)</span>}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(8, Math.max(2, Math.ceil(value.length / 60)))}
        className={clsx(field, "resize-y", !optional && !value.trim() && "border-bad")}
      />
    </div>
  );
}

/** One choice's text, with a radio or checkbox to mark it correct where the type allows. */
function ChoiceRow({
  text,
  onText,
  mark,
}: {
  text: string;
  onText: (v: string) => void;
  mark?: { kind: "radio" | "checkbox"; name: string; checked: boolean; onChange: () => void; label: string };
}) {
  return (
    <li className="flex items-center gap-2">
      {mark && (
        <input
          type={mark.kind}
          name={mark.name}
          checked={mark.checked}
          onChange={mark.onChange}
          aria-label={mark.label}
          className="size-5 shrink-0 accent-ok"
        />
      )}
      <input
        type="text"
        value={text}
        onChange={(e) => onText(e.target.value)}
        aria-label="Choice text"
        className={clsx(field, "py-1.5", mark?.checked && "border-ok bg-ok-soft", !text.trim() && "border-bad")}
      />
    </li>
  );
}

export function QuestionEditor({ value, onChange }: { value: Question; onChange: (q: Question) => void }) {
  const name = useId();
  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch } as Question);

  const lists = (Object.keys(CHOICE_LISTS) as (keyof typeof CHOICE_LISTS)[]).flatMap((list) => {
    const choices = choicesOf(value, list);
    return choices ? [{ list, choices }] : [];
  });

  return (
    <div className="grid gap-4">
      <TextArea label="Question" value={value.prompt} onChange={(prompt) => set({ prompt })} />

      {value.type === "assertion_reason" && (
        <>
          <TextArea label="Assertion" value={value.assertion} onChange={(assertion) => set({ assertion })} />
          <TextArea label="Reason" value={value.reason} onChange={(reason) => set({ reason })} />
          <fieldset>
            <legend className="mb-1 text-xs font-extrabold uppercase tracking-wider text-muted">Correct answer</legend>
            <ul className="grid gap-1.5">
              {region.assertionReasonOptions.map((o) => (
                <li key={o.id}>
                  <label className={clsx("flex cursor-pointer items-start gap-2 rounded-xl border-2 px-3 py-2 text-sm", value.answer === o.id ? "border-ok bg-ok-soft font-semibold" : "border-line")}>
                    <input type="radio" name={name} checked={value.answer === o.id} onChange={() => set({ answer: o.id })} className="mt-0.5 size-4 shrink-0 accent-ok" />
                    {o.text}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </>
      )}

      {lists.map(({ list, choices }) => (
        <fieldset key={list}>
          <legend className="mb-1 text-xs font-extrabold uppercase tracking-wider text-muted">
            {CHOICE_LISTS[list]}
            {value.type === "mcq" && " · tick the correct one"}
            {value.type === "multi" && " · tick every correct one"}
          </legend>
          <ul className="grid gap-1.5">
            {choices.map((c) => (
              <ChoiceRow
                key={c.id}
                text={c.text}
                onText={(text) => set({ [list]: choices.map((x) => (x.id === c.id ? { ...x, text } : x)) })}
                mark={
                  value.type === "mcq"
                    ? { kind: "radio", name, checked: value.answer === c.id, onChange: () => set({ answer: c.id }), label: "Correct answer" }
                    : value.type === "multi"
                      ? {
                          kind: "checkbox",
                          name,
                          checked: value.answers.includes(c.id),
                          onChange: () =>
                            set({ answers: value.answers.includes(c.id) ? value.answers.filter((a) => a !== c.id) : [...value.answers, c.id] }),
                          label: "Correct answer",
                        }
                      : undefined
                }
              />
            ))}
          </ul>
        </fieldset>
      ))}

      {(value.type === "match" || value.type === "order") && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
          The {value.type === "match" ? "pairs" : "correct order"} can't be changed here. If they are wrong, describe the right {value.type === "match" ? "pairs" : "order"} in the remark.
        </p>
      )}

      {value.type === "hotspot" && (
        <fieldset>
          <legend className="mb-1 text-xs font-extrabold uppercase tracking-wider text-muted">Correct part of the picture</legend>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {value.spots.map((s) => (
              <li key={s.id}>
                <label className={clsx("flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm", value.answer === s.id ? "border-ok bg-ok-soft font-semibold" : "border-line")}>
                  <input type="radio" name={name} checked={value.answer === s.id} onChange={() => set({ answer: s.id })} className="size-4 shrink-0 accent-ok" />
                  {s.label}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <TextArea label="Hint" optional value={value.hint ?? ""} onChange={(hint) => set({ hint })} />
      <TextArea label="Explanation" value={value.explanation} onChange={(explanation) => set({ explanation })} />
    </div>
  );
}
