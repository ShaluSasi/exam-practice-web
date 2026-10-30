import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  Crown,
  Flame,
  Play,
  RefreshCw,
  Share2,
  Swords,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { AccountButton } from "../components/Account";
import { CountUp } from "../components/CountUp";
import { Button } from "../components/Button";
import { ShareSheet, type ShareTarget } from "../components/ShareSheet";
import { SettingsToggles } from "../components/TopBar";
import { burst } from "../lib/celebrate";
import { useAuth } from "../store/auth";
import { useBoard, useLeaderboard, type Entry, type Period } from "../store/leaderboard";
import { useNav } from "../store/nav";

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

const AVATAR_COLORS = ["bg-maths", "bg-physics", "bg-chemistry", "bg-biology", "bg-social", "bg-english"];

function colorFor(pid: string) {
  let h = 0;
  for (const c of pid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function Avatar({ entry, size = "size-11", ring }: { entry: Pick<Entry, "pid" | "name" | "isMe">; size?: string; ring?: string }) {
  return (
    <span
      className={clsx(
        "grid shrink-0 place-items-center rounded-full font-display font-extrabold text-white shadow-card",
        size,
        entry.isMe ? "bg-brand text-brand-ink" : colorFor(entry.pid),
        ring,
      )}
      aria-hidden
    >
      {entry.name.charAt(0).toUpperCase()}
    </span>
  );
}

function PeriodTabs({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <div role="tablist" aria-label="Time period" className="grid grid-cols-3 gap-1 rounded-2xl border-2 border-line bg-surface p-1">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          role="tab"
          aria-selected={period === p.id}
          onClick={() => onChange(p.id)}
          className={clsx(
            "relative rounded-xl px-2 py-2.5 font-display text-sm font-bold transition-colors sm:text-base",
            period === p.id ? "text-bg" : "text-muted hover:text-fg",
          )}
        >
          {period === p.id && (
            <motion.span layoutId="period-pill" className="absolute inset-0 rounded-xl bg-fg" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
          )}
          <span className="relative">{p.label}</span>
        </button>
      ))}
    </div>
  );
}

