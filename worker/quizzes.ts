/**
 * Scheduled quizzes. Admins create them from the question banks with a window
 * (start and end time) and a time limit; signed-in students take each one once
 * inside its window. Answers are saved as they are picked and graded here, on
 * submit or once the student's time is up. A student sees the correct answers,
 * the leaderboard and their certificate as soon as they finish.
 * A student who reaches the pass mark gets a certificate of achievement.
 * Students only see quizzes an admin has released: new and cloned quizzes are
 * drafts, and a released quiz can be withheld (hidden) and released again.
 */
import { z } from "zod";
import type { AdminQuiz, AdminQuizResults, Certificate, MyQuizzes, QuizBoard, QuizInfo, QuizList, QuizResult, QuizSession, QuizStatus } from "../src/content/api";
import { CertificateFormat, certificateFormat } from "../src/content/certificate";
import type { AnyResponse, ClientQuestion, Question } from "../src/content/schema";
import { pickRandom } from "../src/engine/scoring";
import { optionalUser, requireRole, requireUser } from "./auth";
import { absoluteImages, answerKey, grade, isResponseFor, loadBank, publicQuestion, type Bank } from "./content";
import { HttpError, assertSameOrigin, json, readJson, type Env } from "./http";
import { homePage, withPreview } from "./share";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Ended quizzes stay listed this long, so students can come back for their result and certificate. */
const LISTED_AFTER_END_MS = 30 * DAY_MS;
/** Answers sent this long after the deadline still count (the last one may be on its way). */
const GRACE_MS = 10_000;
const MAX_RESPONSE_CHARS = 10_000;
const BOARD_SIZE = 50;

interface QuizRow {
  id: string;
  title: string;
  description: string;
  starts_at: number;
  ends_at: number;
  duration_min: number;
  pass_percent: number;
  question_ids: string;
  created_by: string;
  created_at: number;
  updated_at: number;
  certificate: string | null;
  status: QuizStatus;
}

interface AttemptRow {
  quiz_id: string;
  user_id: string;
  started_at: number;
  deadline: number;
  answers: string;
  submitted_at: number | null;
  correct: number | null;
  total: number | null;
  percent: number | null;
  passed: number | null;
  certificate_id: string | null;
}

const idsOf = (quiz: QuizRow) => JSON.parse(quiz.question_ids) as string[];

function toInfo(quiz: QuizRow, participants: number, attempt?: AttemptRow | null): QuizInfo {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    startsAt: quiz.starts_at,
    endsAt: quiz.ends_at,
    durationMin: quiz.duration_min,
    passPercent: quiz.pass_percent,
    questionCount: idsOf(quiz).length,
    participants,
    ...(attempt
      ? {
          mine: {
            status: attempt.submitted_at === null ? ("in_progress" as const) : ("submitted" as const),
            deadline: attempt.deadline,
            ...(attempt.percent !== null ? { percent: attempt.percent, passed: !!attempt.passed } : {}),
            ...(attempt.certificate_id ? { certificateId: attempt.certificate_id } : {}),
          },
        }
      : {}),
  };
}

async function getQuiz(env: Env, id: string): Promise<QuizRow> {
  const quiz = await env.DB.prepare("SELECT * FROM quizzes WHERE id = ?").bind(id).first<QuizRow>();
  if (!quiz) throw new HttpError(404, "This quiz no longer exists");
  return quiz;
}

/** A quiz students can see: released by an admin. Drafts and withheld quizzes look as if they don't exist. */
async function getReleasedQuiz(env: Env, id: string): Promise<QuizRow> {
  const quiz = await getQuiz(env, id);
  if (quiz.status !== "released") throw new HttpError(404, "This quiz isn't available right now.");
  return quiz;
}

const getAttempt = (env: Env, quizId: string, userId: string) =>
  env.DB.prepare("SELECT * FROM quiz_attempts WHERE quiz_id = ? AND user_id = ?").bind(quizId, userId).first<AttemptRow>();

const countParticipants = async (env: Env, quizId: string) =>
  (await env.DB.prepare("SELECT COUNT(*) AS n FROM quiz_attempts WHERE quiz_id = ?").bind(quizId).first<{ n: number }>())?.n ?? 0;

/** The quiz's questions that are still in the bank, in the quiz's order. */
const questionsOf = (bank: Bank, quiz: QuizRow) => idsOf(quiz).flatMap((id) => bank.byId.get(id) ?? []);

