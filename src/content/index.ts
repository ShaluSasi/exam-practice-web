import { QuestionBank, type Question } from "./schema";

/**
 * Every JSON file in ./data is a question bank (usually one chapter each) and
 * is picked up automatically. Banks are validated at startup so a bad data
 * file fails loudly. Swap this for an API call once real data is served.
 */
const files = import.meta.glob<unknown>("./data/*.json", { eager: true, import: "default" });

function load(name: string, data: unknown): Question[] {
  const parsed = QuestionBank.safeParse(data);
  if (!parsed.success) {
    console.error(name, parsed.error.issues);
    throw new Error(`Question bank "${name}" failed validation: ${parsed.error.issues[0]?.message}`);
  }
  // Product rule: students pick answers, they never type them. Calculations are mcq.
  const typed = parsed.data.filter((q) => q.type === "numeric");
  if (typed.length) {
    throw new Error(`Question bank "${name}" has type-in (numeric) questions; use mcq options instead: ${typed.map((q) => q.id).join(", ")}`);
  }
  return parsed.data;
}

export const questionBank: Question[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([path, data]) => load(path.replace(/^.*\/|\.json$/g, ""), data));
