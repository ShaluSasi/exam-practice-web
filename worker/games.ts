/**
 * Game scoreboards.
 *
 * Every finished run of a game is saved against the signed-in student. A game
 * is split into sections (Galaxy Guardian's missions: multiplication,
 * division, ...), and each section has its own board ranked by the student's
 * best run in the period. The "overall" board adds up each student's best
 * score in every section, so trying more missions climbs it.
 *
 * Like round scores, game scores are calculated in the browser; the checks
 * below only stop numbers that no real run could produce.
 */
import { z } from "zod";
import { requireUser } from "./auth";
import { HttpError, assertSameOrigin, json, readJson, type Env } from "./http";
import { displayName, parsePeriod, periodStart, publicId, type Period } from "./leaderboard";

/** Sections of each game, with the names used in link previews. Keep in step with src/games/galaxy/sections.ts. */
export const GAME_SECTIONS: Record<string, Record<string, string>> = {
  galaxy: {
    mixed: "Mixed",
    add: "Addition",
    sub: "Subtraction",
    mul: "Multiplication",
    div: "Division",
    squares: "Squares & roots",
    fractions: "Fractions",
    percent: "Percentages",
    integers: "Integers",
    powers: "Powers",
    equations: "Equations",
    bodmas: "BODMAS",
  },
};

export const OVERALL = "overall";
const TOP = 50;
const NEIGHBOURS = 2;
const DAY = 86_400_000;

const RunIn = z
  .object({
    id: z.string().min(1).max(64),
    game: z.string().min(1).max(20),
    section: z.string().min(1).max(20),
    at: z.number().int().positive(),
    score: z.number().int().min(0).max(5_000_000),
    wave: z.number().int().min(1).max(500),
    level: z.number().int().min(1).max(50),
    correct: z.number().int().min(0).max(5_000),
    answered: z.number().int().min(0).max(5_000),
    bestCombo: z.number().int().min(0).max(5_000),
  })
  .refine(
    (r) =>
      hasSection(r.game, r.section) &&
      r.correct <= r.answered &&
      r.bestCombo <= r.correct &&
      r.at <= Date.now() + DAY &&
      // A wave needs at least 3 right answers (a mothership on fire), and no answer is worth more than 1,000 points.
      r.wave <= Math.floor(r.correct / 3) + 1 &&
      // The game's level is the wave, capped at 10 (galaxy/sections.ts levelForWave).
      r.level <= Math.min(r.wave, 10) &&
      r.score <= r.correct * 1_000 + 250 * r.wave * r.wave + 1_250 * r.wave,
    "Invalid run",
  );

const SaveBody = z.object({ runs: z.array(RunIn).min(1).max(50) });

/** Own keys only: "constructor" and friends are not games or sections. */
export const hasGame = (game: string) => Object.hasOwn(GAME_SECTIONS, game);
export const hasSection = (game: string, section: string) => hasGame(game) && Object.hasOwn(GAME_SECTIONS[game], section);

function parseGame(v: string | null): string {
  if (!v || !hasGame(v)) throw new HttpError(400, "Unknown game");
  return v;
}

function parseSection(game: string, v: string | null): string {
  if (v === OVERALL || (v && hasSection(game, v))) return v;
  throw new HttpError(400, "Unknown section");
}

/** POST /api/games/runs — saves finished runs (retries are safe). */
export async function saveRuns(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const user = await requireUser(request, env);
  const parsed = SaveBody.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Invalid score data");
  const now = Date.now();
  await env.DB.batch(
    parsed.data.runs.map((r) =>
      env.DB.prepare(
        `INSERT INTO game_runs (user_id, client_id, game, section, score, wave, level, correct, answered, best_combo, played_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, client_id) DO NOTHING`,
      ).bind(user.id, r.id, r.game, r.section, r.score, r.wave, r.level, r.correct, r.answered, r.bestCombo, r.at, now),
    ),
  );
  return json({ saved: parsed.data.runs.length });
}

export interface GameEntry {
  pid: string;
  name: string;
  score: number;
  /** Highest difficulty level reached. */
  level: number;
  wave: number;
  runs: number;
  accuracy: number;
  /** Sections played (overall board only). */
  sections: number;
  rank: number;
  isMe: boolean;
}

interface Row {
  id: string;
  name: string;
  score: number;
  level: number;
  wave: number;
  runs: number;
  correct: number;
  answered: number;
  sections: number;
  rank: number;
  pos: number;
  participants: number;
}

