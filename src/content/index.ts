import { QuestionBank, type Question } from "./schema";
import sample from "./data/cbse-sample.json";
import bio9Cell from "./data/cbse-9-biology-cell.json";

/**
 * Validates the bundled question banks at startup so a bad data file fails
 * loudly. Swap the JSON imports for an API call once real data is served.
 */
function load(name: string, data: unknown): Question[] {
  const parsed = QuestionBank.safeParse(data);
  if (!parsed.success) {
    console.error(name, parsed.error.issues);
    throw new Error(`Question bank "${name}" failed validation: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

export const questionBank: Question[] = [
  ...load("cbse-sample", sample),
  ...load("cbse-9-biology-cell", bio9Cell),
];
