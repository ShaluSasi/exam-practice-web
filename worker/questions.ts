/**
 * Content API: the catalog of chapters, questions without their answers, and
 * answer checking. Nothing is cached (`no-store`), so an edit to a question
 * bank is live on the next request after a deploy.
 */
import { z } from "zod";
import type { Catalog, CheckResponse, QuestionsResponse } from "../src/content/api";
import { SubjectId, type ClientQuestion, type Question } from "../src/content/schema";
import { GUEST_LIMITS, ROUND_SIZE, pickRound } from "../src/engine/scoring";
import { optionalUser } from "./auth";
import { answerKey, chapterInfo, chapterOrders, grade, inOrder, isResponseFor, loadBank, publicQuestion, recordedChecks } from "./content";
import { HttpError, guestLimit, json, readJson, type Env } from "./http";

const MAX_IDS = 200;
const MAX_COUNT = 50;
/** A real answer is a few option IDs; anything far bigger is not one (and is saved in `checks`). */
const MAX_RESPONSE_CHARS = 10_000;
const DAY_MS = 86_400_000;

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

/** GET /api/catalog — every chapter with its question count and version. */
export async function getCatalog(env: Env, url: URL): Promise<Response> {
  const bank = await loadBank(env);
  const chapters = [...bank.chapters.values()]
    .map((c) => chapterInfo(c, url.origin))
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.grade - b.grade || (a.no ?? 99) - (b.no ?? 99));
  const catalog: Catalog = { version: bank.version, chapters, types: [...new Set(bank.all.map((q) => q.type))] };
  return json(catalog);
}

/**
 * GET /api/questions
 * - `ids=a,b,c`: those questions, in that order. `reveal=a,b` also sends the
 *   answer keys of ones already answered (resuming a round). For a signed-in
 *   student only questions the server saw checked in `round=<id>` are revealed.
 * - otherwise a random round of `count` (default 20), easiest questions first, from `chapter=<key>`, or
 *   from `subjects=` / `grades=`, or from everything. A chapter whose order an admin has set
 *   shows its round in that order instead.
 */
export async function getQuestions(request: Request, env: Env, url: URL): Promise<Response> {
  const bank = await loadBank(env);
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
    let reveal = list(p.get("reveal"));
    if (reveal.length) {
      const user = await optionalUser(request, env);
      if (user) {
        const checked = await recordedChecks(env, user.id, p.get("round") ?? "");
        reveal = reveal.filter((id) => checked.has(id));
      }
    }
    return send(found, ids.filter((id) => !bank.byId.has(id)), new Set(reveal));
  }

  await countGuestRound(request, env);
  const count = Math.min(MAX_COUNT, Math.max(1, Number(p.get("count")) || ROUND_SIZE));
  const chapter = p.get("chapter");
  let pool: Question[];
  if (chapter) {
    pool = bank.chapters.get(chapter)?.questions ?? [];
    // An admin has set this chapter's order: the round's questions are shown in it instead.
    const order = (await chapterOrders.get(env)).get(chapter);
    if (order) return send(inOrder(pickRound(pool, count), order));
  } else {
    const subjects = list(p.get("subjects")).filter((s) => SubjectId.safeParse(s).success);
    const grades = list(p.get("grades")).map(Number);
    pool = bank.all.filter(
      (q) => (subjects.length === 0 || subjects.includes(q.subject)) && (grades.length === 0 || grades.includes(q.grade)),
    );
  }
  return send(pickRound(pool, count));
}

/** The network a request came from: its IP address, or the /64 an IPv6 address belongs to, hashed. */
async function networkOf(request: Request): Promise<string | null> {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return null; // local dev
  const network = ip.includes(":") ? ip.split(":").slice(0, 4).join(":") : ip;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(network));
  return [...new Uint8Array(hash).slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Counts a new round drawn by a guest; past GUEST_ROUNDS_PER_DAY, they must sign in (401, src/store/guestLimit.ts).
 * The app has its own limit per device; this catches clearing the browser's data or a private window, and
 * leaves room for a few devices (a family, a classroom) sharing one connection.
 */
async function countGuestRound(request: Request, env: Env): Promise<void> {
  const perDay = guestLimit(env.GUEST_ROUNDS_PER_DAY, GUEST_LIMITS.roundsPerDay);
  if (perDay < 0 || (await optionalUser(request, env))) return;
  const network = await networkOf(request);
  if (!network) return;
  const day = Math.floor(Date.now() / DAY_MS);
  // A database problem (or the table not migrated yet) must not stop guests from practising.
  const counted = await env.DB.batch([
    env.DB.prepare("DELETE FROM guest_rounds WHERE day < ?").bind(day - 1),
    env.DB.prepare(
      "INSERT INTO guest_rounds (network, day, n) VALUES (?, ?, 1) ON CONFLICT (network, day) DO UPDATE SET n = n + 1 RETURNING n",
    ).bind(network, day),
  ]).catch(() => null);
  const n = (counted?.[1].results[0] as { n: number } | undefined)?.n ?? 0;
  if (n > perDay) throw new HttpError(401, "Sign in (free) to keep practising.");
}

const CheckIn = z.object({
  questionId: z.string().min(1).max(100),
  /** Missing or null: skipped. */
  response: z.unknown().optional(),
  /** The round being played; lets the server remember the answer for grading the round later. */
  roundId: z.string().min(1).max(64).optional(),
});

/**
 * POST /api/answers/check — right or wrong, plus the answer key and explanation.
 *
 * For a signed-in student the first answer checked per round and question is
 * kept (table `checks`) and is the one graded, now and when the round is saved,
 * so checking a guess to learn the key and then "answering" changes nothing.
 */
export async function checkAnswer(request: Request, env: Env): Promise<Response> {
  const parsed = CheckIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Invalid answer");
  const { questionId, roundId } = parsed.data;
  let response: unknown = parsed.data.response ?? undefined;
  const q = (await loadBank(env)).byId.get(questionId);
  if (!q) throw new HttpError(404, "This question no longer exists");
  if (response !== undefined && (!isResponseFor(q, response) || JSON.stringify(response).length > MAX_RESPONSE_CHARS)) {
    throw new HttpError(400, "Invalid answer");
  }

  const user = roundId ? await optionalUser(request, env) : null;
  if (user && roundId) {
    // A session whose account is gone (e.g. a wiped local database) saves nothing and is graded as a guest's.
    const [, saved] = await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO checks (user_id, round_id, question_id, response, checked_at) SELECT ?1, ?2, ?3, ?4, ?5 WHERE EXISTS (SELECT 1 FROM users WHERE id = ?1)",
      ).bind(user.id, roundId, q.id, response === undefined ? null : JSON.stringify(response), Date.now()),
      env.DB.prepare("SELECT response FROM checks WHERE user_id = ? AND round_id = ? AND question_id = ?").bind(user.id, roundId, q.id),
    ]);
    const row = saved.results[0] as { response: string | null } | undefined;
    if (row) response = row.response === null ? undefined : (JSON.parse(row.response) as unknown);
  }
  const body: CheckResponse = { correct: grade(q, response), key: answerKey(q) };
  return json(body);
}
