/**
 * Admin Users page: the accounts that used the app on chosen days (India time),
 * from user_visits (recorded at sign-in and each time the app opens, worker/auth.ts).
 */
import type { AdminUser, AdminUsers } from "../src/content/api";
import { DAY_RE, addDays, dayStart } from "../src/lib/day";
import { adminEmails, requireRole, roleOf, type Role } from "./auth";
import { HttpError, json, type Env } from "./http";

const MAX_LISTED = 2000;
/** D1 allows 100 bound values a query; the rest of the query uses a few. */
const MAX_EXCLUDED = 80;

interface Row {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  grade: number | null;
  role: Role;
  created_at: number;
  days: number;
  visits: number;
  sign_ins: number;
  last_seen: number;
  rounds: number;
}

/** The SQL that leaves out excluded accounts: whole emails, or every email at a domain ("@school.org"). */
function exclusions(env: Env, url: URL): { sql: string; params: string[] } {
  const entries = (url.searchParams.get("exclude") ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const hideAdmins = url.searchParams.get("admins") === "0";
  const emails = [...new Set([...entries.filter((e) => !e.startsWith("@")), ...(hideAdmins ? adminEmails(env) : [])])];
  const domains = [...new Set(entries.filter((e) => e.startsWith("@") && e.length > 1))];
  if (emails.length + domains.length > MAX_EXCLUDED) throw new HttpError(400, `At most ${MAX_EXCLUDED} emails and domains can be excluded`);

  const clauses: string[] = [];
  if (hideAdmins) clauses.push("u.role <> 'admin'");
  if (emails.length) clauses.push(`u.email NOT IN (${emails.map(() => "?").join(", ")})`);
  for (let i = 0; i < domains.length; i++) clauses.push("u.email NOT LIKE ? ESCAPE '\\'");
  const like = domains.map((d) => `%${d.replace(/[\\%_]/g, (c) => `\\${c}`)}`);
  return { sql: clauses.map((c) => ` AND ${c}`).join(""), params: [...emails, ...like] };
}

/** GET /api/admin/users?from=YYYY-MM-DD&to=YYYY-MM-DD&exclude=a@x.com,@school.org&admins=0 (no from/to: all time). */
export async function getAdminUsers(request: Request, env: Env, url: URL): Promise<Response> {
  await requireRole(request, env, ["admin"]);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  if (!!from !== !!to || (from && (!DAY_RE.test(from) || !DAY_RE.test(to!) || Number.isNaN(dayStart(from)) || Number.isNaN(dayStart(to!)))))
    throw new HttpError(400, "Pick both a start and an end date");
  if (from && to && from > to) throw new HttpError(400, "The start date is after the end date");

  const firstDay = from ?? "0000-01-01";
  const lastDay = to ?? "9999-12-31";
  const startMs = from ? dayStart(from) : 0;
  const endMs = to ? dayStart(addDays(to, 1)) : Number.MAX_SAFE_INTEGER;
  const ex = exclusions(env, url);

  const [list, made, all] = await env.DB.batch([
    env.DB.prepare(
      `SELECT u.id, u.email, u.name, u.picture, u.grade, u.role, u.created_at,
              COUNT(*) AS days, SUM(v.visits) AS visits, SUM(v.sign_ins) AS sign_ins, MAX(v.last_at) AS last_seen,
              (SELECT COUNT(*) FROM rounds r WHERE r.user_id = u.id AND r.source = 'live' AND r.played_at >= ? AND r.played_at < ?) AS rounds
       FROM user_visits v JOIN users u ON u.id = v.user_id
       WHERE v.day >= ? AND v.day <= ?${ex.sql}
       GROUP BY u.id
       ORDER BY last_seen DESC
       LIMIT ?`,
    ).bind(startMs, endMs, firstDay, lastDay, ...ex.params, MAX_LISTED + 1),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM users u WHERE u.created_at >= ? AND u.created_at < ?${ex.sql}`).bind(startMs, endMs, ...ex.params),
    env.DB.prepare("SELECT COUNT(*) AS n FROM users"),
  ]);

  const rows = (list.results as Row[]) ?? [];
  const users = rows.slice(0, MAX_LISTED).map(
    (r): AdminUser => ({
      id: r.id,
      name: r.name,
      email: r.email,
      picture: r.picture,
      grade: r.grade,
      role: roleOf(env, r.email, r.role),
      joinedAt: r.created_at,
      lastSeenAt: r.last_seen,
      days: r.days,
      visits: r.visits,
      signIns: r.sign_ins,
      rounds: r.rounds,
    }),
  );
  return json({
    ...(from && to ? { from, to } : {}),
    users,
    truncated: rows.length > MAX_LISTED,
    newUsers: (made.results[0] as { n: number } | undefined)?.n ?? 0,
    totalUsers: (all.results[0] as { n: number } | undefined)?.n ?? 0,
  } satisfies AdminUsers);
}
