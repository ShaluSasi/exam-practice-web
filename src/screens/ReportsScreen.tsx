import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, ChevronDown, Flag, PencilLine, X } from "lucide-react";
import clsx from "clsx";
import { region } from "../config/regions";
import type { AdminReport, AdminReportGroup, AdminReports, ReportStatus, ResolveReportIn } from "../content/api";
import { CHOICE_LISTS, QuestionEdit, choicesOf, editBetween, editedQuestion, isEmptyEdit } from "../content/edit";
import type { Question } from "../content/schema";
import { AnswerDetails, Chip, Header, Problem, Spinner, TYPE_LABEL, formatDate } from "../components/AdminParts";
import { Button } from "../components/Button";
import { QuestionEditor } from "../components/QuestionEditor";
import { REASON_LABEL } from "../components/ReportSheet";
import { RichText } from "../components/RichText";
import { api } from "../store/auth";
import { useNav } from "../store/nav";

const TABS: { status: ReportStatus; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" },
];

/** What a choice ID shows as: the option's text, or the assertion–reason option, or the spot's label. */
function answerText(q: Question, id: string): string {
  if (q.type === "assertion_reason") return region.assertionReasonOptions.find((o) => o.id === id)?.text ?? id;
  if (q.type === "hotspot") return q.spots.find((s) => s.id === id)?.label ?? id;
  if (q.type === "mcq" || q.type === "multi") return q.options.find((o) => o.id === id)?.text ?? id;
  return id;
}

/** Each field an edit changes, as it is now and as it would be. */
function changesOf(q: Question, edit: QuestionEdit): { label: string; before: string; after: string }[] {
  const out: { label: string; before: string; after: string }[] = [];
  const now = q as Record<string, unknown>;
  const text: [keyof QuestionEdit, string][] = [
    ["prompt", "Question"],
    ["assertion", "Assertion"],
    ["reason", "Reason"],
  ];
  for (const [k, label] of text) if (typeof edit[k] === "string") out.push({ label, before: String(now[k] ?? ""), after: edit[k] as string });
  for (const [key, after] of Object.entries(edit.texts ?? {})) {
    const [list, id] = key.split(".") as [keyof typeof CHOICE_LISTS, string];
    const before = choicesOf(q, list)?.find((c) => c.id === id)?.text;
    if (before !== undefined) out.push({ label: CHOICE_LISTS[list] ?? list, before, after });
  }
  // Answers are shown with the edited choice texts, so a renamed right option reads correctly.
  const edited = editedQuestion(q, edit) ?? q;
  if (edit.answer !== undefined && "answer" in q && typeof q.answer === "string") {
    out.push({ label: "Correct answer", before: answerText(q, q.answer), after: answerText(edited, edit.answer) });
  }
  if (edit.answers !== undefined && q.type === "multi") {
    out.push({
      label: "Correct answers",
      before: q.answers.map((a) => answerText(q, a)).join(" · "),
      after: edit.answers.map((a) => answerText(edited, a)).join(" · "),
    });
  }
  if (edit.hint !== undefined) out.push({ label: "Hint", before: q.hint ?? "", after: edit.hint });
  if (edit.explanation !== undefined) out.push({ label: "Explanation", before: q.explanation, after: edit.explanation });
  return out;
}