function MyRankCard({
  me,
  participants,
  moved,
  above,
  onShare,
  onPractise,
}: {
  me: Entry | null;
  participants: number;
  moved: number;
  above: Entry | null;
  onShare: () => void;
  onPractise: () => void;
}) {
  if (!me) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3 rounded-[28px] border-2 border-dashed border-line bg-surface p-6 text-center"
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft">
          <Target className="size-7 text-brand" />
        </span>
        <p className="font-display text-xl font-extrabold">You're not on this board yet</p>
        <p className="max-w-sm text-sm text-muted">Finish a round in this period to earn XP and jump onto the leaderboard.</p>
        <Button onClick={onPractise}>
          <Play className="size-5 fill-current" /> Practise now
        </Button>
      </motion.section>
    );
  }
  const top = Math.max(1, Math.ceil((me.rank / Math.max(1, participants)) * 100));
  const gap = above ? above.xp - me.xp + 1 : 0;
  const progress = above ? Math.min(100, (me.xp / Math.max(1, above.xp)) * 100) : 100;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[28px] bg-[#1b1f3b] p-5 text-white shadow-pop sm:p-7"
    >
      <motion.div
        className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-brand/30 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 5, repeat: Infinity }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Your rank</p>
          <div className="mt-1 flex items-end gap-3">
            <span className="font-display text-6xl font-extrabold leading-none sm:text-7xl">
              #<CountUp value={me.rank} />
            </span>
            <span className="mb-1.5 text-sm font-semibold text-white/70">of {participants.toLocaleString("en-IN")}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 14 }}
              className="rounded-full bg-ok px-3 py-1 text-xs font-extrabold text-[#0e1022]"
            >
              TOP {top}%
            </motion.span>
            {moved !== 0 && (
              <motion.span
                initial={{ y: moved > 0 ? 8 : -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className={clsx(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold",
                  moved > 0 ? "bg-ok/20 text-ok" : "bg-bad/20 text-bad",
                )}
              >
                {moved > 0 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                {Math.abs(moved)} since last visit
              </motion.span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">XP</p>
          <p className="flex items-center justify-end gap-1 font-display text-3xl font-extrabold">
            <Zap className="size-6 fill-brand text-brand" />
            <CountUp value={me.xp} />
          </p>
        </div>
      </div>

      <div className="relative mt-5">
        {above ? (
          <>
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-white/80">
                <span className="font-extrabold text-brand">{gap} XP</span> to overtake {above.name} (#{above.rank})
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#ffc53d] to-brand"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
              />
            </div>
          </>
        ) : me.rank === 1 ? (
          <p className="flex items-center gap-2 font-display text-lg font-extrabold text-[#ffc53d]">
            <Crown className="size-5" /> You're at the top. Defend your crown!
          </p>
        ) : null}
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-2.5">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onShare}
          className="flex items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 font-display font-bold text-brand-ink"
        >
          <Share2 className="size-5" /> Share rank
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onPractise}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 font-display font-bold text-white"
        >
          <Play className="size-5 fill-current" /> Earn XP
        </motion.button>
      </div>
    </motion.section>
  );
}

const PODIUM = [
  { place: 2, height: "h-28 sm:h-32", tone: "from-[#c9d1e4] to-[#9aa3bd]", delay: 0.15 },
  { place: 1, height: "h-36 sm:h-44", tone: "from-[#ffd76a] to-[#ff9a3c]", delay: 0 },
  { place: 3, height: "h-20 sm:h-24", tone: "from-[#f2b07a] to-[#c97a3f]", delay: 0.3 },
];

function Podium({ top, onPick }: { top: Entry[]; onPick: (e: Entry) => void }) {
  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
      {PODIUM.map(({ place, height, tone, delay }) => {
        const e = top[place - 1];
        if (!e) return <div key={place} />;
        return (
          <motion.button
            key={e.pid}
            type="button"
            onClick={() => onPick(e)}
            className="flex min-w-0 flex-col items-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + delay, type: "spring", stiffness: 260, damping: 20 }}
            whileHover={{ y: -4 }}
          >
            {place === 1 && (
              <motion.span animate={{ y: [0, -5, 0], rotate: [-4, 4, -4] }} transition={{ duration: 2.4, repeat: Infinity }}>
                <Crown className="mb-1 size-8 fill-[#ffc53d] text-[#e0a100]" />
              </motion.span>
            )}
            <Avatar entry={e} size={place === 1 ? "size-16 text-2xl" : "size-12 text-lg"} ring={clsx("ring-4", place === 1 ? "ring-[#ffc53d]" : "ring-surface")} />
            <span className={clsx("mt-2 w-full truncate text-center font-display text-sm font-extrabold sm:text-base", e.isMe && "text-brand")}>
              {e.isMe ? "You" : e.name}
            </span>
            <span className="flex items-center gap-0.5 text-xs font-bold text-muted sm:text-sm">
              <Zap className="size-3.5 fill-brand text-brand" />
              {e.xp.toLocaleString("en-IN")}
            </span>
            <motion.div
              className={clsx("mt-2 w-full origin-bottom rounded-t-2xl bg-gradient-to-b shadow-card", height, tone)}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.35 + delay, type: "spring", stiffness: 140, damping: 16 }}
            >
              <span className="block pt-2 text-center font-display text-3xl font-extrabold text-white/90 drop-shadow sm:text-4xl">{place}</span>
            </motion.div>
          </motion.button>
        );
      })}
    </div>
  );
}

function CompareBar({ label, mine, theirs, icon: Icon, suffix = "" }: { label: string; mine: number; theirs: number; icon: typeof Zap; suffix?: string }) {
  const max = Math.max(1, mine, theirs);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted">
        <span className="flex items-center gap-1">
          <Icon className="size-3.5" /> {label}
        </span>
      </div>
      <div className="grid grid-cols-[2.75rem_1fr] items-center gap-x-2 gap-y-1">
        <span className="text-right font-display text-sm font-extrabold text-brand tabular-nums">
          {mine}
          {suffix}
        </span>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${(mine / max) * 100}%` }} transition={{ duration: 0.7 }} />
        </div>
        <span className="text-right font-display text-sm font-extrabold tabular-nums">
          {theirs}
          {suffix}
        </span>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full rounded-full bg-fg/70" initial={{ width: 0 }} animate={{ width: `${(theirs / max) * 100}%` }} transition={{ duration: 0.7, delay: 0.1 }} />
        </div>
      </div>
    </div>
  );
}

function Compare({ me, them }: { me: Entry | null; them: Entry }) {
  if (!me) return <p className="text-sm text-muted">Finish a round in this period to compare yourself with {them.name}.</p>;
  const gap = them.xp - me.xp;
  const perRound = me.rounds ? me.xp / me.rounds : 100;
  const verdict =
    gap > 0
      ? `${them.name} is ${gap} XP ahead. About ${Math.max(1, Math.ceil(gap / perRound))} more round${Math.ceil(gap / perRound) === 1 ? "" : "s"} and you'll pass them!`
      : gap < 0
        ? `You're ${-gap} XP ahead of ${them.name}. Keep going!`
        : `You're level with ${them.name}. Next round decides it!`;
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 text-xs font-bold">
        <span className="flex items-center gap-1.5 text-brand">
          <span className="size-2.5 rounded-full bg-brand" /> You
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          <span className="size-2.5 rounded-full bg-fg/70" /> {them.name}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CompareBar label="XP" icon={Zap} mine={me.xp} theirs={them.xp} />
        <CompareBar label="Rounds" icon={Target} mine={me.rounds} theirs={them.rounds} />
        <CompareBar label="Avg accuracy" icon={Trophy} mine={me.accuracy} theirs={them.accuracy} suffix="%" />
        <CompareBar label="Best streak" icon={Flame} mine={me.bestStreak} theirs={them.bestStreak} />
      </div>
      <p className="flex items-start gap-2 rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold">
        <Swords className="mt-0.5 size-4 shrink-0 text-brand" /> {verdict}
      </p>
    </div>
  );
}

