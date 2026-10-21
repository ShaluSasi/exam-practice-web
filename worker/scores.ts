/**
 * Saved scores for signed-in students. Every round is stored against the
 * account (Google ID) and the email it was played with.
 *
 * Live rounds arrive with their answers and are graded here (worker/content.ts),
 * so the numbers the app sends are ignored. Guest progress copied in on first
 * sign-in (`importDevice`) was played before signing in and is still
 * taken as sent.
 */
import { z } from "zod";
import { requireUser, type SessionUser } from "./auth";
import { fromRecorded, gradeRound, loadBank, recordedChecks } from "./content";
import { HttpError, assertSameOrigin, json, readJson, type Env } from "./http";

const DAY = 86_400_000;
const RECENT = 30;

const RoundIn = z
  .object({
    id: z.string().min(1).max(64),
    at: z.number().int().positive(),
    title: z.string().min(1).max(200),
    correct: z.number().int().min(0).max(1000),
    total: z.number().int().min(1).max(1000),
    marks: z.number().min(-10_000).max(10_000),
    maxMarks: z.number().min(0).max(10_000),
    accuracy: z.number().int().min(0).max(100),
    xp: z.number().int().min(0).max(100_000),
    timeMs: z.number().int().min(0).max(7 * DAY),
    streak: z.number().int().min(0).max(1000).optional(),
    /** Chapter key or "mixed"; feeds chapter-wise leaderboards. */
    quizKey: z.string().min(1).max(200).optional(),
  })
  .refine((r) => r.correct <= r.total && r.at <= Date.now() + DAY, "Invalid round");
type RoundIn = z.infer<typeof RoundIn>;

/** A round just played: its questions and answers, graded here. */
const LiveRoundIn = RoundIn.and(
  z.object({
    questionIds: z.array(z.string().min(1).max(100)).min(1).max(200),
    attempts: z
      .array(z.object({ questionId: z.string().min(1).max(100), response: z.unknown().optional(), usedHint: z.boolean() }))
      .max(200),
  }),
);

const SaveBody = z.object({ rounds: z.array(LiveRoundIn).min(1).max(50) });

/** The device's guest progress, copied in on the account's first sign-in. */
/** The most XP one question can earn (src/engine/scoring.ts: hard, with the streak bonus). */
const MAX_XP_PER_QUESTION = 25;
const MAX_QUESTIONS_PER_ROUND = 50;

const ImportBody = z
  .object({
    totalXp: z.number().int().min(0).max(10_000_000),
    bestStreak: z.number().int().min(0).max(10_000),
    sessions: z.number().int().min(0).max(100_000),
    rounds: z.array(RoundIn).max(100),
  })
  // Guest progress cannot be re-graded (its answers were never sent), so at least keep it plausible.
  .refine(
    (b) =>
      b.rounds.every((r) => r.xp <= MAX_XP_PER_QUESTION * r.total && r.total <= MAX_QUESTIONS_PER_ROUND) &&
      b.totalXp <= MAX_XP_PER_QUESTION * MAX_QUESTIONS_PER_ROUND * Math.max(b.sessions, b.rounds.length),
    "Implausible progress",
  );

interface RoundRow {
  client_id: string;
  played_at: number;
  title: string;
  correct: number;
  total: number;
  marks: number;
  max_marks: number;
  accuracy: number;
  xp: number;
  time_ms: number;
  best_streak: number | null;
}

const ROUND_COLS = "client_id, played_at, title, correct, total, marks, max_marks, accuracy, xp, time_ms, best_streak";

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpError(400, "Invalid score data");
  return result.data;
}

function toClient(r: RoundRow) {
  return {
    id: r.client_id,
    at: r.played_at,
    title: r.title,
    correct: r.correct,
    total: r.total,
    marks: r.marks,
    maxMarks: r.max_marks,
    accuracy: r.accuracy,
    xp: r.xp,
    timeMs: r.time_ms,
    ...(r.best_streak == null ? {} : { streak: r.best_streak }),
  };
}

