import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Play } from "lucide-react";

const SPARKS = [
  { x: "8%", y: "16%", d: 0 },
  { x: "88%", y: "10%", d: 0.5 },
  { x: "96%", y: "62%", d: 1 },
  { x: "0%", y: "68%", d: 1.4 },
];

/** A game controller wearing a graduation cap: play and study in one picture. */
function StudyGameLogo() {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="relative mx-auto block size-28"
      animate={reduce ? undefined : { y: [0, -6, 0], rotate: [-3, 3, -3] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    >
      <svg viewBox="0 0 120 120" className="size-full drop-shadow-[0_8px_24px_rgba(236,72,153,0.55)]">
        <defs>
          <linearGradient id="study-game-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5b5ef0" />
            <stop offset="0.55" stopColor="#c026d3" />
            <stop offset="1" stopColor="#ff8a1f" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="112" height="112" rx="30" fill="url(#study-game-bg)" />
        <path d="M4 34 Q4 4 34 4 H86 Q116 4 116 34 Q60 62 4 34 Z" fill="#fff" opacity="0.14" />
        <path d="M38 58 H82 C94 58 101 68 103 84 C104.5 95 95 101 88 94 L79 85 H41 L32 94 C25 101 15.5 95 17 84 C19 68 26 58 38 58 Z" fill="#fff" />
        <path d="M37 65 H44 V72 H51 V79 H44 V86 H37 V79 H30 V72 H37 Z" fill="#3b1d8f" />
        <circle cx="79" cy="69" r="5.5" fill="#ffb01f" />
        <circle cx="89" cy="78" r="5.5" fill="#0f9f5f" />
        <path d="M43 34 V46 C43 51 50 55 60 55 C70 55 77 51 77 46 V34 L60 42 Z" fill="#2c2f5c" />
        <path d="M60 14 L94 29 L60 44 L26 29 Z" fill="#1b1f3b" />
        <path d="M94 29 V47" stroke="#ffd23f" strokeWidth="3" strokeLinecap="round" />
        <circle cx="94" cy="50" r="4.5" fill="#ffd23f" />
      </svg>
      {SPARKS.map((s) => (
        <motion.span
          key={s.x}
          className="absolute text-lg leading-none text-[#ffd23f]"
          style={{ left: s.x, top: s.y }}
          animate={reduce ? undefined : { scale: [0.4, 1.2, 0.4], opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: s.d }}
        >
          ✦
        </motion.span>
      ))}
    </motion.span>
  );
}

/** Offered once in a round: a break that is still studying. The round waits while the student plays. */
export function GamesOffer({ open, onPlay, onClose }: { open: boolean; onPlay: () => void; onClose: () => void }) {
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
          className="fixed inset-0 z-50 grid place-items-end bg-fg/50 backdrop-blur-sm sm:place-items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="games-offer-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 80, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="relative max-h-dvh w-full max-w-md overflow-y-auto rounded-t-[28px] bg-[#0b1030] text-center text-white shadow-pop sm:rounded-[28px]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_15%_0%,rgba(124,58,237,0.6),transparent),radial-gradient(60%_60%_at_95%_20%,rgba(236,72,153,0.45),transparent)]" />
            <button type="button" onClick={onPlay} className="group relative block w-full px-6 pt-7">
              <StudyGameLogo />
              <span className="mt-4 block text-xs font-extrabold uppercase tracking-[0.2em] text-[#ffd23f]">Games for study</span>
              <span id="games-offer-title" className="mt-1 block font-display text-3xl font-extrabold tracking-tight">
                Learn while you play
              </span>
              <span className="mt-2 block text-[15px] font-semibold text-white/80">
                Take a short break with quick games for your CBSE subjects. Your score is safe, and Back brings you right here.
              </span>
              <span className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ffd23f] to-[#ff8a1f] px-4 py-3.5 font-display text-lg font-extrabold text-[#1b1f3b] shadow-[0_4px_0_0_rgb(0_0_0/0.35)] transition-transform group-hover:scale-[1.02] group-active:scale-[0.98]">
                <Play className="size-5 fill-current" /> Show me the games
              </span>
            </button>
            <div className="relative px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
              {/* Focused so Enter, the key for checking answers, keeps practising rather than leaving the round. */}
              <button type="button" onClick={onClose} autoFocus className="w-full rounded-xl py-3 font-bold text-white/75 hover:text-white">
                Keep practising
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
