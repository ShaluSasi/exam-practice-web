import { QuestionBank, type Question } from "./schema";
import sample from "./data/cbse-sample.json";

/**
 * Validates the bundled question bank at startup so a bad data file fails
 * loudly. Swap the JSON import for an API call once real data is served.
 */
function load(): Question[] {
  const parsed = QuestionBank.safeParse(sample);
  if (!parsed.success) {
    console.error(parsed.error.issues);
    throw new Error(`Question bank failed validation: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

export const questionBank: Question[] = load();