/** How long an instance keeps the list of released quizzes before asking D1 again. */
const LIVE_TTL_MS = 30_000;
let released: { at: number; rows: Promise<{ starts_at: number; ends_at: number; ids: string[] }[]> } | null = null;

/**
 * The questions of every quiz that is on right now (its window open, plus the
 * grace period). Practice must not grade or reveal these meanwhile, or a
 * student could look up the answers to the quiz they are taking.
 */
export async function liveQuizQuestions(env: Env): Promise<Set<string>> {
  const now = Date.now();
  if (!released || now - released.at > LIVE_TTL_MS) {
    released = {
      at: now,
      rows: env.DB.prepare("SELECT starts_at, ends_at, question_ids FROM quizzes WHERE status = 'released' AND ends_at + ? > ?")
        .bind(GRACE_MS, now)
        .all<{ starts_at: number; ends_at: number; question_ids: string }>()
        .then(({ results }) => results.map((r) => ({ starts_at: r.starts_at, ends_at: r.ends_at, ids: JSON.parse(r.question_ids) as string[] })))
        .catch((e: unknown) => {
          console.error(e);
          released = null;
          return [];
        }),
    };
  }
  const live = new Set<string>();
  for (const q of await released.rows) if (q.starts_at <= now && now < q.ends_at + GRACE_MS) for (const id of q.ids) live.add(id);
  return live;
}

function certificateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [...crypto.getRandomValues(new Uint8Array(10))].map((b) => alphabet[b % alphabet.length]).join("");
}

/** Grades an attempt whose student submitted or whose time is up; one already graded is returned as it is. */
async function finalize(env: Env, bank: Bank, quiz: QuizRow, attempt: AttemptRow, now: number): Promise<AttemptRow> {
  const questions = questionsOf(bank, quiz);
  // A last answer (within the grace period) can land between reading the attempt and grading it: the
  // update only applies to the answers that were graded, and otherwise the fresh row is graded instead.
  for (let tries = 0; attempt.submitted_at === null && tries < 3; tries++) {
    const answers = JSON.parse(attempt.answers) as Record<string, unknown>;
    const correct = questions.filter((q) => grade(q, answers[q.id])).length;
    const total = questions.length;
    const percent = total ? Math.round((correct / total) * 100) : 0;
    const passed = total > 0 && percent >= quiz.pass_percent;
    // Time taken ends at the deadline for a student who never pressed Submit.
    const submittedAt = Math.min(now, attempt.deadline);
    const { meta } = await env.DB.prepare(
      `UPDATE quiz_attempts SET submitted_at = ?, correct = ?, total = ?, percent = ?, passed = ?, certificate_id = ?
       WHERE quiz_id = ? AND user_id = ? AND submitted_at IS NULL AND answers = ?`,
    )
      .bind(submittedAt, correct, total, percent, passed ? 1 : 0, passed ? certificateCode() : null, quiz.id, attempt.user_id, attempt.answers)
      .run();
    // Read back: the answers changed, or another request graded it first.
    attempt = (await getAttempt(env, quiz.id, attempt.user_id))!;
    if (meta.changes === 1) break;
  }
  return attempt;
}

/** GET /api/quizzes */
export async function listQuizzes(request: Request, env: Env): Promise<Response> {
  const now = Date.now();
  const user = await optionalUser(request, env);
  const { results } = await env.DB.prepare(
    `SELECT q.*, (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id = q.id) AS participants
     FROM quizzes q WHERE q.status = 'released' AND q.ends_at > ? ORDER BY q.starts_at`,
  )
    .bind(now - LISTED_AFTER_END_MS)
    .all<QuizRow & { participants: number }>();
  const mine = new Map<string, AttemptRow>();
  if (user && results.length) {
    const attempts = await env.DB.prepare("SELECT * FROM quiz_attempts WHERE user_id = ?").bind(user.id).all<AttemptRow>();
    let bank: Bank | null = null;
    for (const a of attempts.results) {
      const quiz = results.find((q) => q.id === a.quiz_id);
      if (!quiz) continue;
      if (a.submitted_at === null && now > a.deadline + GRACE_MS) {
        bank ??= await loadBank(env);
        mine.set(a.quiz_id, await finalize(env, bank, quiz, a, now));
      } else mine.set(a.quiz_id, a);
    }
  }
  return json({ quizzes: results.map((q) => toInfo(q, q.participants, mine.get(q.id))), now } satisfies QuizList);
}

