import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Award, BarChart3, Check, Loader2, RotateCcw, CalendarClock, Dices, Link2, Lock, MessageSquareText, PencilLine, Plus, Share2, Trash2, Users, X } from "lucide-react";
import clsx from "clsx";
import { region } from "../config/regions";
import type { AdminChapter, AdminQuiz, AdminQuizResults, CertificateIn, QuizIn } from "../content/api";
import { CERTIFICATE_THEMES, CertificateFormat, DEFAULT_CERTIFICATE } from "../content/certificate";
import type { Question, SubjectId } from "../content/schema";
import { Chip, Header, Problem, Spinner, TYPE_LABEL } from "../components/AdminParts";
import { Button } from "../components/Button";
import { PhaseBadge, clock, formatWhen, syncClock, useServerNow } from "../components/QuizParts";
import { RichText } from "../components/RichText";
import { THEME_COLORS, renderCertificate } from "../lib/certificate";
import { api } from "../store/auth";
import { quizUrl, useNav } from "../store/nav";

type View = { kind: "list" } | { kind: "edit"; quiz: AdminQuiz | null } | { kind: "results"; quiz: AdminQuiz } | { kind: "certificate"; quiz: AdminQuiz };

const field = "w-full rounded-xl border-2 border-line bg-bg px-3 py-2 outline-none focus:border-brand disabled:opacity-50";
const label = "mb-1 block text-xs font-extrabold uppercase tracking-wider text-muted";

/** A time as a `datetime-local` value, in this device's time zone. */
const toLocalInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const fromLocalInput = (v: string) => new Date(v).getTime();

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** The message to paste into WhatsApp groups (*bold* is WhatsApp's). */
const inviteText = (q: AdminQuiz) =>
  [
    `🏆 *${q.title}*: a free live quiz on ${region.appName}!`,
    `📅 ${formatWhen(q.startsAt)}`,
    `📝 ${q.questionCount} questions · ⏱️ ${q.durationMin} minutes`,
    `🏅 Score ${q.passPercent}% or more to win a certificate of achievement`,
    `👉 Join here: ${quizUrl(q.id)}`,
  ].join("\n");

/** Copies `text`; where the browser won't, shows it to copy by hand. */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Copy this:", text);
    return false;
  }
}

