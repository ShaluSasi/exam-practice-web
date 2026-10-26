/**
 * Shareable achievements.
 *
 * A student shares a finished round ("I scored 95% — beat me on the same
 * questions") or their leaderboard rank. They get a short link, /s/<code>:
 * - Chat apps (WhatsApp, Telegram, ...) fetch it and show a rich preview from
 *   the Open Graph tags we put into the page (title, text, branded image).
 * - A friend who opens it lands on a challenge page and can play the same
 *   questions straight away, with no sign-in needed.
 * The personalised picture card is drawn in the browser and shared as an
 * image file, so no user-made images are ever hosted here.
 */
import { z } from "zod";
import { requireUser } from "./auth";
import { HttpError, assertSameOrigin, json, readJson, type Env } from "./http";
import { GAME_SECTIONS, hasSection } from "./games";
import { buildBoard, displayName, type Period } from "./leaderboard";

const CODE = /^[A-Za-z0-9]{8}$/;
const CRAWLERS = /bot|crawl|spider|facebookexternalhit|whatsapp|telegram|slack|discord|preview|embed/i;

const CreateIn = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("round"),
    roundId: z.string().min(1).max(64),
    questionIds: z.array(z.string().min(1).max(100)).min(1).max(200),
  }),
  z.object({ kind: z.literal("rank"), period: z.enum(["week", "month", "all"]) }),
]);

interface RoundShare {
  title: string;
  quizKey: string | null;
  accuracy: number;
  marks: number;
  maxMarks: number;
  correct: number;
  total: number;
  xp: number;
  timeMs: number;
  streak: number;
  questionIds: string[];
}

interface RankShare {
  period: Period;
  rank: number;
  participants: number;
  xp: number;
}

function newCode(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => abc[b % abc.length]).join("");
}

/** POST /api/share — creates (or reuses) a share link for the signed-in student. */
export async function createShare(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const user = await requireUser(request, env);
  const parsed = CreateIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Invalid share");
  const body = parsed.data;
  const now = Date.now();

  let data: RoundShare | RankShare;
  let roundId: string | null = null;
  if (body.kind === "round") {
    // Numbers come from the saved round, not from the request.
    const r = await env.DB.prepare(
      `SELECT title, quiz_key, accuracy, marks, max_marks, correct, total, xp, time_ms, best_streak
       FROM rounds WHERE user_id = ? AND client_id = ?`,
    )
      .bind(user.id, body.roundId)
      .first<{
        title: string;
        quiz_key: string | null;
        accuracy: number;
        marks: number;
        max_marks: number;
        correct: number;
        total: number;
        xp: number;
        time_ms: number;
        best_streak: number | null;
      }>();
    if (!r) throw new HttpError(404, "Round not saved yet");
    roundId = body.roundId;
    // The questions come from the round's own answer log, so a share can't point friends at a
    // different set. The request's list is only used if that log never arrived (saves are retried).
    const logged = await env.DB.prepare("SELECT question_id FROM answers WHERE user_id = ? AND round_id = ? ORDER BY id")
      .bind(user.id, body.roundId)
      .all<{ question_id: string }>();
    const questionIds = logged.results.length ? logged.results.map((a) => a.question_id) : body.questionIds.slice(0, r.total);
    data = {
      title: r.title,
      quizKey: r.quiz_key,
      accuracy: r.accuracy,
      marks: r.marks,
      maxMarks: r.max_marks,
      correct: r.correct,
      total: r.total,
      xp: r.xp,
      timeMs: r.time_ms,
      streak: r.best_streak ?? 0,
      questionIds,
    };
  } else {
    const board = await buildBoard(env, user.id, body.period, { kind: "global" });
    if (!board.me) throw new HttpError(400, "Finish a round to get on the leaderboard first");
    data = { period: body.period, rank: board.me.rank, participants: board.participants, xp: board.me.xp };
  }

  // One link per round, so sharing the same result twice reuses it.
  const row = await env.DB.prepare(
    `INSERT INTO shares (code, user_id, kind, round_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, round_id) WHERE round_id IS NOT NULL DO UPDATE SET data = excluded.data
     RETURNING code`,
  )
    .bind(newCode(), user.id, body.kind, roundId, JSON.stringify(data), now)
    .first<{ code: string }>();
  const code = row!.code;
  return json({ code, url: `${url.origin}/s/${code}` });
}

async function loadShare(env: Env, code: string) {
  if (!CODE.test(code)) return null;
  const row = await env.DB.prepare(
    `SELECT s.code, s.kind, s.data, s.created_at, s.visits, s.plays, u.name
     FROM shares s JOIN users u ON u.id = s.user_id WHERE s.code = ?`,
  )
    .bind(code)
    .first<{ code: string; kind: "round" | "rank"; data: string; created_at: number; visits: number; plays: number; name: string }>();
  if (!row) return null;
  return {
    code: row.code,
    kind: row.kind,
    name: displayName(row.name),
    createdAt: row.created_at,
    visits: row.visits,
    plays: row.plays,
    data: JSON.parse(row.data) as RoundShare | RankShare,
  };
}