const QuizIdIn = z.object({ quizId: z.string().min(1).max(100) });

/** POST /api/quizzes/start: starts the student's attempt, or resumes it. */
export async function startQuiz(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const user = await requireUser(request, env);
  const parsed = QuizIdIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  const quiz = await getReleasedQuiz(env, parsed.data.quizId);
  const now = Date.now();
  const bank = await loadBank(env);
  let attempt = await getAttempt(env, quiz.id, user.id);
  if (attempt && (attempt.submitted_at !== null || now > attempt.deadline + GRACE_MS)) {
    await finalize(env, bank, quiz, attempt, now);
    throw new HttpError(409, "You've already finished this quiz.");
  }
  if (!attempt) {
    if (now < quiz.starts_at) throw new HttpError(409, "This quiz hasn't started yet.");
    if (now >= quiz.ends_at) throw new HttpError(409, "This quiz has ended.");
    const deadline = Math.min(now + quiz.duration_min * 60_000, quiz.ends_at);
    // Two taps on Start must not make two attempts: the second one is ignored.
    await env.DB.prepare("INSERT OR IGNORE INTO quiz_attempts (quiz_id, user_id, started_at, deadline) VALUES (?, ?, ?, ?)")
      .bind(quiz.id, user.id, now, deadline)
      .run();
    attempt = (await getAttempt(env, quiz.id, user.id))!;
  }
  const session: QuizSession = {
    quiz: toInfo(quiz, await countParticipants(env, quiz.id), attempt),
    questions: questionsOf(bank, quiz).map((q) => publicQuestion(q, url.origin)),
    answers: JSON.parse(attempt.answers) as Record<string, AnyResponse>,
    deadline: attempt.deadline,
    now,
  };
  return json(session);
}

const AnswerIn = z.object({
  quizId: z.string().min(1).max(100),
  questionId: z.string().min(1).max(100),
  response: z.unknown(),
});

/** POST /api/quizzes/answer: saves (or clears) one answer while the student's time lasts. Nothing about correctness is sent back. */
export async function saveQuizAnswer(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const user = await requireUser(request, env);
  const parsed = AnswerIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Invalid answer");
  const { quizId, questionId, response } = parsed.data;
  const quiz = await getReleasedQuiz(env, quizId);
  if (!idsOf(quiz).includes(questionId)) throw new HttpError(400, "That question isn't in this quiz");
  const attempt = await getAttempt(env, quizId, user.id);
  if (!attempt) throw new HttpError(409, "Start the quiz first.");
  if (attempt.submitted_at !== null || Date.now() > attempt.deadline + GRACE_MS) throw new HttpError(409, "Time's up: this quiz is finished.");

  // The question ID comes from the quiz itself, so it is safe inside the JSON path.
  const path = `$."${questionId}"`;
  if (response === null || response === undefined) {
    await env.DB.prepare("UPDATE quiz_attempts SET answers = json_remove(answers, ?) WHERE quiz_id = ? AND user_id = ? AND submitted_at IS NULL")
      .bind(path, quizId, user.id)
      .run();
  } else {
    const q = (await loadBank(env)).byId.get(questionId);
    if (!q) throw new HttpError(404, "This question no longer exists");
    const text = JSON.stringify(response);
    if (!isResponseFor(q, response) || text.length > MAX_RESPONSE_CHARS) throw new HttpError(400, "Invalid answer");
    await env.DB.prepare("UPDATE quiz_attempts SET answers = json_set(answers, ?, json(?)) WHERE quiz_id = ? AND user_id = ? AND submitted_at IS NULL")
      .bind(path, text, quizId, user.id)
      .run();
  }
  return json({ ok: true });
}

