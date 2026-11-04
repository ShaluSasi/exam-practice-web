/**
 * Reported questions. A signed-in student reports a problem with a question
 * (a remark, and optionally the fix they suggest); admins see every report, set
 * its status and can fix the question. A fix is kept in D1 (question_edits) and
 * applied over the bank files by `loadBank`, so it reaches every student without
 * a deploy.
 */
import { z } from "zod";
import type { AdminReport, AdminReportGroup, AdminReports, MyReports, ReportReason, ReportStatus } from "../src/content/api";
import { QuestionEdit, editBetween, editedQuestion, isEmptyEdit, mergeEdits } from "../src/content/edit";
import { requireRole, requireUser } from "./auth";
import { absoluteImages, fileQuestions, loadBank, questionEdits } from "./content";
import { HttpError, assertSameOrigin, json, readJson, type Env } from "./http";

/** Reports one student may send in a day, so the list stays readable. */
const MAX_REPORTS_PER_DAY = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LISTED = 500;

const REASONS = ["wrong_answer", "question_error", "unclear", "image", "other"] as const satisfies readonly ReportReason[];
const STATUSES = ["new", "accepted", "rejected", "fixed", "reviewed", "closed"] as const satisfies readonly ReportStatus[];

const ReportIn = z.object({
  questionId: z.string().min(1).max(100),
  reason: z.enum(REASONS),
  remark: z.string().trim().min(3).max(1000),
  proposal: QuestionEdit.optional(),
});

/** POST /api/reports. A second report on the same question replaces the student's new one. */
export async function submitReport(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const user = await requireUser(request, env);
  const parsed = ReportIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Please say what the problem is (at least a few words).");
  const { questionId, reason, remark } = parsed.data;
  const q = (await loadBank(env)).byId.get(questionId);
  if (!q) throw new HttpError(404, "This question no longer exists");
  const proposal = parsed.data.proposal && !isEmptyEdit(parsed.data.proposal) ? parsed.data.proposal : undefined;
  if (proposal && !editedQuestion(q, proposal)) throw new HttpError(400, "The suggested fix is incomplete: check that no field is empty and an answer is picked.");

  const now = Date.now();
  const [recent, waiting] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM question_reports WHERE user_id = ? AND created_at > ?").bind(user.id, now - DAY_MS).first<{ n: number }>(),
    env.DB.prepare("SELECT id FROM question_reports WHERE user_id = ? AND question_id = ? AND status = 'new'").bind(user.id, questionId).first<{ id: string }>(),
  ]);
  const proposalJson = proposal ? JSON.stringify(proposal) : null;
  if (waiting) {
    await env.DB.prepare("UPDATE question_reports SET reason = ?, remark = ?, proposal = ?, created_at = ? WHERE id = ?")
      .bind(reason, remark, proposalJson, now, waiting.id)
      .run();
  } else {
    if ((recent?.n ?? 0) >= MAX_REPORTS_PER_DAY) throw new HttpError(429, "You've sent a lot of reports today. Thank you! Please try again tomorrow.");
    await env.DB.prepare(
      "INSERT INTO question_reports (id, question_id, user_id, reason, remark, proposal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(crypto.randomUUID(), questionId, user.id, reason, remark, proposalJson, now)
      .run();
  }
  return json({ ok: true });
}

interface ReportRow {
  id: string;
  question_id: string;
  reason: ReportReason;
  remark: string;
  proposal: string | null;
  status: ReportStatus;
  created_at: number;
  resolved_by: string | null;
  resolved_at: number | null;
  admin_note: string | null;
  applied: string | null;
  name: string;
  email: string;
}

function toReport(r: ReportRow): AdminReport {
  return {
    id: r.id,
    reason: r.reason,
    remark: r.remark,
    status: r.status,
    createdAt: r.created_at,
    reporter: { name: r.name, email: r.email },
    ...(r.proposal ? { proposal: JSON.parse(r.proposal) as QuestionEdit } : {}),
    ...(r.resolved_by ? { resolvedBy: r.resolved_by } : {}),
    ...(r.resolved_at ? { resolvedAt: r.resolved_at } : {}),
    ...(r.admin_note ? { adminNote: r.admin_note } : {}),
    ...(r.applied ? { applied: JSON.parse(r.applied) as QuestionEdit } : {}),
  };
}

const statusOf = (url: URL): ReportStatus =>
  (STATUSES as readonly string[]).includes(url.searchParams.get("status") ?? "") ? (url.searchParams.get("status") as ReportStatus) : "new";

const noCounts = (): Record<ReportStatus, number> => ({ new: 0, accepted: 0, rejected: 0, fixed: 0, reviewed: 0, closed: 0 });

/** GET /api/reports?status=<status>: the student's own reports with that status (new by default), newest first. */
export async function getMyReports(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await requireUser(request, env);
  const [bank, { results }, counted] = await Promise.all([
    loadBank(env),
    env.DB.prepare(
      "SELECT id, question_id, reason, remark, proposal, status, created_at, resolved_at FROM question_reports WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
    )
      .bind(user.id, statusOf(url), MAX_LISTED)
      .all<Pick<ReportRow, "id" | "question_id" | "reason" | "remark" | "proposal" | "status" | "created_at" | "resolved_at">>(),
    env.DB.prepare("SELECT status, COUNT(*) AS n FROM question_reports WHERE user_id = ? GROUP BY status").bind(user.id).all<{ status: ReportStatus; n: number }>(),
  ]);
  const counts = noCounts();
  for (const c of counted.results) counts[c.status] = c.n;
  return json({
    reports: results.map((r) => {
      const q = bank.byId.get(r.question_id);
      return {
        id: r.id,
        reason: r.reason,
        remark: r.remark,
        status: r.status,
        createdAt: r.created_at,
        ...(r.resolved_at ? { updatedAt: r.resolved_at } : {}),
        suggestedFix: r.proposal !== null,
        question: q ? { prompt: q.prompt, subject: q.subject, grade: q.grade, chapter: q.chapter } : null,
      };
    }),
    counts,
  } satisfies MyReports);
}