function insertRound(env: Env, user: SessionUser, r: RoundIn, source: "live" | "imported", now: number) {
  return env.DB.prepare(
    `INSERT INTO rounds (user_id, email, client_id, title, correct, total, marks, max_marks, accuracy, xp, best_streak, time_ms, played_at, source, created_at, quiz_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, client_id) DO NOTHING`,
  ).bind(
    user.id,
    user.email,
    r.id,
    r.title,
    r.correct,
    r.total,
    r.marks,
    r.maxMarks,
    r.accuracy,
    r.xp,
    r.streak ?? null,
    r.timeMs,
    r.at,
    source,
    now,
    r.quizKey ?? null,
  );
}

/** Totals, the latest rounds, and the best round of every chapter. */
async function summary(env: Env, userId: string) {
  const [totals, recent, bests] = await env.DB.batch([
    env.DB.prepare(
      `SELECT u.base_xp + COALESCE(SUM(r.xp), 0) AS xp,
              u.base_rounds + COUNT(r.id) AS rounds,
              MAX(u.base_best_streak, COALESCE(MAX(r.best_streak), 0)) AS best_streak
       FROM users u LEFT JOIN rounds r ON r.user_id = u.id
       WHERE u.id = ?
       GROUP BY u.id`,
    ).bind(userId),
    env.DB.prepare(`SELECT ${ROUND_COLS} FROM rounds WHERE user_id = ? ORDER BY played_at DESC LIMIT ${RECENT}`).bind(userId),
    env.DB.prepare(
      `SELECT ${ROUND_COLS} FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY title ORDER BY accuracy DESC, marks DESC, time_ms ASC) AS rank
         FROM rounds WHERE user_id = ?
       ) WHERE rank = 1`,
    ).bind(userId),
  ]);
  const t = (totals.results[0] ?? { xp: 0, rounds: 0, best_streak: 0 }) as { xp: number; rounds: number; best_streak: number };
  return {
    totalXp: t.xp,
    sessions: t.rounds,
    bestStreak: t.best_streak,
    recent: (recent.results as unknown as RoundRow[]).map(toClient),
    bests: (bests.results as unknown as RoundRow[]).map(toClient),
  };
}

/** GET /api/scores */
export async function getScores(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  return json(await summary(env, user.id));
}

/** POST /api/scores/rounds — saves finished rounds (retries are safe). */
export async function saveRounds(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const user = await requireUser(request, env);
  const { rounds } = parse(SaveBody, await readJson(request));
  const bank = await loadBank();
  const now = Date.now();
  // Graded from the answers the server saw checked (worker/questions.ts), not the ones sent here.
  const graded: RoundIn[] = [];
  for (const { questionIds, attempts, ...r } of rounds) {
    const g = gradeRound(bank, questionIds, fromRecorded(attempts, await recordedChecks(env, user.id, r.id)));
    graded.push({
      ...r,
      correct: g.score.correct,
      total: Math.max(1, g.total),
      marks: g.score.marks,
      maxMarks: g.score.maxMarks,
      accuracy: g.score.accuracy,
      xp: g.xp,
      streak: g.bestStreak,
    });
  }
  await env.DB.batch(graded.map((r) => insertRound(env, user, r, "live", now)));
  return json(await summary(env, user.id));
}

/** POST /api/scores/import — copies device progress in, only on the account's first sign-in. */
export async function importDevice(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const user = await requireUser(request, env);
  const body = parse(ImportBody, await readJson(request));
  const now = Date.now();

  // The device keeps only its latest rounds; carry the rest of its totals separately.
  const roundXp = body.rounds.reduce((n, r) => n + r.xp, 0);
  const claimed = await env.DB.prepare(
    `UPDATE users SET imported_at = ?, base_xp = ?, base_rounds = ?, base_best_streak = ?
     WHERE id = ? AND imported_at IS NULL`,
  )
    .bind(now, Math.max(0, body.totalXp - roundXp), Math.max(0, body.sessions - body.rounds.length), body.bestStreak, user.id)
    .run();

  const imported = claimed.meta.changes === 1;
  if (imported && body.rounds.length > 0) {
    await env.DB.batch(body.rounds.map((r) => insertRound(env, user, r, "imported", now)));
  }
  return json({ imported, ...(await summary(env, user.id)) });
}