function QuizEditor({ quiz, onSaved, onCancel }: { quiz: AdminQuiz | null; onSaved: (message: string) => void; onCancel: () => void }) {
  const locked = !!quiz && quiz.participants > 0;
  const [title, setTitle] = useState(quiz?.title ?? "");
  const [description, setDescription] = useState(quiz?.description ?? "");
  const [startsAt, setStartsAt] = useState(() => {
    if (quiz) return toLocalInput(quiz.startsAt);
    const nextHour = Math.ceil(Date.now() / 3_600_000) * 3_600_000;
    return toLocalInput(nextHour);
  });
  const [endsAt, setEndsAt] = useState(() => toLocalInput(quiz?.endsAt ?? Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 3_600_000));
  const [durationMin, setDurationMin] = useState(String(quiz?.durationMin ?? 20));
  const [passPercent, setPassPercent] = useState(String(quiz?.passPercent ?? 60));
  const [questions, setQuestions] = useState<Question[] | null>(quiz ? null : []);
  const [chapters, setChapters] = useState<AdminChapter[] | null>(null);
  const [grade, setGrade] = useState<number | null>(null);
  const [subject, setSubject] = useState<SubjectId | "all">("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [count, setCount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    api<{ chapters: AdminChapter[] }>("/api/admin/chapters")
      .then((r) => {
        setChapters(r.chapters);
        setGrade((g) => g ?? r.chapters[0]?.grade ?? null);
      })
      .catch((e: unknown) => setProblem(errorText(e, "Couldn't load the chapters.")));
    if (quiz) {
      api<{ questions: Question[] }>(`/api/admin/quizzes/questions?ids=${quiz.questionIds.map(encodeURIComponent).join(",")}`)
        .then((r) => setQuestions(r.questions))
        .catch((e: unknown) => setProblem(errorText(e, "Couldn't load the quiz's questions.")));
    }
  }, [quiz]);

  const grades = useMemo(() => [...new Set(chapters?.map((c) => c.grade))].sort((a, b) => a - b), [chapters]);
  const inGrade = chapters?.filter((c) => c.grade === grade) ?? [];
  const subjects = [...new Set(inGrade.map((c) => c.subject))];
  const shown = subject === "all" ? inGrade : inGrade.filter((c) => c.subject === subject);
  const allShownPicked = shown.length > 0 && shown.every((c) => picked.has(c.key));
  const toggleShown = () =>
    setPicked((p) => {
      const n = new Set(p);
      for (const c of shown) {
        if (allShownPicked) n.delete(c.key);
        else n.add(c.key);
      }
      return n;
    });

  const draw = async () => {
    setProblem(null);
    const n = Math.round(Number(count));
    if (!picked.size) return setProblem("Tick at least one chapter to draw questions from.");
    if (!(n >= 1 && n <= 100)) return setProblem("Draw between 1 and 100 questions at a time.");
    setBusy(true);
    try {
      const r = await api<{ questions: Question[] }>("/api/admin/quizzes/draw", { chapters: [...picked], count: n, exclude: questions?.map((q) => q.id) ?? [] });
      if (!r.questions.length) setProblem("No more questions left in those chapters.");
      setQuestions((qs) => [...(qs ?? []), ...r.questions]);
    } catch (e) {
      setProblem(errorText(e, "Couldn't draw questions."));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setProblem(null);
    if (!questions?.length) return setProblem("Add at least one question.");
    const body: QuizIn = {
      ...(quiz ? { id: quiz.id } : {}),
      title: title.trim(),
      description: description.trim(),
      startsAt: fromLocalInput(startsAt),
      endsAt: fromLocalInput(endsAt),
      durationMin: Math.round(Number(durationMin)),
      passPercent: Math.round(Number(passPercent)),
      questionIds: questions.map((q) => q.id),
    };
    if (body.title.length < 3) return setProblem("Give the quiz a title.");
    if (!Number.isFinite(body.startsAt) || !Number.isFinite(body.endsAt)) return setProblem("Set the start and end time.");
    if (body.endsAt <= body.startsAt) return setProblem("The quiz must end after it starts.");
    setBusy(true);
    try {
      await api("/api/admin/quizzes/save", body);
      onSaved(quiz ? "Quiz updated." : "Quiz scheduled! It shows on the home page for every student.");
    } catch (e) {
      setProblem(errorText(e, "Couldn't save the quiz."));
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5">
      {locked && (
        <p className="flex items-start gap-2 rounded-2xl bg-brand-soft p-4 text-sm font-semibold">
          <Lock className="mt-0.5 size-4 shrink-0 text-brand" />
          {quiz.participants} student{quiz.participants === 1 ? " has" : "s have"} already started, so only the title, description and end time can change.
        </p>
      )}
      <section className="grid gap-4 rounded-[24px] border-2 border-line bg-surface p-5">
        <div>
          <label htmlFor="quiz-title" className={label}>
            Title
          </label>
          <input id="quiz-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Science Super Quiz: Class 9" className={field} />
        </div>
        <div>
          <label htmlFor="quiz-desc" className={label}>
            Description (optional)
          </label>
          <textarea
            id="quiz-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="What it covers, who it's for…"
            className={clsx(field, "resize-y")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="quiz-start" className={label}>
              Opens at
            </label>
            <input id="quiz-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} disabled={locked} className={field} />
          </div>
          <div>
            <label htmlFor="quiz-end" className={label}>
              Closes at
            </label>
            <input id="quiz-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="quiz-duration" className={label}>
              Time limit (minutes)
            </label>
            <input id="quiz-duration" type="number" min={1} max={600} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} disabled={locked} className={field} />
          </div>
          <div>
            <label htmlFor="quiz-pass" className={label}>
              Pass mark (%) for a certificate
            </label>
            <input id="quiz-pass" type="number" min={1} max={100} value={passPercent} onChange={(e) => setPassPercent(e.target.value)} disabled={locked} className={field} />
          </div>
        </div>
        <p className="text-xs text-muted">Students can start any time between opening and closing. Each gets the time limit from when they start, never past the closing time.</p>
      </section>

      <section className="rounded-[24px] border-2 border-line bg-surface p-5">
        <h2 className="font-display text-lg font-extrabold">Questions {questions ? `(${questions.length})` : ""}</h2>
        {!locked && (
          <div className="mt-3 rounded-2xl bg-surface-2 p-4">
            <p className="text-sm font-bold">Draw random questions from chapters</p>
            {chapters ? (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  {grades.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setGrade(g);
                        setSubject("all");
                      }}
                      className={clsx("rounded-full border-2 px-3 py-1 text-sm font-bold", grade === g ? "border-fg bg-fg text-bg" : "border-line bg-surface")}
                    >
                      {region.gradeLabel(g)}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {(["all", ...subjects] as const).map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      aria-pressed={subject === sub}
                      onClick={() => setSubject(sub)}
                      className={clsx(
                        "rounded-full border-2 px-2.5 py-0.5 text-xs font-bold",
                        subject === sub ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface hover:border-fg/30",
                      )}
                    >
                      {sub === "all" ? "All subjects" : region.subjects[sub]}
                    </button>
                  ))}
                  {shown.length > 0 && (
                    <button type="button" onClick={toggleShown} className="ml-auto text-xs font-bold text-brand hover:underline">
                      {allShownPicked ? "Untick all shown" : "Tick all shown"}
                    </button>
                  )}
                </div>
                <ul className="mt-3 grid max-h-64 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
                  {shown.map((c) => (
                    <li key={c.key}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface">
                        <input
                          type="checkbox"
                          checked={picked.has(c.key)}
                          onChange={() =>
                            setPicked((p) => {
                              const n = new Set(p);
                              if (n.has(c.key)) n.delete(c.key);
                              else n.add(c.key);
                              return n;
                            })
                          }
                          className="mt-0.5 size-4 shrink-0 accent-brand"
                        />
                        <span>
                          <span className="font-semibold">{region.subjects[c.subject]}</span> · {c.title} <span className="text-muted">({c.count})</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(e.target.value)} aria-label="How many questions" className={clsx(field, "w-24")} />
                  <Button variant="dark" className="px-4 py-2.5 text-sm" onClick={() => void draw()} disabled={busy}>
                    <Dices className="size-4" /> Add random questions
                  </Button>
                  {picked.size > 0 && <span className="text-xs text-muted">from {picked.size} chapter{picked.size === 1 ? "" : "s"}</span>}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">Loading chapters…</p>
            )}
          </div>
        )}
        {!questions ? (
          <Spinner />
        ) : questions.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No questions yet. Tick some chapters above and add random questions.</p>
        ) : (
          <ol className="mt-4 grid gap-2">
            <AnimatePresence initial={false}>
              {questions.map((q, i) => (
                <motion.li
                  key={q.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  className="flex items-start gap-3 rounded-2xl border-2 border-line px-3 py-2.5"
                >
                  <span className="mt-0.5 font-display font-extrabold tabular-nums text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-semibold">
                      <RichText text={q.prompt} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Chip>{region.subjects[q.subject]}</Chip>
                      <Chip>{q.chapter}</Chip>
                      <Chip>{TYPE_LABEL[q.type]}</Chip>
                    </div>
                  </div>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => setQuestions((qs) => qs!.filter((x) => x.id !== q.id))}
                      aria-label="Remove question"
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
      </section>

      {problem && (
        <p role="alert" className="font-semibold text-bad">
          {problem}
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="ok" className="flex-1" onClick={() => void save()} disabled={busy || !questions}>
          {busy ? "Saving…" : quiz ? "Save changes" : "Schedule quiz"}
        </Button>
      </div>
    </div>
  );
}

/** The quiz's certificate: its wording, signature and colours, with a live preview on a sample student. */
function CertificateEditor({ quiz, onSaved, onCancel }: { quiz: AdminQuiz; onSaved: (message: string) => void; onCancel: () => void }) {
  const [format, setFormat] = useState<CertificateFormat>(quiz.certificate);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (patch: Partial<CertificateFormat>) => setFormat((f) => ({ ...f, ...patch }));

  // Redrawn a moment after typing stops.
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    const t = window.setTimeout(() => {
      renderCertificate({ id: "SAMPLE2026", name: "Aarav Sharma", quizTitle: quiz.title, percent: 85, issuedAt: Date.now(), format })
        .then((blob) => {
          url = URL.createObjectURL(blob);
          if (live) setPreview(url);
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
      if (url) URL.revokeObjectURL(url);
    };
  }, [format, quiz.title]);

  const save = async () => {
    setProblem(null);
    const parsed = CertificateFormat.safeParse(format);
    if (!parsed.success) return setProblem("Fill in the heading and both wording lines.");
    setBusy(true);
    try {
      const isDefault = JSON.stringify(parsed.data) === JSON.stringify(DEFAULT_CERTIFICATE);
      await api("/api/admin/quizzes/certificate", { id: quiz.id, format: isDefault ? null : parsed.data } satisfies CertificateIn);
      onSaved(quiz.passedCount ? "Certificate saved. Certificates already won show the new design too." : "Certificate saved.");
    } catch (e) {
      setProblem(errorText(e, "Could not save the certificate."));
      setBusy(false);
    }
  };

  const text = (id: keyof CertificateFormat, labelText: string, max: number, placeholder?: string) => (
    <div>
      <label htmlFor={`cert-${id}`} className={label}>
        {labelText}
      </label>
      <input
        id={`cert-${id}`}
        value={format[id] as string}
        maxLength={max}
        placeholder={placeholder}
        onChange={(e) => set({ [id]: e.target.value })}
        className={field}
      />
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
      <section className="grid gap-4 rounded-[24px] border-2 border-line bg-surface p-5">
        {text("heading", "Heading", 60)}
        {text("presentedTo", "Line above the name", 80)}
        {text("reason", "Line above the quiz title", 80)}
        {text("title", "Quiz title on the certificate (optional)", 120, quiz.title)}
        {text("note", "Extra line under the quiz title (optional)", 120, "e.g. Organised by Vijayeemantra Academy")}
        <div className="grid gap-4 sm:grid-cols-2">
          {text("signName", "Signed by (optional)", 60, "e.g. Sreejesh")}
          {text("signTitle", "Their title", 60, "e.g. Founder")}
        </div>
        <fieldset>
          <legend className={label}>Colour</legend>
          <div className="flex flex-wrap gap-2">
            {CERTIFICATE_THEMES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={format.theme === t}
                onClick={() => set({ theme: t })}
                className={clsx(
                  "flex items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3 text-sm font-bold capitalize",
                  format.theme === t ? "border-fg" : "border-line hover:border-fg/30",
                )}
              >
                <span className="grid size-6 place-items-center rounded-full text-white" style={{ background: THEME_COLORS[t].main }}>
                  {format.theme === t && <Check className="size-4" strokeWidth={3} />}
                </span>
                {t}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
          <input type="checkbox" checked={format.showScore} onChange={(e) => set({ showScore: e.target.checked })} className="size-5 accent-brand" />
          Show the student's score on the seal (otherwise it says “Passed”)
        </label>
        {problem && (
          <p role="alert" className="font-semibold text-bad">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" className="px-4 py-2.5 text-sm" onClick={() => setFormat(DEFAULT_CERTIFICATE)} disabled={busy}>
            <RotateCcw className="size-4" /> Default
          </Button>
          <Button variant="ghost" className="px-4 py-2.5 text-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="ok" className="flex-1 px-5 py-2.5 text-sm" onClick={() => void save()} disabled={busy}>
            <Check className="size-4" /> {busy ? "Saving…" : "Save certificate"}
          </Button>
        </div>
      </section>
      <section className="rounded-[24px] border-2 border-line bg-surface p-4 lg:sticky lg:top-4">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">Preview · sample student</p>
        <div className="overflow-hidden rounded-xl border-2 border-line bg-surface-2">
          {preview ? (
            <img src={preview} alt="Certificate preview" className="block w-full" />
          ) : (
            <div className="grid aspect-[2000/1414] place-items-center text-muted">
              <Loader2 className="size-8 animate-spin" />
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">Students who pass get this with their own name, score, date and certificate number.</p>
      </section>
    </div>
  );
}

function Results({ quiz }: { quiz: AdminQuiz }) {
  const [rows, setRows] = useState<AdminQuizResults["rows"] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const load = useCallback(async () => {
    setProblem(null);
    try {
      setRows((await api<AdminQuizResults>(`/api/admin/quizzes/results?quiz=${encodeURIComponent(quiz.id)}`)).rows);
    } catch (e) {
      setProblem(errorText(e, "Couldn't load the results."));
    }
  }, [quiz.id]);
  useEffect(() => {
    void load();
  }, [load]);
  if (problem) return <Problem message={problem} onRetry={() => void load()} />;
  if (!rows) return <Spinner />;
  if (!rows.length) return <p className="rounded-[24px] border-2 border-line bg-surface p-8 text-center font-semibold text-muted">Nobody has taken this quiz yet.</p>;
  return (
    <div className="overflow-x-auto rounded-[24px] border-2 border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b-2 border-line text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Student</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Certificate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.email} className="border-b border-line last:border-0">
              <td className="px-4 py-2.5 font-bold tabular-nums">{i + 1}</td>
              <td className="px-4 py-2.5">
                <span className="block font-semibold">{r.name}</span>
                <span className="text-xs text-muted">{r.email}</span>
              </td>
              <td className="px-4 py-2.5 font-display font-extrabold tabular-nums">{r.status === "submitted" ? `${r.percent}%` : <span className="text-muted">In progress</span>}</td>
              <td className="px-4 py-2.5 tabular-nums">{r.submittedAt ? clock(r.submittedAt - r.startedAt) : "–"}</td>
              <td className="px-4 py-2.5">
                {r.certificateId ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-ok">
                    <Award className="size-4" /> {r.certificateId}
                  </span>
                ) : (
                  <span className="text-muted">–</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuizAdminScreen() {
  const go = useNav((s) => s.go);
  const [quizzes, setQuizzes] = useState<AdminQuiz[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });
  const [toast, setToast] = useState<string | null>(null);
  const now = useServerNow();

  const load = useCallback(async () => {
    setProblem(null);
    try {
      // The public list carries the server's clock, so the live / upcoming badges match it.
      const [mine, clockNow] = await Promise.all([api<{ quizzes: AdminQuiz[] }>("/api/admin/quizzes"), api<{ now: number }>("/api/quizzes")]);
      syncClock(clockNow.now);
      setQuizzes(mine.quizzes);
    } catch (e) {
      setProblem(errorText(e, "Couldn't load the quizzes."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const remove = async (quiz: AdminQuiz) => {
    const warn = quiz.participants ? ` ${quiz.participants} student${quiz.participants === 1 ? "'s attempt and certificate" : "s' attempts and certificates"} will be deleted too.` : "";
    if (!window.confirm(`Delete "${quiz.title}"?${warn}`)) return;
    try {
      await api("/api/admin/quizzes/delete", { id: quiz.id });
      setToast("Quiz deleted.");
      await load();
    } catch (e) {
      setToast(errorText(e, "Couldn't delete the quiz."));
    }
  };

  const canShare = typeof navigator.share === "function";
  const share = async (q: AdminQuiz) => {
    try {
      await navigator.share({ title: q.title, text: inviteText(q) });
    } catch {
      // Share menu closed.
    }
  };

  const title =
    view.kind === "edit" ? (view.quiz ? "Edit quiz" : "New quiz") : view.kind === "results" ? view.quiz.title : view.kind === "certificate" ? "Certificate" : "Quizzes";

  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        <Header
          title={title}
          subtitle={view.kind === "list" ? "Scheduled quizzes with certificates for those who pass" : undefined}
          onBack={() => (view.kind === "list" ? go("admin") : setView({ kind: "list" }))}
        />
        {view.kind === "edit" ? (
          <QuizEditor
            quiz={view.quiz}
            onCancel={() => setView({ kind: "list" })}
            onSaved={(message) => {
              setToast(message);
              setView({ kind: "list" });
              void load();
            }}
          />
        ) : view.kind === "results" ? (
          <Results quiz={view.quiz} />
        ) : view.kind === "certificate" ? (
          <CertificateEditor
            quiz={view.quiz}
            onCancel={() => setView({ kind: "list" })}
            onSaved={(message) => {
              setToast(message);
              setView({ kind: "list" });
              void load();
            }}
          />
        ) : problem ? (
          <Problem message={problem} onRetry={() => void load()} />
        ) : !quizzes ? (
          <Spinner />
        ) : (
          <>
            <Button className="mb-5" onClick={() => setView({ kind: "edit", quiz: null })}>
              <Plus className="size-5" /> New quiz
            </Button>
            {quizzes.length === 0 ? (
              <p className="rounded-[24px] border-2 border-line bg-surface p-8 text-center font-semibold text-muted">No quizzes yet. Schedule the first one!</p>
            ) : (
              <ul className="grid gap-3">
                {quizzes.map((q, i) => (
                  <motion.li
                    key={q.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-[24px] border-2 border-line bg-surface p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <PhaseBadge quiz={q} now={now} />
                      <span className="text-xs text-muted">created by {q.createdBy}</span>
                    </div>
                    <h2 className="mt-2 font-display text-xl font-extrabold">{q.title}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      <span className="flex items-center gap-1">
                        <CalendarClock className="size-4" /> {formatWhen(q.startsAt)} – {formatWhen(q.endsAt)}
                      </span>
                      <span>
                        {q.questionCount} questions · {q.durationMin} min · pass {q.passPercent}%
                      </span>
                    </p>
                    <p className="mt-2 flex items-center gap-3 text-sm font-semibold">
                      <span className="flex items-center gap-1">
                        <Users className="size-4 text-brand" /> {q.participants} took part
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="size-4 text-[#c8962a]" /> {q.passedCount} passed
                      </span>
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-2 pl-3">
                      <span className="min-w-0 flex-1 truncate font-mono text-sm text-muted" title={quizUrl(q.id)}>
                        {quizUrl(q.id)}
                      </span>
                      <Button className="px-4 py-2 text-sm" onClick={() => void copy(quizUrl(q.id)).then((ok) => ok && setToast("Link copied. Paste it anywhere to share."))}>
                        <Link2 className="size-4" /> Copy link
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-4 py-2 text-sm"
                        onClick={() => void copy(inviteText(q)).then((ok) => ok && setToast("Invite copied. Paste it into WhatsApp groups."))}
                      >
                        <MessageSquareText className="size-4" /> Copy invite
                      </Button>
                      {canShare && (
                        <Button variant="ghost" className="px-4 py-2 text-sm" onClick={() => void share(q)} aria-label="Share">
                          <Share2 className="size-4" />
                        </Button>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="ghost" className="px-4 py-2 text-sm" onClick={() => setView({ kind: "edit", quiz: q })}>
                        <PencilLine className="size-4" /> Edit
                      </Button>
                      <Button variant="ghost" className="px-4 py-2 text-sm" onClick={() => setView({ kind: "certificate", quiz: q })}>
                        <Award className="size-4" /> Certificate
                      </Button>
                      <Button variant="ghost" className="px-4 py-2 text-sm" onClick={() => setView({ kind: "results", quiz: q })}>
                        <BarChart3 className="size-4" /> Results
                      </Button>
                      <Button variant="ghost" className="px-4 py-2 text-sm text-bad" onClick={() => void remove(q)}>
                        <Trash2 className="size-4" /> Delete
                      </Button>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <AnimatePresence>
        {toast && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-xl rounded-2xl bg-fg px-4 py-3 text-center text-sm font-bold text-bg shadow-pop"
          >
            {toast}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
