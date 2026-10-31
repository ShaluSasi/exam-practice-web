import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Flag, PencilLine, X } from "lucide-react";
import clsx from "clsx";
import type { ReportIn, ReportReason } from "../content/api";
import { QuestionEdit, editBetween, editedQuestion, isEmptyEdit } from "../content/edit";
import type { Question } from "../content/schema";
import { api, useAuth } from "../store/auth";
import { SignInButton } from "./Account";
import { Button } from "./Button";
import { QuestionEditor } from "./QuestionEditor";

export const REASON_LABEL: Record<ReportReason, string> = {
  wrong_answer: "The answer is wrong",
  question_error: "Mistake in the question or options",
  unclear: "Hard to understand",
  image: "Problem with the picture",
  other: "Something else",
};

/** The report form, for a question the student has answered (so its answer is known). */
function ReportForm({ question, onClose }: { question: Question; onClose: () => void }) {
  const remarkId = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [remark, setRemark] = useState("");
  const [suggest, setSuggest] = useState(false);
  const [draft, setDraft] = useState(question);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setProblem(null);
    if (!reason) return setProblem("Pick what kind of problem it is.");
    if (remark.trim().length < 3) return setProblem("Tell us what the problem is in a few words.");
    let proposal: QuestionEdit | undefined;
    if (suggest) {
      const parsed = QuestionEdit.safeParse(editBetween(question, draft));
      if (!parsed.success || !editedQuestion(question, parsed.data)) return setProblem("Your fix has an empty field or no correct answer ticked.");
      if (!isEmptyEdit(parsed.data)) proposal = parsed.data;
    }
    setSending(true);
    try {
      await api("/api/reports", { questionId: question.id, reason, remark: remark.trim(), ...(proposal ? { proposal } : {}) } satisfies ReportIn);
      setSent(true);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Couldn't send the report. Try again.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="py-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-ok text-white">
          <Check className="size-7" strokeWidth={3} />
        </span>
        <h2 className="mt-4 font-display text-2xl font-extrabold">Thanks for reporting!</h2>
        <p className="mt-1 text-muted">Our team will check it. If you're right, the question gets fixed for everyone.</p>
        <Button className="mt-6" onClick={onClose}>
          Back to practice
        </Button>
      </div>
    );
  }

  return (
    <>
      <fieldset>
        <legend className="mb-2 font-display font-extrabold">What's wrong?</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REASON_LABEL) as ReportReason[]).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={reason === r}
              onClick={() => setReason(r)}
              className={clsx(
                "rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition",
                reason === r ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface hover:border-fg/30",
              )}
            >
              {REASON_LABEL[r]}
            </button>
          ))}
        </div>
      </fieldset>

      <label htmlFor={remarkId} className="mb-2 mt-5 block font-display font-extrabold">
        Your remark
      </label>
      <textarea
        id={remarkId}
        value={remark}
        onChange={(e) => setRemark(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="e.g. Option B is also correct, because…"
        className="w-full resize-y rounded-xl border-2 border-line bg-bg px-3 py-2 outline-none focus:border-brand"
      />

      <div className="mt-5 rounded-2xl border-2 border-line">
        <button
          type="button"
          aria-expanded={suggest}
          onClick={() => setSuggest((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <PencilLine className="size-5 shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <span className="block font-display font-extrabold">Suggest a fix (optional)</span>
            <span className="block text-sm text-muted">Rewrite the question, options, answer or explanation the way they should be.</span>
          </span>
          <span className={clsx("size-5 shrink-0 rounded-md border-2", suggest ? "border-brand bg-brand" : "border-line")}>
            {suggest && <Check className="size-4 text-brand-ink" strokeWidth={3} />}
          </span>
        </button>
        {suggest && (
          <div className="border-t-2 border-line p-4">
            <QuestionEditor value={draft} onChange={setDraft} />
          </div>
        )}
      </div>

      {problem && (
        <p role="alert" className="mt-4 text-sm font-semibold text-bad">
          {problem}
        </p>
      )}
      <div className="mt-5 flex gap-3">
        <Button variant="ghost" onClick={onClose} disabled={sending}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={() => void send()} disabled={sending}>
          <Flag className="size-5" /> {sending ? "Sending…" : "Send report"}
        </Button>
      </div>
    </>
  );
}

/** "Report a problem" with a question, as a sheet over the practice screen. Guests are asked to sign in first. */
export function ReportSheet({ question, onClose }: { question: Question | null; onClose: () => void }) {
  const status = useAuth((s) => s.status);

  useEffect(() => {
    if (!question) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [question, onClose]);

  return (
    <AnimatePresence>
      {question && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-end bg-fg/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] border-2 border-line bg-surface p-5 pb-8 shadow-pop sm:rounded-[28px] sm:p-6"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-5" />
            </button>
            <h2 id="report-title" className="mb-4 flex items-center gap-2 pr-10 font-display text-2xl font-extrabold tracking-tight">
              <Flag className="size-6 text-bad" /> Report a problem
            </h2>
            {status === "signedIn" ? (
              <ReportForm question={question} onClose={onClose} />
            ) : status === "signedOut" ? (
              <div className="py-4 text-center">
                <p className="text-muted">Sign in with Google to report a problem with this question.</p>
                <div className="mt-5">
                  <SignInButton />
                </div>
              </div>
            ) : (
              <p className="py-4 text-center text-muted">
                {status === "loading" ? "Checking your sign-in…" : "Reporting needs a connection to the server. Please try again later."}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
