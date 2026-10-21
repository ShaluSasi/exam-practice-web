/**
 * Content API: the catalog of chapters, questions without their answers, and
 * answer checking. Nothing is cached (`no-store`), so an edit to a question
 * bank is live on the next request after a deploy.
 */
import { z } from "zod";
import type { Catalog, CheckResponse, QuestionsResponse } from "../src/content/api";
import { SubjectId, type ClientQuestion, type Question } from "../src/content/schema";
import { ROUND_SIZE, pickRandom } from "../src/engine/scoring";
import { answerKey, chapterInfo, grade, isResponseFor, loadBank, publicQuestion } from "./content";
import { HttpError, json, readJson } from "./http";

const MAX_IDS = 200;
const MAX_COUNT = 50;

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

/** GET /api/catalog — every chapter with its question count and version. */
export async function getCatalog(url: URL): Promise<Response> {
  const bank = await loadBank();
  const chapters = [...bank.chapters.values()]
    .map((c) => chapterInfo(c, url.origin))
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.grade - b.grade || (a.no ?? 99) - (b.no ?? 99));
  const catalog: Catalog = { version: bank.version, chapters, types: [...new Set(bank.all.map((q) => q.type))] };
  return json(catalog);
}

/**
 * GET /api/questions
 * - `ids=a,b,c`: those questions, in that order. `reveal=a,b` also sends the
 *   answer keys of ones already answered (resuming a round).
 * - otherwise a random round of `count` (default 20) from `chapter=<key>`, or
 *   from `subjects=` / `grades=`, or from everything.
 */
export async function getQuestions(url: URL): Promise<Response> {
  const bank = await loadBank();
  const p = url.searchParams;
  const ids = list(p.get("ids"));
  const send = (qs: Question[], missing: string[] = [], reveal = new Set<string>()) => {
    const body: QuestionsResponse = {
      questions: qs.map((q) => (reveal.has(q.id) ? ({ ...publicQuestion(q, url.origin), ...answerKey(q) } as ClientQuestion) : publicQuestion(q, url.origin))),
      missing,
    };
    return json(body);
  };

  if (ids.length > 0) {
    if (ids.length > MAX_IDS) throw new HttpError(400, "Too many questions");
    const found = ids.map((id) => bank.byId.get(id)).filter((q): q is Question => !!q);
    return send(
      found,
      ids.filter((id) => !bank.byId.has(id)),
      new Set(list(p.get("reveal"))),
    );
  }

  const count = Math.min(MAX_COUNT, Math.max(1, Number(p.get("count")) || ROUND_SIZE));
  const chapter = p.get("chapter");
  let pool: Question[];
  if (chapter) {
    pool = bank.chapters.get(chapter)?.questions ?? [];
  } else {
    const subjects = list(p.get("subjects")).filter((s) => SubjectId.safeParse(s).success);
    const grades = list(p.get("grades")).map(Number);
    pool = bank.all.filter(
      (q) => (subjects.length === 0 || subjects.includes(q.subject)) && (grades.length === 0 || grades.includes(q.grade)),
    );
  }
  return send(pickRandom(pool, count));
}

const CheckIn = z.object({
  questionId: z.string().min(1).max(100),
  /** Missing or null: skipped. */
  response: z.unknown().optional(),
});

/** POST /api/answers/check — right or wrong, plus the answer key and explanation. */
export async function checkAnswer(request: Request): Promise<Response> {
  const parsed = CheckIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Invalid answer");
  const { questionId, response } = parsed.data;
  const q = (await loadBank()).byId.get(questionId);
  if (!q) throw new HttpError(404, "This question no longer exists");
  if (response != null && !isResponseFor(q, response)) throw new HttpError(400, "Invalid answer");
  const body: CheckResponse = { correct: grade(q, response), key: answerKey(q) };
  return json(body);
}