async function resultOf(env: Env, bank: Bank, quiz: QuizRow, attempt: AttemptRow, userName: string, origin: string): Promise<QuizResult> {
  const timeTakenMs = attempt.submitted_at! - attempt.started_at;
  const [ahead, finished, participants] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM quiz_attempts WHERE quiz_id = ?3 AND submitted_at IS NOT NULL
       AND (percent > ?1 OR (percent = ?1 AND submitted_at - started_at < ?2))`,
    )
      .bind(attempt.percent, timeTakenMs, quiz.id)
      .first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM quiz_attempts WHERE quiz_id = ? AND submitted_at IS NOT NULL").bind(quiz.id).first<{ n: number }>(),
    countParticipants(env, quiz.id),
  ]);
  const result: QuizResult = {
    quiz: toInfo(quiz, participants, attempt),
    correct: attempt.correct ?? 0,
    total: attempt.total ?? 0,
    percent: attempt.percent ?? 0,
    passed: !!attempt.passed,
    timeTakenMs,
    rank: (ahead?.n ?? 0) + 1,
    finished: finished?.n ?? 0,
  };
  if (attempt.certificate_id) {
    result.certificate = {
      id: attempt.certificate_id,
      name: userName,
      quizTitle: quiz.title,
      percent: attempt.percent ?? 0,
      issuedAt: attempt.submitted_at!,
      format: certificateFormat(quiz.certificate),
    };
  }
  const answers = JSON.parse(attempt.answers) as Record<string, AnyResponse>;
  result.review = questionsOf(bank, quiz).map((q) => ({
    question: { ...publicQuestion(q, origin), ...absoluteImages(answerKey(q), origin) } as ClientQuestion,
    ...(answers[q.id] !== undefined ? { response: answers[q.id] } : {}),
    correct: grade(q, answers[q.id]),
  }));
  return result;
}

/** POST /api/quizzes/submit: the student hands in; grades the attempt and returns the result. */
export async function submitQuiz(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const user = await requireUser(request, env);
  const parsed = QuizIdIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  const quiz = await getQuiz(env, parsed.data.quizId);
  const attempt = await getAttempt(env, quiz.id, user.id);
  if (!attempt) throw new HttpError(409, "Start the quiz first.");
  const now = Date.now();
  const bank = await loadBank(env);
  return json(await resultOf(env, bank, quiz, await finalize(env, bank, quiz, attempt, now), user.name, url.origin));
}

/** GET /api/quizzes/result?quiz=<id>: the student's result, once finished (time up counts as finished). */
export async function getQuizResult(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await requireUser(request, env);
  const quiz = await getQuiz(env, url.searchParams.get("quiz") ?? "");
  let attempt = await getAttempt(env, quiz.id, user.id);
  if (!attempt) throw new HttpError(404, "You haven't taken this quiz.");
  const now = Date.now();
  const bank = await loadBank(env);
  if (attempt.submitted_at === null) {
    if (now <= attempt.deadline + GRACE_MS) throw new HttpError(409, "You're still taking this quiz.");
    attempt = await finalize(env, bank, quiz, attempt, now);
  }
  return json(await resultOf(env, bank, quiz, attempt, user.name, url.origin));
}

/** GET /api/quizzes/mine: the student's finished quizzes (time up counts as finished), with their certificates. */
export async function getMyQuizzes(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const now = Date.now();
  const { results } = await env.DB.prepare(
    `SELECT a.*, q.id AS q_id, q.title, q.description, q.starts_at, q.ends_at, q.duration_min, q.pass_percent, q.question_ids,
       q.created_by, q.created_at, q.updated_at, q.certificate, q.status,
       (SELECT COUNT(*) FROM quiz_attempts b WHERE b.quiz_id = q.id) AS participants
     FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
     WHERE a.user_id = ? ORDER BY a.started_at DESC`,
  )
    .bind(user.id)
    .all<AttemptRow & Omit<QuizRow, "id"> & { q_id: string; participants: number }>();
  let bank: Bank | null = null;
  const entries: MyQuizzes["entries"] = [];
  for (const row of results) {
    const quiz: QuizRow = { ...row, id: row.q_id };
    let attempt: AttemptRow = row;
    if (attempt.submitted_at === null) {
      // Still being taken: not in the history yet.
      if (now <= attempt.deadline + GRACE_MS) continue;
      bank ??= await loadBank(env);
      attempt = await finalize(env, bank, quiz, attempt, now);
    }
    entries.push({
      quiz: toInfo(quiz, row.participants, attempt),
      correct: attempt.correct ?? 0,
      total: attempt.total ?? 0,
      percent: attempt.percent ?? 0,
      passed: !!attempt.passed,
      timeTakenMs: attempt.submitted_at! - attempt.started_at,
      finishedAt: attempt.submitted_at!,
      ...(attempt.certificate_id
        ? {
            certificate: {
              id: attempt.certificate_id,
              name: user.name,
              quizTitle: quiz.title,
              percent: attempt.percent ?? 0,
              issuedAt: attempt.submitted_at!,
              format: certificateFormat(quiz.certificate),
            },
          }
        : {}),
    });
  }
  return json({ entries } satisfies MyQuizzes);
}

/** GET /api/quizzes/board?quiz=<id>: top scorers so far (best score, then fastest). */
export async function getQuizBoard(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await optionalUser(request, env);
  const quiz = await getReleasedQuiz(env, url.searchParams.get("quiz") ?? "");
  const [{ results }, finished] = await Promise.all([
    env.DB.prepare(
      `SELECT a.user_id, a.percent, a.passed, a.submitted_at - a.started_at AS taken, u.name, u.picture
       FROM quiz_attempts a JOIN users u ON u.id = a.user_id
       WHERE a.quiz_id = ? AND a.submitted_at IS NOT NULL
       ORDER BY a.percent DESC, taken ASC LIMIT ?`,
    )
      .bind(quiz.id, BOARD_SIZE)
      .all<{ user_id: string; percent: number; passed: number; taken: number; name: string; picture: string | null }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM quiz_attempts WHERE quiz_id = ? AND submitted_at IS NOT NULL").bind(quiz.id).first<{ n: number }>(),
  ]);
  const board: QuizBoard = {
    entries: results.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      picture: r.picture,
      percent: r.percent,
      timeTakenMs: r.taken,
      passed: !!r.passed,
      isMe: r.user_id === user?.id,
    })),
    finished: finished?.n ?? 0,
  };
  return json(board);
}

/** GET /api/certificates?id=<code>: checks a certificate, for anyone it is shown to. */
export async function getCertificate(env: Env, url: URL): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT a.certificate_id, a.percent, a.submitted_at, u.name, q.title, q.certificate
     FROM quiz_attempts a JOIN users u ON u.id = a.user_id JOIN quizzes q ON q.id = a.quiz_id
     WHERE a.certificate_id = ?`,
  )
    .bind((url.searchParams.get("id") ?? "").toUpperCase())
    .first<{ certificate_id: string; percent: number; submitted_at: number; name: string; title: string; certificate: string | null }>();
  if (!row) throw new HttpError(404, "No certificate with this code");
  return json({
    id: row.certificate_id,
    name: row.name,
    quizTitle: row.title,
    percent: row.percent,
    issuedAt: row.submitted_at,
    format: certificateFormat(row.certificate),
  } satisfies Certificate);
}

