import type { SubjectId } from "../content/schema";

/**
 * Everything that differs between markets lives here, so US/UK releases are
 * a new entry rather than a code fork.
 */
export interface RegionConfig {
  id: "IN" | "US" | "UK";
  appName: string;
  locale: string;
  boards: string[];
  grades: number[];
  gradeLabel: (grade: number) => string;
  subjects: Record<SubjectId, string>;
  /** Standard answer options for assertion–reason questions. */
  assertionReasonOptions: { id: "a" | "b" | "c" | "d"; text: string }[];
}

export const REGIONS: Record<RegionConfig["id"], RegionConfig> = {
  IN: {
    id: "IN",
    appName: "PrepQuest",
    locale: "en-IN",
    boards: ["CBSE"],
    grades: [9, 10, 11, 12],
    gradeLabel: (g) => `Class ${g}`,
    subjects: { maths: "Mathematics", physics: "Physics", chemistry: "Chemistry", biology: "Biology", social: "Social Science", english: "English" },
    assertionReasonOptions: [
      { id: "a", text: "Both A and R are true, and R is the correct explanation of A." },
      { id: "b", text: "Both A and R are true, but R is not the correct explanation of A." },
      { id: "c", text: "A is true, but R is false." },
      { id: "d", text: "A is false, but R is true." },
    ],
  },
  US: {
    id: "US",
    appName: "PrepQuest",
    locale: "en-US",
    boards: ["Common Core", "AP"],
    grades: [9, 10, 11, 12],
    gradeLabel: (g) => `Grade ${g}`,
    subjects: { maths: "Math", physics: "Physics", chemistry: "Chemistry", biology: "Biology", social: "Social Studies", english: "English" },
    assertionReasonOptions: [],
  },
  UK: {
    id: "UK",
    appName: "PrepQuest",
    locale: "en-GB",
    boards: ["AQA", "Edexcel", "OCR"],
    grades: [10, 11, 12, 13],
    gradeLabel: (g) => `Year ${g}`,
    subjects: { maths: "Maths", physics: "Physics", chemistry: "Chemistry", biology: "Biology", social: "Humanities", english: "English" },
    assertionReasonOptions: [],
  },
};

export const region = REGIONS.IN;

/**
 * Classes the app offers today. Only Class 9 for now; add the others as their
 * content grows. Mixed practice, custom sets and challenge fallbacks draw from
 * these classes only, so sample questions for other classes never reach a student.
 */
export const offeredGrades = region.grades.filter((g) => g === 9);
