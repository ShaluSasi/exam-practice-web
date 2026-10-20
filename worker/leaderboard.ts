/**
 * Leaderboards: students ranked by XP within a scope and a period.
 *
 * Built to grow: a scope decides *who* competes and *which rounds* count.
 * Only "global" is switched on today. Adding a scope means adding its case
 * in `scopeFilter` and listing it in ENABLED_SCOPES; the ranking, the API
 * and the dashboard stay the same.
 */
import { requireUser } from "./auth";
import { HttpError, json, type Env } from "./http";

export type Period = "week" | "month" | "all";

export type Scope =
  | { kind: "global" }
  /** Everyone in one class, e.g. Class 10 (users.grade). */
  | { kind: "grade"; grade: number }
  /** A school, a class division such as "10-B", or a custom group (groups + group_members). */
  | { kind: "group"; groupId: string }
  /** One chapter, or mixed practice (rounds.quiz_key). */
  | { kind: "quiz"; key: string };

const ENABLED_SCOPES: Scope["kind"][] = ["global"];
const TOP = 50;
const NEIGHBOURS = 2;

export interface Entry {
  /** Opaque, stable ID for this list (never the Google ID or email). */
  pid: string;
  name: string;
  xp: number;
  rounds: number;
  accuracy: number;
  bestStreak: number;
  rank: number;
  isMe: boolean;
}

export interface Board {
  period: Period;
  scope: Scope;
  since: number;
  participants: number;
  top: Entry[];
  /** The viewer and the students just above and below, when outside the top list. */
  around: Entry[];
  me: Entry | null;
}

/** "Riya Sharma" -> "Riya S.": enough to recognise friends, without full names of minors. */
export function displayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Student";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** Start of the period in Indian Standard Time (week starts Monday). */
export function periodStart(period: Period, now = Date.now()): number {
  if (period === "all") return 0;
  const IST = 5.5 * 3_600_000;
  const d = new Date(now + IST);
  d.setUTCHours(0, 0, 0, 0);
  if (period === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  else d.setUTCDate(1);
  return d.getTime() - IST;
}

export function parsePeriod(v: string | null): Period {
  return v === "month" || v === "all" ? v : "week";
}

function parseScope(v: string | null): Scope {
  const kind = (v ?? "global") as Scope["kind"];
  if (!ENABLED_SCOPES.includes(kind)) throw new HttpError(400, "This leaderboard is not available yet");
  return { kind: "global" };
}

/** SQL that limits which rounds count (`rounds`, joined as r) and who competes (`users`, as u). */
function scopeFilter(scope: Scope): { rounds: string; roundParams: unknown[]; users: string; userParams: unknown[] } {
  switch (scope.kind) {
    case "global":
      return { rounds: "", roundParams: [], users: "1 = 1", userParams: [] };
    // Planned (data model is in migrations/0003):
    //   grade: users "u.grade = ?"
    //   group: users "u.id IN (SELECT user_id FROM group_members WHERE group_id = ?)"
    //   quiz:  rounds "AND r.quiz_key = ?"
    default:
      throw new HttpError(400, "This leaderboard is not available yet");
  }
}

export async function publicId(secret: string, userId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}:${userId}`));
  return btoa(String.fromCharCode(...new Uint8Array(digest).slice(0, 9)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

interface Row {
  id: string;
  name: string;
  xp: number;
  rounds: number;
  accuracy: number | null;
  best_streak: number;
  rank: number;
  pos: number;
  participants: number;
}

export async function buildBoard(env: Env, viewerId: string, period: Period, scope: Scope): Promise<Board> {
  const since = periodStart(period);
  const filter = scopeFilter(scope);
  // All-time totals include progress carried over from the device on first sign-in.
  const base = period === "all";
  const { results } = await env.DB.prepare(
    `WITH totals AS (
       SELECT u.id, u.name,
              ${base ? "u.base_xp +" : ""} COALESCE(SUM(r.xp), 0) AS xp,
              ${base ? "u.base_rounds +" : ""} COUNT(r.id) AS rounds,
              CAST(ROUND(AVG(r.accuracy)) AS INTEGER) AS accuracy,
              ${base ? "MAX(u.base_best_streak, COALESCE(MAX(r.best_streak), 0))" : "COALESCE(MAX(r.best_streak), 0)"} AS best_streak
       FROM users u
       LEFT JOIN rounds r ON r.user_id = u.id AND r.played_at >= ? ${filter.rounds}
       WHERE ${filter.users}
       GROUP BY u.id
     ),
     ranked AS (
       SELECT *, RANK() OVER (ORDER BY xp DESC) AS rank,
              ROW_NUMBER() OVER (ORDER BY xp DESC, rounds DESC, id) AS pos,
              COUNT(*) OVER () AS participants
       FROM totals WHERE xp > 0
     ),
     mine AS (SELECT pos FROM ranked WHERE id = ?)
     SELECT id, name, xp, rounds, accuracy, best_streak, rank, pos, participants FROM ranked
     WHERE pos <= ? OR pos BETWEEN (SELECT pos FROM mine) - ? AND (SELECT pos FROM mine) + ?
     ORDER BY pos`,
  )
    .bind(since, ...filter.roundParams, ...filter.userParams, viewerId, TOP, NEIGHBOURS, NEIGHBOURS)
    .all<Row>();

  const entries = await Promise.all(
    results.map(async (r) => ({
      pos: r.pos,
      entry: {
        pid: await publicId(env.SESSION_SECRET, r.id),
        name: displayName(r.name),
        xp: r.xp,
        rounds: r.rounds,
        accuracy: r.accuracy ?? 0,
        bestStreak: r.best_streak,
        rank: r.rank,
        isMe: r.id === viewerId,
      } satisfies Entry,
    })),
  );
  return {
    period,
    scope,
    since,
    participants: results[0]?.participants ?? 0,
    top: entries.filter((e) => e.pos <= TOP).map((e) => e.entry),
    around: entries.filter((e) => e.pos > TOP).map((e) => e.entry),
    me: entries.find((e) => e.entry.isMe)?.entry ?? null,
  };
}

/** GET /api/leaderboard?period=week|month|all&scope=global */
export async function getLeaderboard(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await requireUser(request, env);
  const board = await buildBoard(env, user.id, parsePeriod(url.searchParams.get("period")), parseScope(url.searchParams.get("scope")));
  return json(board);
}