/** GET /api/admin/reports?status=<status>: reports with that status (new by default) grouped by question, newest first. */
export async function getAdminReports(request: Request, env: Env, url: URL): Promise<Response> {
  await requireRole(request, env, ["admin"]);
  const status = statusOf(url);
  // The question as students get it now, not another instance's stale copy.
  questionEdits.forget();
  const [bank, files, { results }, counted, edited] = await Promise.all([
    loadBank(env),
    fileQuestions(),
    env.DB.prepare(
      `SELECT r.*, u.name, u.email FROM question_reports r JOIN users u ON u.id = r.user_id
       WHERE r.status = ? ORDER BY r.created_at DESC LIMIT ?`,
    )
      .bind(status, MAX_LISTED)
      .all<ReportRow>(),
    env.DB.prepare("SELECT status, COUNT(*) AS n FROM question_reports GROUP BY status").all<{ status: ReportStatus; n: number }>(),
    env.DB.prepare("SELECT question_id FROM question_edits").all<{ question_id: string }>(),
  ]);
  const editedIds = new Set(edited.results.map((r) => r.question_id));
  const groups = new Map<string, AdminReportGroup>();
  for (const row of results) {
    let g = groups.get(row.question_id);
    if (!g) {
      const q = bank.byId.get(row.question_id);
      const isEdited = editedIds.has(row.question_id);
      const file = isEdited ? files.find((f) => f.id === row.question_id) : undefined;
      g = {
        questionId: row.question_id,
        question: q ? absoluteImages(q, url.origin) : null,
        edited: isEdited,
        original: file ? absoluteImages(file, url.origin) : null,
        reports: [],
      };
      groups.set(row.question_id, g);
    }
    g.reports.push(toReport(row));
  }
  const counts = noCounts();
  for (const c of counted.results) counts[c.status] = c.n;
  return json({ groups: [...groups.values()], counts } satisfies AdminReports);
}

const StatusIn = z.object({
  id: z.string().min(1).max(100),
  status: z.enum(STATUSES),
  note: z.string().trim().max(1000),
});

/** POST /api/admin/reports/status. Any status can be set from any other; back to new, it no longer counts as handled by anyone. */
export async function setReportStatus(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const admin = await requireRole(request, env, ["admin"]);
  const parsed = StatusIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  const { id, status, note } = parsed.data;
  const handled = status !== "new";
  const { meta } = await env.DB.prepare("UPDATE question_reports SET status = ?, resolved_by = ?, resolved_at = ?, admin_note = ? WHERE id = ?")
    .bind(status, handled ? admin.email : null, handled ? Date.now() : null, note || null, id)
    .run();
  if (meta.changes === 0) throw new HttpError(404, "No such report");
  return json({ ok: true });
}

const FixIn = z.object({
  id: z.string().min(1).max(100),
  edit: QuestionEdit.optional(),
  note: z.string().trim().max(1000).optional(),
});

/** POST /api/admin/reports/fix. Applies `edit` (the admin's, or else the student's suggestion) on top of earlier edits and marks the report fixed. */
export async function fixReport(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const admin = await requireRole(request, env, ["admin"]);
  const parsed = FixIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  const { id, note } = parsed.data;
  const row = await env.DB.prepare("SELECT question_id, proposal, admin_note FROM question_reports WHERE id = ?")
    .bind(id)
    .first<{ question_id: string; proposal: string | null; admin_note: string | null }>();
  if (!row) throw new HttpError(404, "No such report");

  const edit = parsed.data.edit ?? (row.proposal ? (JSON.parse(row.proposal) as QuestionEdit) : undefined);
  if (!edit || isEmptyEdit(edit)) throw new HttpError(400, "There is no change to apply.");

  const now = Date.now();
  const file = (await fileQuestions()).find((q) => q.id === row.question_id);
  if (!file) throw new HttpError(404, "This question no longer exists");
  const earlier = await env.DB.prepare("SELECT edit FROM question_edits WHERE question_id = ?").bind(row.question_id).first<{ edit: string }>();
  const edited = editedQuestion(file, mergeEdits(earlier ? (JSON.parse(earlier.edit) as QuestionEdit) : {}, edit));
  if (!edited) throw new HttpError(400, "This change would break the question: check that no field is empty and the answer is one of the choices.");
  // Kept relative to the file, so an edit that puts everything back removes the row.
  const total = editBetween(file, edited);
  await env.DB.batch([
    isEmptyEdit(total)
      ? env.DB.prepare("DELETE FROM question_edits WHERE question_id = ?").bind(row.question_id)
      : env.DB.prepare(
          `INSERT INTO question_edits (question_id, edit, updated_by, updated_at) VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT (question_id) DO UPDATE SET edit = ?2, updated_by = ?3, updated_at = ?4`,
        ).bind(row.question_id, JSON.stringify(total), admin.email, now),
    env.DB.prepare("UPDATE question_reports SET status = 'fixed', resolved_by = ?, resolved_at = ?, admin_note = ?, applied = ? WHERE id = ?").bind(
      admin.email,
      now,
      note === undefined ? row.admin_note : note || null,
      JSON.stringify(edit),
      id,
    ),
  ]);
  questionEdits.forget();
  return json({ ok: true });
}