function ChangeList({ q, edit }: { q: Question; edit: QuestionEdit }) {
  const changes = changesOf(q, edit);
  if (!changes.length) return <p className="text-sm text-muted">No changes.</p>;
  return (
    <ul className="grid gap-2">
      {changes.map((c, i) => (
        <li key={i} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-muted">{c.label}</p>
          <div className="grid gap-1 sm:grid-cols-[1fr_auto_1fr] sm:items-start sm:gap-2">
            <div className="text-bad line-through decoration-bad/60">{c.before ? <RichText text={c.before} /> : <em>none</em>}</div>
            <ArrowRight className="hidden size-4 shrink-0 text-muted sm:mt-0.5 sm:block" />
            <div className="font-semibold text-ok">{c.after ? <RichText text={c.after} /> : <em>removed</em>}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Approve, modify or reject one open report. */
function Actions({ report, question, onResolve }: { report: AdminReport; question: Question | null; onResolve: (body: ResolveReportIn) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Question | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (body: ResolveReportIn) => {
    setBusy(true);
    setProblem(null);
    try {
      await onResolve({ ...body, ...(note.trim() ? { note: note.trim() } : {}) });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  };

  const startEditing = () => {
    if (!question) return;
    setDraft((report.proposal && editedQuestion(question, report.proposal)) || question);
    setEditing(true);
  };

  const submitEdit = () => {
    if (!question || !draft) return;
    const parsed = QuestionEdit.safeParse(editBetween(question, draft));
    if (!parsed.success || !editedQuestion(question, parsed.data)) return setProblem("A field is empty or no correct answer is ticked.");
    if (isEmptyEdit(parsed.data)) return setProblem("Nothing has been changed. Use “Approve without change” instead.");
    void run({ id: report.id, action: "approve", edit: parsed.data });
  };

  const pending = question && draft ? QuestionEdit.safeParse(editBetween(question, draft)) : null;

  return (
    <div className="mt-3 grid gap-3 border-t-2 border-dashed border-line pt-3">
      {editing && question && draft && (
        <div className="grid gap-4 rounded-2xl border-2 border-brand/40 p-4">
          <p className="flex items-center gap-2 font-display font-extrabold">
            <PencilLine className="size-5 text-brand" /> Modify the question
          </p>
          <QuestionEditor value={draft} onChange={setDraft} />
          {pending?.success && !isEmptyEdit(pending.data) && (
            <div>
              <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-muted">What students will see change</p>
              <ChangeList q={question} edit={pending.data} />
            </div>
          )}
        </div>
      )}
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        placeholder="Note (optional), e.g. why it was rejected"
        aria-label="Admin note"
        className="w-full rounded-xl border-2 border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
      />
      {problem && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" className="px-4 py-2.5 text-sm" disabled={busy} onClick={() => void run({ id: report.id, action: "reject" })}>
          <X className="size-4" /> Reject
        </Button>
        {editing ? (
          <>
            <Button variant="ghost" className="px-4 py-2.5 text-sm" disabled={busy} onClick={() => setEditing(false)}>
              Cancel edit
            </Button>
            <Button variant="ok" className="px-5 py-2.5 text-sm" disabled={busy} onClick={submitEdit}>
              <Check className="size-4" /> {busy ? "Saving…" : "Submit change"}
            </Button>
          </>
        ) : (
          <>
            {question && (
              <Button variant="ghost" className="px-4 py-2.5 text-sm" disabled={busy} onClick={startEditing}>
                <PencilLine className="size-4" /> {report.proposal ? "Modify" : "Edit question"}
              </Button>
            )}
            <Button variant="ok" className="px-5 py-2.5 text-sm" disabled={busy} onClick={() => void run({ id: report.id, action: "approve" })}>
              <Check className="size-4" /> {busy ? "Saving…" : report.proposal && question ? "Approve fix" : "Approve without change"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ReportItem({ report, question, onResolve }: { report: AdminReport; question: Question | null; onResolve: (body: ResolveReportIn) => Promise<void> }) {
  const shown = report.applied ?? report.proposal;
  return (
    <li className="rounded-2xl border-2 border-line bg-bg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip icon={Flag} className="bg-bad-soft text-bad">
          {REASON_LABEL[report.reason]}
        </Chip>
        <span className="text-sm font-semibold">{report.reporter.name}</span>
        <span className="text-xs text-muted">
          {report.reporter.email} · {formatDate(report.createdAt)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap">{report.remark}</p>
      {shown && question && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-muted">
            {report.applied ? "Change applied" : "Student's suggested fix"}
          </p>
          <ChangeList q={question} edit={shown} />
        </div>
      )}
      {report.status !== "open" && (
        <p className="mt-3 text-sm text-muted">
          {report.status === "approved" ? "Approved" : "Rejected"} by {report.resolvedBy}
          {report.resolvedAt ? ` on ${formatDate(report.resolvedAt)}` : ""}
          {report.adminNote ? ` · “${report.adminNote}”` : ""}
        </p>
      )}
      {report.status === "open" && <Actions report={report} question={question} onResolve={onResolve} />}
    </li>
  );
}

function GroupCard({ group, onResolve }: { group: AdminReportGroup; onResolve: (body: ResolveReportIn) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const q = group.question;
  return (
    <motion.article layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[24px] border-2 border-line bg-surface p-5">
      {q ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Chip>
              {region.gradeLabel(q.grade)} · {region.subjects[q.subject] ?? q.subject}
            </Chip>
            <Chip>{q.chapter}</Chip>
            <Chip>{TYPE_LABEL[q.type]}</Chip>
            {group.edited && (
              <Chip icon={PencilLine} className="bg-brand-soft text-brand">
                Edited before
              </Chip>
            )}
          </div>
          <div className="mt-3 font-display text-lg font-bold leading-snug">
            <RichText text={q.prompt} />
          </div>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="mt-2 flex items-center gap-1 text-sm font-bold text-muted hover:text-fg"
          >
            <ChevronDown className={clsx("size-4 transition", open && "rotate-180")} /> {open ? "Hide" : "Show"} the question as it is now
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="pt-3">
                  <AnswerDetails q={q} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <p className="font-semibold text-muted">Question {group.questionId} is no longer in the question bank.</p>
      )}
      <p className="mb-2 mt-4 text-sm font-extrabold">
        {group.reports.length} report{group.reports.length === 1 ? "" : "s"}
      </p>
      <ul className="grid gap-3">
        {group.reports.map((r) => (
          <ReportItem key={r.id} report={r} question={q} onResolve={onResolve} />
        ))}
      </ul>
    </motion.article>
  );
}

export function ReportsScreen() {
  const go = useNav((s) => s.go);
  const [status, setStatus] = useState<ReportStatus>("open");
  const [data, setData] = useState<AdminReports | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** The tab shown now: a slow answer for another tab must not show under this one. */
  const statusRef = useRef(status);

  const load = useCallback(async (which: ReportStatus) => {
    setProblem(null);
    try {
      const reports = await api<AdminReports>(`/api/admin/reports?status=${which}`);
      if (statusRef.current === which) setData(reports);
    } catch (e) {
      if (statusRef.current === which) setProblem(e instanceof Error ? e.message : "Could not load the reports.");
    }
  }, []);

  useEffect(() => {
    statusRef.current = status;
    setData(null);
    void load(status);
  }, [status, load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const resolve = async (body: ResolveReportIn) => {
    const group = data?.groups.find((g) => g.reports.some((r) => r.id === body.id));
    const changes = !!group?.question && (!!body.edit || !!group.reports.find((r) => r.id === body.id)?.proposal);
    await api("/api/admin/reports/resolve", body);
    setToast(body.action === "reject" ? "Report rejected." : changes ? "Approved. The question is updated for everyone." : "Report approved.");
    await load(status);
  };

  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        <Header title="Reported questions" subtitle="Problems students found, with their suggested fixes" onBack={() => go("admin")} />
        <div role="tablist" className="mb-5 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.status}
              type="button"
              role="tab"
              aria-selected={status === t.status}
              onClick={() => setStatus(t.status)}
              className={clsx(
                "rounded-full border-2 px-4 py-1.5 text-sm font-bold transition",
                status === t.status ? "border-fg bg-fg text-bg" : "border-line bg-surface hover:border-fg/30",
              )}
            >
              {t.label}
              {data && <span className="ml-1.5 tabular-nums opacity-70">{data.counts[t.status]}</span>}
            </button>
          ))}
        </div>
        {problem ? (
          <Problem message={problem} onRetry={() => void load(status)} />
        ) : !data ? (
          <Spinner />
        ) : data.groups.length === 0 ? (
          <p className="rounded-[24px] border-2 border-line bg-surface p-8 text-center font-semibold text-muted">
            {status === "open" ? "No open reports. All caught up! 🎉" : `No ${status} reports yet.`}
          </p>
        ) : (
          <div className="grid gap-4">
            {data.groups.map((g) => (
              <GroupCard key={g.questionId} group={g} onResolve={resolve} />
            ))}
          </div>
        )}
      </div>
      <AnimatePresence>
        {toast && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-xl rounded-2xl bg-ok px-4 py-3 text-center text-sm font-bold text-white shadow-pop"
          >
            {toast}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