/** GET /quiz and /quiz/:id: the quiz page, with a link preview naming the quiz and when it runs (for sharing in WhatsApp groups). */
export async function quizPage(env: Env, url: URL, id: string | undefined): Promise<Response> {
  if (!id) {
    return withPreview(env, url, {
      title: "🏆 Live quizzes · win a certificate",
      description: "Join free live quizzes for CBSE Class 9 and 10. Reach the pass mark and get a certificate of achievement with your name on it.",
      image: "/og/default.jpg",
      path: "/quiz",
    });
  }
  const quiz = await env.DB.prepare("SELECT * FROM quizzes WHERE id = ?").bind(id).first<QuizRow>().catch(() => null);
  if (quiz?.status !== "released") return homePage(env, url);
  const when = new Date(quiz.starts_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return withPreview(env, url, {
    title: `🏆 ${quiz.title} · live quiz`,
    description: `${Date.now() < quiz.starts_at ? `Starts ${when} IST.` : Date.now() < quiz.ends_at ? "Live now!" : "This quiz has ended."} ${idsOf(quiz).length} questions, ${quiz.duration_min} minutes. Score ${quiz.pass_percent}% or more to win a certificate of achievement. Free!`,
    image: "/og/default.jpg",
    path: `/quiz/${quiz.id}`,
    noindex: true,
  });
}

// ---------- Admin ----------

/** GET /api/admin/quizzes: every quiz, newest first. */
export async function adminListQuizzes(request: Request, env: Env): Promise<Response> {
  await requireRole(request, env, ["admin"]);
  const { results } = await env.DB.prepare(
    `SELECT q.*,
       (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id = q.id) AS participants,
       (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id = q.id AND a.passed = 1) AS passed_count
     FROM quizzes q ORDER BY q.starts_at DESC`,
  ).all<QuizRow & { participants: number; passed_count: number }>();
  const quizzes: AdminQuiz[] = results.map((q) => ({
    ...toInfo(q, q.participants),
    status: q.status,
    questionIds: idsOf(q),
    createdBy: q.created_by,
    passedCount: q.passed_count,
    certificate: certificateFormat(q.certificate),
  }));
  return json({ quizzes });
}

/** GET /api/admin/quizzes/questions?ids=a,b,c: those questions in full, for the quiz editor. */
export async function adminQuizQuestions(request: Request, env: Env, url: URL): Promise<Response> {
  await requireRole(request, env, ["admin"]);
  const bank = await loadBank(env);
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 200);
  return json({ questions: ids.flatMap((id) => bank.byId.get(id) ?? []).map((q) => absoluteImages(q, url.origin)) });
}