function Row({ e, me, open, onToggle, index }: { e: Entry; me: Entry | null; open: boolean; onToggle: () => void; index: number }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.035, type: "spring", stiffness: 320, damping: 28 }}
      className={clsx(
        "overflow-hidden rounded-2xl border-2 bg-surface",
        e.isMe ? "border-brand shadow-pop ring-4 ring-brand/15" : "border-line",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        disabled={e.isMe}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default sm:px-4"
      >
        <span className={clsx("w-8 text-center font-display text-lg font-extrabold tabular-nums", e.isMe ? "text-brand" : "text-muted")}>{e.rank}</span>
        <Avatar entry={e} size="size-10" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display font-extrabold">{e.isMe ? "You" : e.name}</span>
          <span className="flex items-center gap-2 text-xs font-semibold text-muted">
            <span>
              {e.rounds} {e.rounds === 1 ? "round" : "rounds"}
            </span>
            <span>{e.accuracy}% avg</span>
          </span>
        </span>
        <span className="flex items-center gap-1 font-display font-extrabold tabular-nums">
          <Zap className="size-4 fill-brand text-brand" />
          {e.xp.toLocaleString("en-IN")}
        </span>
        {!e.isMe && <ChevronDown className={clsx("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="border-t-2 border-dashed border-line px-4 py-4">
              <Compare me={me} them={e} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function GuestTeaser() {
  const fake: Entry[] = ["Aarav", "Diya", "Kabir", "Meera", "Rohan"].map((name, i) => ({
    pid: name,
    name: `${name} ${"SNIPR"[i]}.`,
    xp: 1800 - i * 260,
    rounds: 14 - i * 2,
    accuracy: 88 - i * 4,
    bestStreak: 12 - i,
    rank: i + 1,
    isMe: false,
  }));
  return (
    <section className="relative">
      <div className="pointer-events-none select-none blur-[3px]" aria-hidden>
        <Podium top={fake} onPick={() => undefined} />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[28px] bg-bg/60 p-6 text-center backdrop-blur-[1px]">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand text-brand-ink shadow-pop">
          <Trophy className="size-7" />
        </span>
        <p className="font-display text-2xl font-extrabold">See where you rank</p>
        <p className="max-w-xs text-sm text-muted">Sign in with Google to join the leaderboard, compare with friends and share your rank.</p>
        <AccountButton />
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading leaderboard">
      <div className="h-56 animate-pulse rounded-[28px] bg-surface-2" />
      <div className="h-44 animate-pulse rounded-[28px] bg-surface-2" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-2" />
      ))}
    </div>
  );
}

export function LeaderboardScreen() {
  const go = useNav((s) => s.go);
  const status = useAuth((s) => s.status);
  const [period, setPeriod] = useState<Period>("week");
  const [openPid, setOpenPid] = useState<string | null>(null);
  const [share, setShare] = useState<ShareTarget | null>(null);
  const { loaded, loading } = useBoard(period);
  const error = useLeaderboard((s) => s.error);
  const load = useLeaderboard((s) => s.load);
  const signedIn = status === "signedIn";

  useEffect(() => {
    if (signedIn) void load(period);
  }, [signedIn, period, load]);

  const board = loaded?.board;
  const list = useMemo(() => (board ? [...board.top, ...board.around] : []), [board]);
  const me = board?.me ?? null;
  const above = useMemo(() => {
    if (!me) return null;
    // Students tied on XP share a rank, so the one to overtake is the nearest listed above with a better rank.
    const i = list.findIndex((e) => e.isMe);
    for (let j = i - 1; j >= 0; j--) if (list[j].rank < me.rank) return list[j];
    return null;
  }, [list, me]);

  // A little party when you're on the podium.
  useEffect(() => {
    if (me && me.rank <= 3) {
      const t = setTimeout(() => burst(null, true), 700);
      return () => clearTimeout(t);
    }
  }, [me?.rank, period]); // eslint-disable-line react-hooks/exhaustive-deps

  const rest = board ? board.top.slice(3) : [];
  const gapAfterTop = board && board.around.length > 0;

  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <header className="flex items-center justify-between gap-3 py-5">
          <div className="flex min-w-0 items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => go("home")}
              aria-label="Back to home"
              className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-line bg-surface text-muted hover:text-fg"
            >
              <ArrowLeft className="size-5" />
            </motion.button>
            <h1 className="truncate font-display text-xl font-extrabold tracking-tight min-[400px]:text-2xl sm:text-3xl">Leaderboard</h1>
          </div>
          <SettingsToggles />
        </header>

        <div className="mb-5 flex items-center gap-2">
          <div className="flex-1">
            <PeriodTabs period={period} onChange={(p) => (setPeriod(p), setOpenPid(null))} />
          </div>
          {signedIn && (
            <motion.button
              whileTap={{ scale: 0.9, rotate: 180 }}
              onClick={() => {
                useLeaderboard.setState((s) => ({ boards: { ...s.boards, [`global:${period}`]: undefined } }));
                void load(period);
              }}
              aria-label="Refresh"
              className="grid size-12 shrink-0 place-items-center rounded-2xl border-2 border-line bg-surface text-muted hover:text-fg"
            >
              <RefreshCw className={clsx("size-5", loading && "animate-spin")} />
            </motion.button>
          )}
        </div>

        {status === "loading" ? (
          <Skeleton />
        ) : !signedIn ? (
          <GuestTeaser />
        ) : !board ? (
          error ? <p className="rounded-2xl bg-bad-soft p-4 text-center font-semibold text-bad">{error}</p> : <Skeleton />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={period} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-6">
              <MyRankCard
                me={me}
                participants={board.participants}
                moved={loaded.moved}
                above={above}
                onShare={() => me && setShare({ kind: "rank", period, rank: me.rank, participants: board.participants, xp: me.xp })}
                onPractise={() => go("home")}
              />

              {board.participants === 0 ? (
                <p className="rounded-[28px] border-2 border-dashed border-line bg-surface p-8 text-center font-display text-lg font-extrabold">
                  No one has scored yet in this period. Be the first! 🚀
                </p>
              ) : (
                <>
                  <section className="rounded-[28px] border-2 border-line bg-surface px-3 pt-6 sm:px-6">
                    <h2 className="mb-4 flex items-center justify-center gap-2 font-display text-lg font-extrabold">
                      <Users className="size-5 text-brand" /> Top students · {board.participants.toLocaleString("en-IN")} playing
                    </h2>
                    <Podium top={board.top} onPick={(e) => !e.isMe && setOpenPid(e.pid)} />
                  </section>

                  {(rest.length > 0 || gapAfterTop || board.top.slice(0, 3).some((e) => e.pid === openPid)) && (
                    <ol className="grid gap-2">
                      {/* Podium students can be compared too: show them in the list once tapped. */}
                      {board.top.slice(0, 3).filter((e) => e.pid === openPid).map((e, i) => (
                        <Row key={e.pid} e={e} me={me} open onToggle={() => setOpenPid(null)} index={i} />
                      ))}
                      {rest.map((e, i) => (
                        <Row key={e.pid} e={e} me={me} open={openPid === e.pid} onToggle={() => setOpenPid(openPid === e.pid ? null : e.pid)} index={i} />
                      ))}
                      {gapAfterTop && (
                        <li className="py-1 text-center font-display text-xl font-extrabold tracking-[0.5em] text-muted" aria-hidden>
                          ···
                        </li>
                      )}
                      {board.around.map((e, i) => (
                        <Row key={e.pid} e={e} me={me} open={openPid === e.pid} onToggle={() => setOpenPid(openPid === e.pid ? null : e.pid)} index={i} />
                      ))}
                    </ol>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      <ShareSheet target={share} onClose={() => setShare(null)} />
    </div>
  );
}
