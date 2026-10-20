/**
 * Unfinished rounds, saved after every answer so a chapter can be resumed on
 * any device, plus a permanent per-answer log.
 */
import { z } from "zod";
import { requireUser } from "./auth";
import { HttpError, assertSameOrigin, json, readJson, type Env } from "./http";

const DAY = 86_400_000;
const MAX_STATE_BYTES = 100_000;

const AttemptIn = z.object({
  questionId: z.string().min(1).max(100),
  response: z.unknown().optional(),
  correct: z.boolean(),
  usedHint: z.boolean(),
  xp: z.number().int().min(0).max(10_000),
  timeMs: z.number().int().min(0).max(DAY),
});

const SavedRoundIn = z
  .object({
    key: z.string().min(1).max(200),
    roundId: z.string().min(1).max(64),
    title: z.string().min(1).max(200),
    questionIds: z.array(z.string().min(1).max(100)).min(1).max(200),
    attempts: z.array(AttemptIn).max(200),
    xp: z.number().int().min(0).max(1_000_000),
    streak: z.number().int().min(0).max(1000),
    bestStreak: z.number().int().min(0).max(1000),
    elapsedMs: z.number().int().min(0).max(30 * DAY),
    updatedAt: z.number().int().positive(),
  })
  .refine((r) => r.attempts.length <= r.questionIds.length, "Too many answers");

const ClearIn = z.object({ key: z.string().min(1).max(200), roundId: z.string().min(1).max(64) });

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpError(400, "Invalid progress data");
  return result.data;
}

/** GET /api/progress — the student's unfinished rounds. */
export async function getProgress(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare("SELECT state FROM active_rounds WHERE user_id = ? ORDER BY updated_at DESC")
    .bind(user.id)
    .all<{ state: string }>();
  return json({ rounds: results.map((r) => JSON.parse(r.state) as unknown) });
}

/** POST /api/progress/save — called after every answer. Safe to repeat. */
export async function saveProgress(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const user = await requireUser(request, env);
  const round = parse(SavedRoundIn, await readJson(request));
  const state = JSON.stringify(round);
  if (state.length > MAX_STATE_BYTES) throw new HttpError(413, "Progress too large");
  const now = Date.now();

  await env.DB.batch([
    // A late, older save never overwrites a newer one of the same round.
    env.DB.prepare(
      `INSERT INTO active_rounds (user_id, key, email, round_id, title, state, answered, total, xp, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, key) DO UPDATE SET
         email = excluded.email, round_id = excluded.round_id, title = excluded.title, state = excluded.state,
         answered = excluded.answered, total = excluded.total, xp = excluded.xp, updated_at = excluded.updated_at
       WHERE excluded.round_id <> active_rounds.round_id OR excluded.answered >= active_rounds.answered`,
    ).bind(user.id, round.key, user.email, round.roundId, round.title, state, round.attempts.length, round.questionIds.length, round.xp, now),
    // All answers in one statement (D1 caps queries and bound values per request).
    env.DB.prepare(
      `INSERT INTO answers (user_id, email, round_id, round_title, question_id, correct, skipped, used_hint, xp, time_ms, response, answered_at)
       SELECT ?1, ?2, ?3, ?4, a.value ->> '$.questionId', a.value ->> '$.correct', (a.value -> '$.response') IS NULL,
              a.value ->> '$.usedHint', a.value ->> '$.xp', a.value ->> '$.timeMs', a.value -> '$.response', ?5
       FROM json_each(?6) AS a WHERE true
       ON CONFLICT (user_id, round_id, question_id) DO NOTHING`,
    ).bind(user.id, user.email, round.roundId, round.title, now, JSON.stringify(round.attempts)),
  ]);
  return json({ ok: true });
}

/** POST /api/progress/clear — round finished or started over. Only removes that exact round. */
export async function clearProgress(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const user = await requireUser(request, env);
  const { key, roundId } = parse(ClearIn, await readJson(request));
  await env.DB.prepare("DELETE FROM active_rounds WHERE user_id = ? AND key = ? AND round_id = ?").bind(user.id, key, roundId).run();
  return json({ ok: true });
}
