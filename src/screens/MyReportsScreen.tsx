import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Flag, Lightbulb } from "lucide-react";
import clsx from "clsx";
import { region } from "../config/regions";
import type { MyReport, MyReports, ReportStatus } from "../content/api";
import { SignInButton } from "../components/Account";
import { Chip, Header, Problem, Spinner, formatDate } from "../components/AdminParts";
import { REASON_LABEL, REPORT_STATUSES, statusInfo } from "../components/ReportSheet";
import { RichText } from "../components/RichText";
import { api, useAuth } from "../store/auth";
import { useNav } from "../store/nav";

function ReportCard({ report, index }: { report: MyReport; index: number }) {
  const info = statusInfo(report.status);
  const q = report.question;
  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.04 }}
      className="rounded-[24px] border-2 border-line bg-surface p-5"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip className={info.className}>{info.label}</Chip>
        {q && (
          <Chip>
            {region.gradeLabel(q.grade)} · {region.subjects[q.subject] ?? q.subject}
          </Chip>
        )}
      </div>
      {q ? (
        <>
          <p className="mt-2 text-xs font-semibold text-muted">{q.chapter}</p>
          <div className="mt-1 font-display text-lg font-bold leading-snug">
            <RichText text={q.prompt} />
          </div>
        </>
      ) : (
        <p className="mt-3 font-semibold text-muted">This question is no longer in the question bank.</p>
      )}
      <div className="mt-3 rounded-2xl bg-surface-2 p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
          <Flag className="size-3.5" /> {REASON_LABEL[report.reason]}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words">{report.remark}</p>
        {report.suggestedFix && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Lightbulb className="size-3.5" /> You suggested a fix
          </p>
        )}
      </div>
      <p className="mt-3 text-xs font-semibold text-muted">
        Reported on {formatDate(report.createdAt)}
        {report.updatedAt ? ` · Updated on ${formatDate(report.updatedAt)}` : ""}
      </p>
    </motion.li>
  );
}

/** The problems a student has reported and where each one has got to. To read only: admins set the status. */
export function MyReportsScreen() {
  const go = useNav((s) => s.go);
  const authStatus = useAuth((s) => s.status);
  const [status, setStatus] = useState<ReportStatus>("new");
  const [data, setData] = useState<MyReports | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /** The filter chosen now: a slow answer for another one must not show under this one. */
  const statusRef = useRef(status);

  const load = useCallback(async (which: ReportStatus) => {
    setProblem(null);
    try {
      const reports = await api<MyReports>(`/api/reports?status=${which}`);
      if (statusRef.current === which) setData(reports);
    } catch (e) {
      if (statusRef.current === which) setProblem(e instanceof Error ? e.message : "Could not load your reports.");
    }
  }, []);

  useEffect(() => {
    statusRef.current = status;
    if (authStatus === "signedIn") void load(status);
  }, [status, authStatus, load]);

  const total = data ? REPORT_STATUSES.reduce((n, s) => n + data.counts[s.status], 0) : 0;

  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <Header title="My reported questions" onBack={() => go("home")} />
        {authStatus === "loading" ? (
          <Spinner />
        ) : authStatus === "unavailable" ? (
          <Problem message="Your reports need a connection to the server." onRetry={() => void useAuth.getState().init()} />
        ) : authStatus === "signedOut" ? (
          <div className="rounded-[24px] border-2 border-line bg-surface p-6 text-center">
            <p className="text-muted">Sign in with Google to see the problems you have reported.</p>
            <div className="mt-5">
              <SignInButton />
            </div>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="Filter by status" className="mb-5 flex flex-wrap gap-2">
              {REPORT_STATUSES.map((t) => (
                <button
                  key={t.status}
                  type="button"
                  role="tab"
                  aria-selected={status === t.status}
                  onClick={() => {
                    setData(null);
                    setStatus(t.status);
                  }}
                  className={clsx(
                    "rounded-full border-2 px-4 py-2 text-sm font-bold transition",
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
            ) : data.reports.length === 0 ? (
              <p className="rounded-[24px] border-2 border-line bg-surface p-8 text-center font-semibold text-muted">
                {total === 0
                  ? "You haven't reported anything yet. If a question looks wrong, tap the flag after answering it."
                  : `You have no ${statusInfo(status).label} reports.`}
              </p>
            ) : (
              <ul className="grid gap-3">
                {data.reports.map((r, i) => (
                  <ReportCard key={r.id} report={r} index={i} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
