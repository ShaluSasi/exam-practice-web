import { z } from "zod";
import { Question, type Choice } from "./schema";

/**
 * A change to a question's wording or answer: what a student suggests when
 * reporting a problem, and what an admin approves (worker/reports.ts).
 * Only the text and the answer can change; IDs, images and the question's
 * type stay as they are. An edit is applied over the question with
 * `editedQuestion`, which refuses one that would break it.
 */

const Text = z.string().trim().min(1).max(4000);

export const QuestionEdit = z
  .object({
    prompt: Text.optional(),
    /** An empty hint removes it. */
    hint: z.string().trim().max(4000).optional(),
    explanation: Text.optional(),
    assertion: Text.optional(),
    reason: Text.optional(),
    /** mcq, assertion_reason and hotspot. */
    answer: z.string().min(1).max(100).optional(),
    /** multi. */
    answers: z.array(z.string().min(1).max(100)).min(1).max(30).optional(),
    /** New choice texts by `${list}.${choiceId}`, e.g. "options.b" or "right.c". */
    texts: z.record(z.string().max(200), Text).optional(),
  })
  .strict();
export type QuestionEdit = z.infer<typeof QuestionEdit>;

/** The lists of choices a question may have, and the label each is edited under. */
export const CHOICE_LISTS = { options: "Options", left: "Left column", right: "Right column", items: "Items" } as const;
type ChoiceList = keyof typeof CHOICE_LISTS;
const LISTS = Object.keys(CHOICE_LISTS) as ChoiceList[];

export const choicesOf = (q: Question, list: ChoiceList): Choice[] | undefined => (q as Partial<Record<ChoiceList, Choice[]>>)[list];

/** `q` with `edit` applied, unchecked. Fields that do not belong to the question's type are ignored. */
function applyEdit(q: Question, edit: QuestionEdit): Question {
  const out: Record<string, unknown> = { ...q };
  if (edit.prompt !== undefined) out.prompt = edit.prompt;
  if (edit.explanation !== undefined) out.explanation = edit.explanation;
  if (edit.hint !== undefined) {
    if (edit.hint) out.hint = edit.hint;
    else delete out.hint;
  }
  if (q.type === "assertion_reason") {
    if (edit.assertion !== undefined) out.assertion = edit.assertion;
    if (edit.reason !== undefined) out.reason = edit.reason;
  }
  if (edit.answer !== undefined && (q.type === "mcq" || q.type === "assertion_reason" || q.type === "hotspot")) out.answer = edit.answer;
  if (edit.answers !== undefined && q.type === "multi") out.answers = edit.answers;
  if (edit.texts) {
    for (const list of LISTS) {
      const choices = choicesOf(q, list);
      if (choices) out[list] = choices.map((c) => (edit.texts![`${list}.${c.id}`] === undefined ? c : { ...c, text: edit.texts![`${list}.${c.id}`] }));
    }
  }
  return out as Question;
}

/** `q` with `edit` applied, or null if the result is not a valid question (e.g. an answer that is not an option). */
export function editedQuestion(q: Question, edit: QuestionEdit): Question | null {
  const parsed = Question.safeParse(applyEdit(q, edit));
  return parsed.success ? parsed.data : null;
}

/** `later` made on top of `earlier`: one edit with both. */
export function mergeEdits(earlier: QuestionEdit, later: QuestionEdit): QuestionEdit {
  const texts = earlier.texts || later.texts ? { ...earlier.texts, ...later.texts } : undefined;
  return { ...earlier, ...later, ...(texts ? { texts } : {}) };
}

const sameItems = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x) => b.includes(x));

/** The edit that turns `from` into `to` (same question, changed in an editor). */
export function editBetween(from: Question, to: Question): QuestionEdit {
  const f = from as Record<string, unknown>;
  const t = to as Record<string, unknown>;
  const edit: QuestionEdit = {};
  for (const k of ["prompt", "explanation", "assertion", "reason"] as const) {
    if (typeof t[k] === "string" && t[k] !== f[k]) edit[k] = t[k];
  }
  if ((t.hint ?? "") !== (f.hint ?? "")) edit.hint = (t.hint as string | undefined) ?? "";
  if (typeof t.answer === "string" && t.answer !== f.answer) edit.answer = t.answer;
  if (Array.isArray(t.answers) && !sameItems(t.answers, f.answers)) edit.answers = t.answers as string[];
  const texts: Record<string, string> = {};
  for (const list of LISTS) {
    const before = new Map(choicesOf(from, list)?.map((c) => [c.id, c.text]));
    for (const c of choicesOf(to, list) ?? []) if (before.has(c.id) && before.get(c.id) !== c.text) texts[`${list}.${c.id}`] = c.text;
  }
  if (Object.keys(texts).length) edit.texts = texts;
  return edit;
}

export const isEmptyEdit = (edit: QuestionEdit) => Object.keys(edit).length === 0;
