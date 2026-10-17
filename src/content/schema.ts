import { z } from "zod";

/**
 * Question content schema.
 *
 * Text fields are "rich text": plain text with inline maths in $...$,
 * display maths in $$...$$ (KaTeX), and chemistry via \ce{...} inside maths.
 * Real data must pass this schema — it is validated when loaded.
 */

export const SubjectId = z.enum(["maths", "physics", "chemistry", "biology"]);
export type SubjectId = z.infer<typeof SubjectId>;

/** A point on an image, in percent of its width/height. */
const Point = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

/** An illustration (SVG/PNG/GIF). Paths are relative to the site root. */
const Media = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().optional(),
  /** Numbered badges drawn over the image, e.g. for "label the diagram". */
  markers: z.array(Point.extend({ label: z.string().min(1) })).optional(),
});
export type Media = z.infer<typeof Media>;

const Choice = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  image: Media.optional(),
});
export type Choice = z.infer<typeof Choice>;

const Base = z.object({
  id: z.string().min(1),
  region: z.enum(["IN", "US", "UK"]),
  board: z.string().min(1), // "CBSE", "ICSE", "AP", "AQA", ...
  grade: z.number().int().min(1).max(13),
  subject: SubjectId,
  chapter: z.string().min(1),
  /** Position of the chapter in the subject's course, for ordering quizzes. */
  chapterNo: z.number().int().positive().optional(),
  topic: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  marks: z.number().positive(),
  negativeMarks: z.number().min(0).optional(),
  prompt: z.string().min(1),
  image: Media.optional(),
  hint: z.string().optional(),
  explanation: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

const Mcq = Base.extend({
  type: z.literal("mcq"),
  options: z.array(Choice).min(2),
  answer: z.string(),
});

const Multi = Base.extend({
  type: z.literal("multi"),
  options: z.array(Choice).min(2),
  answers: z.array(z.string()).min(1),
});

const Numeric = Base.extend({
  type: z.literal("numeric"),
  answer: z.number(),
  tolerance: z.number().min(0).optional(),
  unit: z.string().optional(),
});

const AssertionReason = Base.extend({
  type: z.literal("assertion_reason"),
  assertion: z.string().min(1),
  reason: z.string().min(1),
  /** Index into the region's standard assertion–reason options. */
  answer: z.enum(["a", "b", "c", "d"]),
});

const Match = Base.extend({
  type: z.literal("match"),
  left: z.array(Choice).min(2),
  right: z.array(Choice).min(2),
  /** leftId -> rightId */
  pairs: z.record(z.string(), z.string()),
});

const Order = Base.extend({
  type: z.literal("order"),
  items: z.array(Choice).min(2),
  /** Item ids in the correct order. */
  answer: z.array(z.string()).min(2),
  startLabel: z.string().optional(),
  endLabel: z.string().optional(),
});

/** Tap the right part of a diagram. */
const Hotspot = Base.extend({
  type: z.literal("hotspot"),
  image: Media,
  spots: z.array(Point.extend({ id: z.string().min(1), label: z.string().min(1) })).min(2),
  answer: z.string(),
});

export const Question = z
  .discriminatedUnion("type", [Mcq, Multi, Numeric, AssertionReason, Match, Order, Hotspot])
  .superRefine((q, ctx) => {
    const ids = (cs: Choice[]) => new Set(cs.map((c) => c.id));
    const bad = (message: string) => ctx.addIssue({ code: "custom", message: `${q.id}: ${message}` });
    switch (q.type) {
      case "mcq":
        if (!ids(q.options).has(q.answer)) bad("answer is not an option id");
        break;
      case "multi":
        if (!q.answers.every((a) => ids(q.options).has(a))) bad("answers contain unknown option ids");
        break;
      case "match": {
        const l = ids(q.left), r = ids(q.right);
        if (!Object.entries(q.pairs).every(([a, b]) => l.has(a) && r.has(b))) bad("pairs reference unknown ids");
        if (Object.keys(q.pairs).length !== q.left.length) bad("every left item needs a pair");
        break;
      }
      case "order":
        if (q.answer.length !== q.items.length || !q.answer.every((a) => ids(q.items).has(a)))
          bad("answer must list every item id exactly once");
        break;
      case "hotspot":
        if (!q.spots.some((s) => s.id === q.answer)) bad("answer is not a spot id");
        break;
    }
  });

export type Question = z.infer<typeof Question>;
export type QuestionType = Question["type"];
export type QuestionOf<T extends QuestionType> = Extract<Question, { type: T }>;

export const QuestionBank = z.array(Question);

/** What a student has entered for each question type. */
export type ResponseFor<T extends QuestionType> = {
  mcq: string;
  multi: string[];
  numeric: string;
  assertion_reason: string;
  match: Record<string, string>;
  order: string[];
  hotspot: string;
}[T];
export type AnyResponse = ResponseFor<QuestionType>;
