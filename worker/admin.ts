/**
 * Admin configuration API: admins only (ADMIN_EMAILS, worker/auth.ts).
 *
 * Question difficulty: the bank files (src/content/data) hold each question's
 * difficulty; an admin's change is kept in D1 (question_difficulty) and applied
 * over the files by `loadBank`, so it reaches students without a deploy.
 *
 * Question order: an admin can set the order a chapter's questions are shown
 * in (chapter_order); chapter rounds are shown in it (worker/questions.ts).
 */
import { z } from "zod";
import type { AdminChapter, AdminQuestion, AdminQuestions, Difficulty } from "../src/content/api";
import type { Question } from "../src/content/schema";
import { requireRole } from "./auth";
import { absoluteImages, chapterOrders, difficultyChanges, fileQuestions, loadBank } from "./content";
import { HttpError, assertSameOrigin, json, readJson, type Env } from "./http";

const MAX_CHANGES = 500;

/** The bank as students get it now (admin reads must not see another instance's stale copy) and each question's file difficulty. */
async function current(env: Env) {
  difficultyChanges.forget();
  chapterOrders.forget();
  const [bank, files, orders] = await Promise.all([loadBank(env), fileQuestions(), chapterOrders.get(env)]);
  return { bank, fileDifficulty: new Map(files.map((q) => [q.id, q.difficulty])), orders };
}

function summary(key: string, { bank, fileDifficulty, orders }: Awaited<ReturnType<typeof current>>): AdminChapter {
  const c = bank.chapters.get(key)!;
  const difficulty: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  let changed = 0;
  for (const q of c.questions) {
    difficulty[q.difficulty]++;
    if (fileDifficulty.get(q.id) !== q.difficulty) changed++;
  }
  return { key, title: c.title, no: c.no, subject: c.subject, grade: c.grade, count: c.questions.length, difficulty, changed, ordered: orders.has(key) };
}

/** GET /api/admin/chapters */
export async function getAdminChapters(request: Request, env: Env): Promise<Response> {
  await requireRole(request, env, ["admin"]);
  const now = await current(env);
  const chapters = [...now.bank.chapters.keys()]
    .map((key) => summary(key, now))
    .sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject) || (a.no ?? 99) - (b.no ?? 99));
  return json({ chapters });
}

/** GET /api/admin/questions?chapter=<key>: the chapter's questions in full, in bank order. */
export async function getAdminQuestions(request: Request, env: Env, url: URL): Promise<Response> {
  await requireRole(request, env, ["admin"]);
  const key = url.searchParams.get("chapter") ?? "";
  const now = await current(env);
  const chapter = now.bank.chapters.get(key);
  if (!chapter) throw new HttpError(404, "No such chapter");
  const [{ results }, order] = await Promise.all([
    env.DB.prepare("SELECT question_id, updated_by, updated_at FROM question_difficulty").all<{ question_id: string; updated_by: string; updated_at: number }>(),
    env.DB.prepare("SELECT question_ids, updated_by, updated_at FROM chapter_order WHERE chapter_key = ?")
      .bind(key)
      .first<{ question_ids: string; updated_by: string; updated_at: number }>(),
  ]);
  const changes = new Map(results.map((r) => [r.question_id, r]));
  const questions = chapter.questions.map((q): AdminQuestion => {
    const change = changes.get(q.id);
    return {
      question: absoluteImages(q, url.origin),
      fileDifficulty: now.fileDifficulty.get(q.id)!,
      ...(change ? { changedBy: change.updated_by, changedAt: change.updated_at } : {}),
    };
  });
  return json({
    chapter: summary(key, now),
    questions,
    ...(order ? { order: { ids: JSON.parse(order.question_ids) as string[], updatedBy: order.updated_by, updatedAt: order.updated_at } } : {}),
  } satisfies AdminQuestions);
}

const ChangesIn = z.object({
  changes: z
    .array(z.object({ id: z.string().min(1).max(100), difficulty: z.enum(["easy", "medium", "hard"]) }))
    .min(1)
    .max(MAX_CHANGES),
});

/** POST /api/admin/difficulty: saves new difficulties. One set back to the file's difficulty loses its D1 row. */
export async function saveDifficulty(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const admin = await requireRole(request, env, ["admin"]);
  const parsed = ChangesIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Invalid changes");
  const files = new Map((await fileQuestions()).map((q): [string, Question] => [q.id, q]));
  const unknown = parsed.data.changes.find((c) => !files.has(c.id));
  if (unknown) throw new HttpError(400, `No such question: ${unknown.id}`);

  const now = Date.now();
  await env.DB.batch(
    parsed.data.changes.map((c) =>
      files.get(c.id)!.difficulty === c.difficulty
        ? env.DB.prepare("DELETE FROM question_difficulty WHERE question_id = ?").bind(c.id)
        : env.DB.prepare(
            `INSERT INTO question_difficulty (question_id, difficulty, updated_by, updated_at) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (question_id) DO UPDATE SET difficulty = ?2, updated_by = ?3, updated_at = ?4`,
          ).bind(c.id, c.difficulty, admin.email, now),
    ),
  );
  difficultyChanges.forget();
  return json({ saved: parsed.data.changes.length });
}

const OrderIn = z.object({
  chapter: z.string().min(1).max(300),
  ids: z.array(z.string().min(1).max(100)).max(MAX_CHANGES).nullable(),
});

/** POST /api/admin/order: the order a chapter's questions are shown in; `ids: null` goes back to the default. */
export async function saveOrder(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const admin = await requireRole(request, env, ["admin"]);
  const parsed = OrderIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Invalid order");
  const { chapter: key, ids } = parsed.data;
  const chapter = (await loadBank(env)).chapters.get(key);
  if (!chapter) throw new HttpError(404, "No such chapter");

  if (ids === null) {
    await env.DB.prepare("DELETE FROM chapter_order WHERE chapter_key = ?").bind(key).run();
  } else {
    // Every question of the chapter, each once: a list made before a question was added or removed is refused.
    const all = new Set(chapter.questions.map((q) => q.id));
    if (ids.length !== all.size || new Set(ids).size !== ids.length || !ids.every((id) => all.has(id))) {
      throw new HttpError(409, "The chapter's questions have changed. Reload it and try again.");
    }
    await env.DB.prepare(
      `INSERT INTO chapter_order (chapter_key, question_ids, updated_by, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (chapter_key) DO UPDATE SET question_ids = ?2, updated_by = ?3, updated_at = ?4`,
    )
      .bind(key, JSON.stringify(ids), admin.email, Date.now())
      .run();
  }
  chapterOrders.forget();
  return json({ ok: true });
}