/** GET /api/share/:code — public: what the challenge page shows. */
export async function getShare(env: Env, code: string): Promise<Response> {
  const share = await loadShare(env, code);
  if (!share) throw new HttpError(404, "This link has expired");
  return json(share);
}

/** POST /api/share/:code/play — a friend accepted the challenge. */
export async function countPlay(request: Request, env: Env, url: URL, code: string): Promise<Response> {
  assertSameOrigin(request, url);
  if (CODE.test(code)) await env.DB.prepare("UPDATE shares SET plays = plays + 1 WHERE code = ?").bind(code).run();
  return json({ ok: true });
}

const PERIOD_TEXT: Record<Period, string> = { week: "this week", month: "this month", all: "of all time" };

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** GET /s/:code — the app page, with link-preview tags for chat apps. */
export async function sharePage(request: Request, env: Env, url: URL, code: string): Promise<Response> {
  const share = await loadShare(env, code);
  if (!share) return homePage(env, url);
  if (!CRAWLERS.test(request.headers.get("User-Agent") ?? "")) {
    await env.DB.prepare("UPDATE shares SET visits = visits + 1 WHERE code = ?").bind(code).run();
  }
  if (share.kind === "round") {
    const d = share.data as RoundShare;
    return withPreview(env, url, {
      title: `${share.name} scored ${d.accuracy}% in ${d.title} 🏆`,
      description: `Same ${d.questionIds.length} questions. Can you beat ${d.accuracy}%? Free CBSE practice on Kidzladder.`,
      image: "/og/challenge.jpg",
      path: `/s/${code}`,
    });
  }
  const d = share.data as RankShare;
  return withPreview(env, url, {
    title: `${share.name} is #${d.rank} of ${d.participants} on Kidzladder ${PERIOD_TEXT[d.period]} 🏆`,
    description: "Practise CBSE questions, earn XP and climb the leaderboard. Can you get higher?",
    image: "/og/rank.jpg",
    path: `/s/${code}`,
  });
}

const GAME_PREVIEW: Record<string, { title: string; description: string; image: string }> = {
  galaxy: {
    title: "Galaxy Guardian 🚀 Save Earth with maths",
    description: "Blast the asteroid with the right answer before it hits Earth. Pick a mission (×, ÷, fractions, %…), climb the levels and top the scoreboard!",
    image: "/og/galaxy.jpg",
  },
};

/** GET /games/:id — a game's page, with a link preview naming the game (and mission, from ?mode=). */
export function gamePage(env: Env, url: URL, id: string): Promise<Response> {
  if (!Object.hasOwn(GAME_PREVIEW, id)) return homePage(env, url);
  const g = GAME_PREVIEW[id];
  const mode = url.searchParams.get("mode");
  const mission = mode && hasSection(id, mode) ? GAME_SECTIONS[id][mode] : undefined;
  return withPreview(env, url, {
    title: mission && mode !== "mixed" ? `${g.title} · ${mission} mission` : g.title,
    description: g.description,
    image: g.image,
    path: `${url.pathname}${mission ? `?mode=${mode}` : ""}`,
  });
}

/** GET / — the home page with a link preview, for when the plain site address is shared. */
export function homePage(env: Env, url: URL): Promise<Response> {
  return withPreview(env, url, {
    title: "Kidzladder — CBSE exam practice that feels like a game",
    description: "Free interactive practice for CBSE Class 9 and 10: instant feedback, streaks, XP and leaderboards.",
    image: "/og/default.jpg",
    path: "/",
  });
}

/** The app page with its title, description and Open Graph tags set (image URLs must be absolute). */
async function withPreview(env: Env, url: URL, p: { title: string; description: string; image: string; path: string }): Promise<Response> {
  const page = await env.ASSETS.fetch(new Request(new URL("/", url), { headers: { Accept: "text/html" } }));
  const tags = {
    "og:type": "website",
    "og:site_name": "Kidzladder",
    "og:title": p.title,
    "og:description": p.description,
    "og:url": `${url.origin}${p.path}`,
    "og:image": `${url.origin}${p.image}`,
    "og:image:type": "image/jpeg",
    "og:image:width": "1200",
    "og:image:height": "630",
    "og:image:alt": p.title,
  };
  const head = [
    ...Object.entries(tags).map(([k, v]) => `<meta property="${k}" content="${escape(v)}" />`),
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join("");

  const rewritten = new HTMLRewriter()
    .on("title", { element: (el) => void el.setInnerContent(p.path === "/" ? p.title : `${p.title} · Kidzladder`) })
    .on('meta[name="description"]', { element: (el) => void el.setAttribute("content", p.description) })
    .on('meta[property^="og:"], meta[name^="twitter:"]', { element: (el) => void el.remove() })
    .on("head", { element: (el) => void el.append(head, { html: true }) })
    .transform(page);
  const headers = new Headers(rewritten.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(rewritten.body, { status: 200, headers });
}