const DrawIn = z.object({
  chapters: z.array(z.string().min(1).max(300)).min(1).max(100),
  count: z.number().int().min(1).max(100),
  exclude: z.array(z.string().max(100)).max(200).default([]),
});

/** POST /api/admin/quizzes/draw: `count` random questions from the chosen chapters, leaving out `exclude`. */
export async function adminDrawQuestions(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  await requireRole(request, env, ["admin"]);
  const parsed = DrawIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Pick at least one chapter");
  const bank = await loadBank(env);
  const exclude = new Set(parsed.data.exclude);
  const pool = parsed.data.chapters.flatMap((key) => bank.chapters.get(key)?.questions ?? []).filter((q) => !exclude.has(q.id) && q.type !== "numeric");
  const questions: Question[] = pickRandom(pool, parsed.data.count);
  return json({ questions: questions.map((q) => absoluteImages(q, url.origin)) });
}

const QuizIn = z
  .object({
    id: z.string().min(1).max(100).optional(),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(1000),
    startsAt: z.number().int().positive(),
    endsAt: z.number().int().positive(),
    durationMin: z.number().int().min(1).max(600),
    passPercent: z.number().int().min(1).max(100),
    questionIds: z.array(z.string().min(1).max(100)).min(1).max(200),
  })
  .refine((q) => q.endsAt > q.startsAt, "The quiz must end after it starts")
  .refine((q) => new Set(q.questionIds).size === q.questionIds.length, "A question is in the quiz twice");