/** Each student's best run per section in the period (SQL, binds game and since). */
const PER_SECTION = `
  SELECT user_id, section, MAX(score) AS score, MAX(level) AS level, MAX(wave) AS wave,
         COUNT(*) AS runs, SUM(correct) AS correct, SUM(answered) AS answered
  FROM game_runs WHERE game = ? AND played_at >= ?
  GROUP BY user_id, section`;

/** GET /api/games/board?game=galaxy&section=overall|mul|...&period=week|month|all */
export async function getGameBoard(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await requireUser(request, env);
  const game = parseGame(url.searchParams.get("game"));
  const section = parseSection(game, url.searchParams.get("section"));
  const period: Period = parsePeriod(url.searchParams.get("period"));
  const since = periodStart(period);

  const totals =
    section === OVERALL
      ? `SELECT user_id, SUM(score) AS score, MAX(level) AS level, MAX(wave) AS wave, SUM(runs) AS runs,
                SUM(correct) AS correct, SUM(answered) AS answered, COUNT(*) AS sections
         FROM per GROUP BY user_id`
      : `SELECT user_id, score, level, wave, runs, correct, answered, 1 AS sections FROM per WHERE section = ?`;

  const { results } = await env.DB.prepare(
    `WITH per AS (${PER_SECTION}),
     totals AS (${totals}),
     ranked AS (
       SELECT t.*, u.name,
              RANK() OVER (ORDER BY t.score DESC) AS rank,
              ROW_NUMBER() OVER (ORDER BY t.score DESC, t.level DESC, t.user_id) AS pos,
              COUNT(*) OVER () AS participants
       FROM totals t JOIN users u ON u.id = t.user_id
       WHERE t.score > 0
     ),
     mine AS (SELECT pos FROM ranked WHERE user_id = ?)
     SELECT user_id AS id, name, score, level, wave, runs, correct, answered, sections, rank, pos, participants FROM ranked
     WHERE pos <= ? OR pos BETWEEN (SELECT pos FROM mine) - ? AND (SELECT pos FROM mine) + ?
     ORDER BY pos`,
  )
    .bind(game, since, ...(section === OVERALL ? [] : [section]), user.id, TOP, NEIGHBOURS, NEIGHBOURS)
    .all<Row>();

  const entries = await Promise.all(
    results.map(async (r) => ({
      pos: r.pos,
      entry: {
        pid: await publicId(env.SESSION_SECRET, r.id),
        name: displayName(r.name),
        score: r.score,
        level: r.level,
        wave: r.wave,
        runs: r.runs,
        accuracy: r.answered ? Math.round((r.correct / r.answered) * 100) : 0,
        sections: r.sections,
        rank: r.rank,
        isMe: r.id === user.id,
      } satisfies GameEntry,
    })),
  );
  return json({
    game,
    section,
    period,
    since,
    participants: results[0]?.participants ?? 0,
    top: entries.filter((e) => e.pos <= TOP).map((e) => e.entry),
    around: entries.filter((e) => e.pos > TOP).map((e) => e.entry),
    me: entries.find((e) => e.entry.isMe)?.entry ?? null,
  });
}

/** GET /api/games/ranks?game=galaxy&period=week — the viewer's rank on every board of the game. */
export async function getGameRanks(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await requireUser(request, env);
  const game = parseGame(url.searchParams.get("game"));
  const period = parsePeriod(url.searchParams.get("period"));
  const { results } = await env.DB.prepare(
    `WITH per AS (${PER_SECTION}),
     boards AS (
       SELECT user_id, section, score FROM per
       UNION ALL
       SELECT user_id, '${OVERALL}' AS section, SUM(score) AS score FROM per GROUP BY user_id
     ),
     ranked AS (
       SELECT *, RANK() OVER (PARTITION BY section ORDER BY score DESC) AS rank,
              COUNT(*) OVER (PARTITION BY section) AS participants
       FROM boards WHERE score > 0
     )
     SELECT section, score, rank, participants FROM ranked WHERE user_id = ?`,
  )
    .bind(game, periodStart(period), user.id)
    .all<{ section: string; score: number; rank: number; participants: number }>();
  const ranks: Record<string, { score: number; rank: number; participants: number }> = {};
  for (const r of results) ranks[r.section] = { score: r.score, rank: r.rank, participants: r.participants };
  return json({ game, period, ranks });
}
