import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Link2, Loader2, MessageCircle, Share2, Users, X } from "lucide-react";
import clsx from "clsx";
import { burst } from "../lib/celebrate";
import { renderShareCard, type CardData } from "../lib/shareCard";
import { ApiError, api, useAuth } from "../store/auth";
import type { Period } from "../store/leaderboard";
import { gameUrl } from "../store/nav";
import { SITE_ORIGIN } from "../lib/platform";
import { flushScores } from "../store/scoreSync";

export type ShareTarget =
  | {
      kind: "round";
      roundId: string;
      questionIds: string[];
      title: string;
      accuracy: number;
      marks: number;
      maxMarks: number;
      xp: number;
      streak: number;
      timeMs: number;
    }
  | { kind: "rank"; period: Period; rank: number; participants: number; xp: number }
  | {
      /** A game's page link, e.g. Galaxy Guardian; with a score or a scoreboard rank to show off, or just an invite. */
      kind: "game";
      game: "galaxy";
      gameTitle: string;
      /** Mission/section id ("overall" for a game's overall board). */
      section: string;
      sectionName: string;
      symbol: string;
      score?: { points: number; level: number; wave: number; correct: number };
      rank?: { rank: number; participants: number; period: Period; points: number };
    };

export const PERIOD_LABEL: Record<Period, string> = { week: "this week", month: "this month", all: "of all time" };

/** "Riya Sharma" -> "Riya S." (same rule as the server). */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "Student";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A challenge link for signed-in students; the home page for guests. */
async function createLink(t: ShareTarget, signedIn: boolean): Promise<string> {
  if (t.kind === "game") return gameUrl(t.game, t.section === "overall" || t.section === "mixed" ? null : t.section);
  if (!signedIn) return SITE_ORIGIN;
  const body = t.kind === "round" ? { kind: "round", roundId: t.roundId, questionIds: t.questionIds } : { kind: "rank", period: t.period };
  for (let attempt = 0; ; attempt++) {
    // A just-finished round may still be on its way to the server.
    if (t.kind === "round") await flushScores().catch(() => undefined);
    try {
      return (await api<{ url: string }>("/api/share", body)).url;
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404) || attempt >= 2) throw e;
      await sleep(1200);
    }
  }
}