/** POST /api/admin/quizzes/save. A new quiz is a draft until released. Once a student has started, only the title, description and end time can change. */
export async function adminSaveQuiz(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const admin = await requireRole(request, env, ["admin"]);
  const parsed = QuizIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid quiz");
  const q = parsed.data;
  const bank = await loadBank(env);
  const unknown = q.questionIds.find((id) => !bank.byId.has(id));
  if (unknown) throw new HttpError(400, `No such question: ${unknown}`);
  const now = Date.now();

  if (!q.id) {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO quizzes (id, title, description, starts_at, ends_at, duration_min, pass_percent, question_ids, created_by, created_at, updated_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
    )
      .bind(id, q.title, q.description, q.startsAt, q.endsAt, q.durationMin, q.passPercent, JSON.stringify(q.questionIds), admin.email, now, now)
      .run();
    return json({ id });
  }

  const quiz = await getQuiz(env, q.id);
  if ((await countParticipants(env, q.id)) > 0) {
    const same =
      q.startsAt === quiz.starts_at &&
      q.durationMin === quiz.duration_min &&
      q.passPercent === quiz.pass_percent &&
      JSON.stringify(q.questionIds) === quiz.question_ids;
    if (!same) throw new HttpError(409, "Students have already started this quiz: only its title, description and end time can change.");
    if (q.endsAt < Math.min(quiz.ends_at, now)) throw new HttpError(409, "Students have already started: the end time can't move into the past.");
  }
  await env.DB.prepare(
    `UPDATE quizzes SET title = ?, description = ?, starts_at = ?, ends_at = ?, duration_min = ?, pass_percent = ?, question_ids = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(q.title, q.description, q.startsAt, q.endsAt, q.durationMin, q.passPercent, JSON.stringify(q.questionIds), now, q.id)
    .run();
  return json({ id: q.id });
}

const CertificateIn = z.object({ id: z.string().min(1).max(100), format: CertificateFormat.nullable() });

/**
 * POST /api/admin/quizzes/certificate: the quiz's certificate wording and look.
 * Can change at any time: certificates are drawn from it each time they are shown, so ones already won update too.
 */
export async function adminSaveCertificate(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  await requireRole(request, env, ["admin"]);
  const parsed = CertificateIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Fill in the heading and both wording lines.");
  await getQuiz(env, parsed.data.id);
  await env.DB.prepare("UPDATE quizzes SET certificate = ?, updated_at = ? WHERE id = ?")
    .bind(parsed.data.format ? JSON.stringify(parsed.data.format) : null, Date.now(), parsed.data.id)
    .run();
  return json({ ok: true });
}

const StatusIn = z.object({ id: z.string().min(1).max(100), status: z.enum(["released", "withheld"]) });

/** POST /api/admin/quizzes/status: releases the quiz to students, or withholds it (hides it until released again). */
export async function adminSetQuizStatus(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  await requireRole(request, env, ["admin"]);
  const parsed = StatusIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  await getQuiz(env, parsed.data.id);
  await env.DB.prepare("UPDATE quizzes SET status = ?, updated_at = ? WHERE id = ?").bind(parsed.data.status, Date.now(), parsed.data.id).run();
  return json({ ok: true });
}

const CloneIn = z.object({ id: z.string().min(1).max(100) });

/**
 * POST /api/admin/quizzes/clone: a draft copy of the quiz (questions, settings and certificate), without its attempts.
 * A window that has already started moves forward by whole days, keeping its time of day, so the copy can be released as it is.
 */
export async function adminCloneQuiz(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  const admin = await requireRole(request, env, ["admin"]);
  const parsed = CloneIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  const quiz = await getQuiz(env, parsed.data.id);
  const now = Date.now();
  const shift = quiz.starts_at > now ? 0 : Math.ceil((now - quiz.starts_at + 1) / DAY_MS) * DAY_MS;
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO quizzes (id, title, description, starts_at, ends_at, duration_min, pass_percent, question_ids, created_by, created_at, updated_at, certificate, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
  )
    .bind(
      id,
      `${quiz.title} (copy)`.slice(0, 120),
      quiz.description,
      quiz.starts_at + shift,
      quiz.ends_at + shift,
      quiz.duration_min,
      quiz.pass_percent,
      quiz.question_ids,
      admin.email,
      now,
      now,
      quiz.certificate,
    )
    .run();
  return json({ id });
}

const DeleteIn = z.object({ id: z.string().min(1).max(100) });

/** POST /api/admin/quizzes/delete: removes the quiz with its attempts (and certificates). */
export async function adminDeleteQuiz(request: Request, env: Env, url: URL): Promise<Response> {
  assertSameOrigin(request, url);
  await requireRole(request, env, ["admin"]);
  const parsed = DeleteIn.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM quiz_attempts WHERE quiz_id = ?").bind(parsed.data.id),
    env.DB.prepare("DELETE FROM quizzes WHERE id = ?").bind(parsed.data.id),
  ]);
  return json({ ok: true });
}

/** GET /api/admin/quizzes/results?quiz=<id>: everyone who took it. */
export async function adminQuizResults(request: Request, env: Env, url: URL): Promise<Response> {
  await requireRole(request, env, ["admin"]);
  const { results } = await env.DB.prepare(
    `SELECT u.name, u.email, a.started_at, a.submitted_at, a.percent, a.passed, a.certificate_id
     FROM quiz_attempts a JOIN users u ON u.id = a.user_id
     WHERE a.quiz_id = ? ORDER BY a.percent DESC, a.submitted_at - a.started_at ASC`,
  )
    .bind(url.searchParams.get("quiz") ?? "")
    .all<{ name: string; email: string; started_at: number; submitted_at: number | null; percent: number | null; passed: number | null; certificate_id: string | null }>();
  const rows: AdminQuizResults["rows"] = results.map((r) => ({
    name: r.name,
    email: r.email,
    status: r.submitted_at === null ? "in_progress" : "submitted",
    percent: r.percent,
    passed: !!r.passed,
    startedAt: r.started_at,
    submittedAt: r.submitted_at,
    certificateId: r.certificate_id,
  }));
  return json({ rows } satisfies AdminQuizResults);
}
