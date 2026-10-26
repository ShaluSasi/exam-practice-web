import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, ChartColumn, Cloud, Gift, Trophy, X } from "lucide-react";
import { useAuth } from "../store/auth";
import { SignInButton } from "./Account";

const PERKS = [
  { icon: ChartColumn, text: "Track your progress in every chapter" },
  { icon: Cloud, text: "Your scores saved on every device" },
  { icon: Trophy, text: "Climb the leaderboards with friends" },
];

/** "Free" badge: the app costs nothing, and students and parents should see that up front. */
function FreeBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-ok">
      <BadgeCheck className="size-4" /> 100% free · no payment, ever
    </span>
  );
}

/**
 * Shown when a guest who has used the free round starts another one. Signing
 * in closes it and the round starts (App.tsx); "Not now" goes back.
 */
export function SignInGate({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
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
            aria-labelledby="signin-gate-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative w-full max-w-md rounded-t-[28px] border-2 border-line bg-surface p-6 pb-8 text-center shadow-pop sm:rounded-[28px] sm:pb-6"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Not now"
              className="absolute right-3 top-3 grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-5" />
            </button>
            <motion.div
              className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-[#ffc53d] to-brand text-brand-ink shadow-pop"
              initial={{ rotate: -12, scale: 0.6 }}
              animate={{ rotate: [0, -6, 6, 0], scale: 1 }}
              transition={{ duration: 0.7, delay: 0.1 }}
            >
              <Gift className="size-8" />
            </motion.div>
            <h2 id="signin-gate-title" className="mt-4 font-display text-2xl font-extrabold tracking-tight">
              You've used your free round! 🎉
            </h2>
            <p className="mt-1.5 text-muted">Sign in to keep practising. It takes one tap with Google.</p>
            <div className="mt-3">
              <FreeBadge />
            </div>
            <ul className="mx-auto mt-5 grid max-w-xs gap-2.5 text-left">
              {PERKS.map((p, i) => (
                <motion.li
                  key={p.text}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="flex items-center gap-3 text-sm font-semibold"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft">
                    <p.icon className="size-4 text-brand" />
                  </span>
                  {p.text}
                </motion.li>
              ))}
            </ul>
            <div className="mt-6">
              <SignInButton />
            </div>
            <button type="button" onClick={onClose} className="mt-4 text-sm font-semibold text-muted underline-offset-4 hover:text-fg hover:underline">
              Not now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** On a guest's results: save this score by signing in (free). Hidden once signed in or dismissed. */
export function SaveScoreCard({ freeUsed }: { freeUsed: boolean }) {
  const status = useAuth((s) => s.status);
  const [hidden, setHidden] = useState(false);
  if (status !== "signedOut" || hidden) return null;
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9, type: "spring", stiffness: 260, damping: 26 }}
      className="relative mt-6 w-full overflow-hidden rounded-[24px] border-2 border-brand/50 bg-brand-soft/60 p-5 text-center"
    >
      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-label="Maybe later"
        className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg"
      >
        <X className="size-4" />
      </button>
      <h2 className="px-6 font-display text-xl font-extrabold tracking-tight">
        {freeUsed ? "That was your free round — nice work!" : "Save this score"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {freeUsed
          ? "Sign in to save it, track your progress and keep practising every chapter."
          : "Sign in to save your scores and track your progress on every device."}
      </p>
      <div className="mt-3">
        <FreeBadge />
      </div>
      <div className="mt-4">
        <SignInButton />
      </div>
      <button type="button" onClick={() => setHidden(true)} className="mt-3 text-sm font-semibold text-muted underline-offset-4 hover:text-fg hover:underline">
        Maybe later
      </button>
    </motion.section>
  );
}