function message(t: ShareTarget, url: string, signedIn: boolean): string {
  if (t.kind === "game") {
    const where = t.section === "overall" ? t.gameTitle : `${t.gameTitle} (${t.sectionName})`;
    if (t.rank) return `🚀 I'm #${t.rank.rank} of ${t.rank.participants} in ${where} ${PERIOD_LABEL[t.rank.period]}! Think you can beat me?\n👉 ${url}`;
    if (t.score) return `🚀 I scored ${t.score.points.toLocaleString("en-IN")} points in ${where} and reached level ${t.score.level}! Can you beat me?\n👉 ${url}`;
    return `🚀 Play ${where} with me! Blast asteroids with maths and save Earth 🌍\n👉 ${url}`;
  }
  if (t.kind === "rank") return `🔥 I'm #${t.rank} of ${t.participants} students on PrepQuest ${PERIOD_LABEL[t.period]}! Think you can beat me?\n👉 ${url}`;
  const head = `🏆 I scored ${t.accuracy}% in ${t.title} on PrepQuest!`;
  return signedIn
    ? `${head}\nSame ${t.questionIds.length} questions — can you beat me?\n👉 ${url}`
    : `${head}\nFree CBSE practice — try it\n👉 ${url}`;
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function ShareSheet({ target, onClose }: { target: ShareTarget | null; onClose: () => void }) {
  return <AnimatePresence>{target && <Sheet key="sheet" target={target} onClose={onClose} />}</AnimatePresence>;
}

function Sheet({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const user = useAuth((s) => s.user);
  const signedIn = !!user;
  const [link, setLink] = useState<string | null>(null);
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Bumped by "Try again" to redraw the picture. */
  const [attempt, setAttempt] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const name = user ? shortName(user.name) : "I";

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Make the link first (the card prints it), then draw the card.
  useEffect(() => {
    let live = true;
    let objectUrl: string | null = null;
    (async () => {
      const url = await createLink(target, signedIn).catch(() => {
        if (live) setError("Couldn't make a challenge link right now, so your picture links to PrepQuest instead.");
        return SITE_ORIGIN;
      });
      if (!live) return;
      setLink(url);
      const data: CardData =
        target.kind === "round"
          ? { kind: "round", name, title: target.title, accuracy: target.accuracy, marks: target.marks, maxMarks: target.maxMarks, xp: target.xp, streak: target.streak, timeMs: target.timeMs, questions: target.questionIds.length, url }
          : target.kind === "rank"
            ? { kind: "rank", name, rank: target.rank, participants: target.participants, periodLabel: PERIOD_LABEL[target.period], xp: target.xp, url }
            : {
                kind: "game",
                name,
                gameTitle: target.gameTitle,
                sectionName: target.section === "overall" ? "Overall" : target.sectionName,
                symbol: target.symbol,
                score: target.score,
                rank: target.rank && { ...target.rank, periodLabel: PERIOD_LABEL[target.rank.period] },
                url,
              };
      const blob = await renderShareCard(data);
      if (!live) return;
      objectUrl = URL.createObjectURL(blob);
      setCard({ blob, url: objectUrl });
    })().catch(() => live && setError("Couldn't draw the picture."));
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [target, signedIn, name, attempt]);

  const text = link ? message(target, link, signedIn) : "";
  const file = useMemo(() => (card ? new File([card.blob], "prepquest.png", { type: "image/png" }) : null), [card]);
  const canShareFile = !!file && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file], text });
  // Every way of sharing sends the picture and the link together, so wait for both.
  const ready = !!link && !!card;

  const celebrate = () => burst(null, true);

  /** Opens the device's share menu with the picture and the message (which carries the link). */
  const shareBoth = async () => {
    if (!file) return;
    try {
      // The link goes in `url` too: some apps drop the text when a picture is attached, but keep the link.
      await navigator.share({ files: [file], text, url: link ?? undefined });
      celebrate();
    } catch {
      // Closed the share menu: nothing to do.
    }
  };

  /**
   * Puts the picture and the message on the clipboard together. Where the
   * browser can't hold both, it saves the picture and copies the message.
   */
  const copyBoth = async (): Promise<"copied" | "saved"> => {
    if (!card) return "saved";
    try {
      // Rich text (email, docs, chat apps that take it) gets the picture with a real, clickable link under it.
      const dataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(card.blob);
      });
      const html = `<p>${escapeHtml(text).replace(escapeHtml(link ?? ""), `<a href="${link}">${escapeHtml(link ?? "")}</a>`).replace(/\n/g, "<br>")}</p><img src="${dataUrl}" alt="PrepQuest" width="540">`;
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": card.blob,
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return "copied";
    } catch {
      const a = document.createElement("a");
      a.href = card.url;
      a.download = target.kind === "round" ? "prepquest-score.png" : target.kind === "game" ? `prepquest-${target.game}.png` : "prepquest-rank.png";
      a.click();
      await navigator.clipboard.writeText(text).catch(() => undefined);
      return "saved";
    }
  };

  const whatsapp = async () => {
    // Phones: the share menu attaches the picture; pick WhatsApp there.
    if (canShareFile) return shareBoth();
    // Desktop: WhatsApp links carry text only, so the picture goes on the clipboard to paste in.
    // The tab is opened inside the click itself; after an await, strict browsers block it as a popup.
    const tab = window.open("", "_blank", "noopener");
    const how = await copyBoth();
    setNotice(how === "copied" ? "Picture copied. Paste it into the WhatsApp chat (Ctrl+V) with your link." : "Picture saved. Attach it in the WhatsApp chat with your link.");
    const link = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (tab) tab.location.href = link;
    else window.open(link, "_blank", "noopener");
    celebrate();
  };
  const copy = async () => {
    const how = await copyBoth();
    setNotice(how === "copied" ? "Picture and link copied. Paste them into any chat." : "Picture saved and link copied. Attach the picture and paste the link.");
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 60, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 60, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border-2 border-line bg-surface p-5 shadow-pop sm:rounded-[28px]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="share-title" className="font-display text-2xl font-extrabold tracking-tight">
            {target.kind === "round" ? "Challenge your friends" : target.kind === "game" ? (target.score || target.rank ? "Challenge your friends" : `Share ${target.gameTitle}`) : "Show off your rank"}
          </h2>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg">
            <X className="size-5" />
          </button>
        </div>

        <div className="relative mx-auto aspect-[4/5] w-full max-w-[17rem] overflow-hidden rounded-2xl bg-[#1b1f3b] shadow-card">
          <AnimatePresence>
            {card ? (
              <motion.img
                key="card"
                src={card.url}
                alt="Your share card"
                className="absolute inset-0 size-full"
                initial={{ opacity: 0, scale: 1.08, rotate: -2 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
              />
            ) : (
              <motion.div key="wait" exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center text-white/70">
                <Loader2 className="size-8 animate-spin" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {link ? (
          <motion.a
            href={link}
            target="_blank"
            rel="noopener"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mt-3 flex max-w-[17rem] items-center gap-2 rounded-xl border-2 border-line bg-surface-2 px-3 py-2 text-sm font-bold text-brand hover:border-brand"
          >
            <Link2 className="size-4 shrink-0" />
            <span className="truncate underline underline-offset-2">{link.replace(/^https?:\/\//, "")}</span>
          </motion.a>
        ) : (
          <div className="mx-auto mt-3 h-10 max-w-[17rem] animate-pulse rounded-xl bg-surface-2" />
        )}

        {target.kind === "round" && signedIn && (
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm font-semibold text-muted">
            <Users className="size-4 shrink-0" /> Friends who open your link play the same {target.questionIds.length} questions.
          </p>
        )}
        {target.kind === "game" && (
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm font-semibold text-muted">
            <Users className="size-4 shrink-0" /> The link opens {target.gameTitle}
            {target.section !== "overall" && target.section !== "mixed" ? ` on the ${target.sectionName} mission` : ""}, ready to play.
          </p>
        )}
        {!signedIn && target.kind !== "game" && <p className="mt-4 text-center text-sm font-semibold text-muted">Sign in to get a challenge link that friends can play.</p>}
        {error && (
          <p className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-center text-sm font-semibold text-bad">
            {error}
            {!card && (
              <button type="button" onClick={() => (setError(null), setAttempt((n) => n + 1))} className="ml-2 underline">
                Try again
              </button>
            )}
          </p>
        )}
        <AnimatePresence>
          {notice && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 rounded-xl bg-ok-soft px-3 py-2 text-center text-sm font-semibold"
            >
              {notice}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {canShareFile && (
            <ShareButton onClick={shareBoth} disabled={!ready} className="col-span-2 bg-brand text-brand-ink" icon={Share2}>
              Share picture + link
            </ShareButton>
          )}
          <ShareButton onClick={whatsapp} disabled={!ready} className="bg-[#25D366] text-white" icon={MessageCircle}>
            WhatsApp
          </ShareButton>
          <ShareButton onClick={copy} disabled={!ready} className="border-2 border-line bg-surface" icon={copied ? Check : Copy}>
            {copied ? "Copied!" : "Copy picture + link"}
          </ShareButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ShareButton({
  onClick,
  disabled,
  className,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  className: string;
  icon: typeof Share2;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      whileHover={disabled ? undefined : { y: -1 }}
      className={clsx(
        "flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 font-display text-[16px] font-bold disabled:cursor-wait disabled:opacity-50",
        className,
      )}
    >
      <Icon className="size-5" /> {children}
    </motion.button>
  );
}
