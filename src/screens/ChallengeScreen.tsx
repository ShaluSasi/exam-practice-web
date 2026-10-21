import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Clock, Crown, Loader2, Play, Swords, Target, Trophy, Zap } from "lucide-react";
import { Button } from "../components/Button";
import { offeredGrades } from "../config/regions";
import { Logo, SettingsToggles } from "../components/TopBar";
import { OfflineScreen } from "./StatusScreens";
import { formatTime } from "../lib/subjects";
import { PERIOD_LABEL } from "../components/ShareSheet";
import { ApiError, OFFLINE, api } from "../store/auth";
import type { RoundSource } from "../store/content";
import type { Period } from "../store/leaderboard";
import { useNav } from "../store/nav";

interface PublicShare {
  code: string;
  kind: "round" | "rank";
  name: string;
  plays: number;
  data:
    | { title: string; quizKey: string | null; accuracy: number; marks: number; maxMarks: number; xp: number; timeMs: number; questionIds: string[] }
    | { period: Period; rank: number; participants: number; xp: number };
}

/** The friend's exact questions; falls back to the same chapter if some were removed since. */
function questionsFor(d: Extract<PublicShare["data"], { questionIds: string[] }>): RoundSource {
  return { ids: d.questionIds, fallback: d.quizKey && d.quizKey !== "mixed" ? { chapter: d.quizKey } : { subjects: [], grades: offeredGrades } };
}

export function ChallengeScreen({ onStart }: { onStart: (source: RoundSource, title: string) => void }) {
  const code = useNav((s) => s.challengeCode);
  const go = useNav((s) => s.go);
  const setOpponent = useNav((s) => s.setOpponent);
  const [share, setShare] = useState<PublicShare | null>(null);
  const [missing, setMissing] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(() => {
    if (!code) return;
    setOffline(false);
    api<PublicShare>(`/api/share/${code}`).then(setShare, (e: unknown) =>
      e instanceof ApiError && e.status === OFFLINE ? setOffline(true) : setMissing(true),
    );
  }, [code]);
  useEffect(load, [load]);

  const leave = () => {
    window.history.replaceState(null, "", "/");
    useNav.setState({ challengeCode: null });
  };
  const home = () => {
    leave();
    go("home");
  };
  const accept = () => {
    if (!share || !("questionIds" in share.data)) return;
    const d = share.data;
    void api(`/api/share/${share.code}/play`, {}).catch(() => undefined);
    setOpponent({ code: share.code, name: share.name, accuracy: d.accuracy, marks: d.marks, maxMarks: d.maxMarks, timeMs: d.timeMs });
    leave();
    onStart(questionsFor(d), d.title);
  };

  if (offline) return <OfflineScreen onRetry={load} onBack={home} />;

  return (
    <div className="paper relative min-h-dvh overflow-hidden">
      <div className="relative mx-auto max-w-xl px-4 pb-16 sm:px-6">
        <header className="flex items-center justify-between py-5">
          <Logo />
          <SettingsToggles />
        </header>

        {missing ? (
          <section className="mt-10 rounded-[28px] border-2 border-line bg-surface p-8 text-center shadow-card">
            <p className="font-display text-2xl font-extrabold">This challenge link has expired</p>
            <p className="mt-2 text-muted">No worries, there are plenty of questions waiting for you.</p>
            <Button className="mt-6" onClick={home}>
              <Play className="size-5 fill-current" /> Start practising
            </Button>
          </section>
        ) : !share ? (
          <div className="grid h-80 place-items-center text-muted">
            <Loader2 className="size-8 animate-spin" />
          </div>
        ) : (
          <motion.section
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative mt-4 overflow-hidden rounded-[32px] bg-[#1b1f3b] p-6 text-center text-white shadow-pop sm:p-8"
          >
            <motion.div
              className="pointer-events-none absolute left-1/2 top-24 size-72 -translate-x-1/2 rounded-full bg-brand/35 blur-3xl"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            <motion.span
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 12 }}
              className="relative mx-auto mb-4 grid size-20 place-items-center rounded-full bg-brand font-display text-4xl font-extrabold text-brand-ink ring-8 ring-white/10"
            >
              {share.name.charAt(0)}
            </motion.span>

            {share.kind === "round" && "questionIds" in share.data ? (
              <>
                <p className="relative text-sm font-bold uppercase tracking-[0.2em] text-white/60">Challenge</p>
                <h1 className="relative mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{share.name} challenges you!</h1>
                <p className="relative mt-2 text-white/75">
                  in <span className="font-bold text-white">{share.data.title}</span>
                </p>

                <div className="relative mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/60">{share.name}</p>
                    <p className="font-display text-4xl font-extrabold text-[#ffc53d]">{share.data.accuracy}%</p>
                  </div>
                  <motion.span
                    animate={{ rotate: [0, -12, 12, 0], scale: [1, 1.15, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.6 }}
                    className="grid size-12 place-items-center rounded-full bg-brand text-brand-ink"
                  >
                    <Swords className="size-6" />
                  </motion.span>
                  <div className="rounded-2xl border-2 border-dashed border-white/25 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/60">You</p>
                    <motion.p
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                      className="font-display text-4xl font-extrabold"
                    >
                      ?
                    </motion.p>
                  </div>
                </div>

                <div className="relative mt-4 flex flex-wrap justify-center gap-2 text-sm font-semibold text-white/80">
                  <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                    <Target className="size-4" /> {share.data.marks}/{share.data.maxMarks} marks
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                    <Clock className="size-4" /> {formatTime(share.data.timeMs)}
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                    <Zap className="size-4 fill-brand text-brand" /> {share.data.questionIds.length} questions
                  </span>
                </div>

                <Button className="relative mt-7 w-full text-lg" onClick={accept}>
                  <Swords className="size-5" /> Accept the challenge
                </Button>
                <p className="relative mt-3 text-xs text-white/55">
                  Same questions, free, no sign-up needed.
                  {share.plays > 0 && ` ${share.plays} ${share.plays === 1 ? "friend has" : "friends have"} tried it.`}
                </p>
              </>
            ) : "rank" in share.data ? (
              <>
                <p className="relative text-sm font-bold uppercase tracking-[0.2em] text-white/60">Leaderboard</p>
                <h1 className="relative mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {share.name} is <span className="text-[#ffc53d]">#{share.data.rank}</span>
                </h1>
                <p className="relative mt-2 text-white/75">
                  of {share.data.participants} students on PrepQuest {PERIOD_LABEL[share.data.period]}
                </p>
                <div className="relative mt-6 flex items-center justify-center gap-3">
                  {share.data.rank <= 3 ? <Crown className="size-10 fill-[#ffc53d] text-[#e0a100]" /> : <Trophy className="size-10 text-[#ffc53d]" />}
                  <span className="font-display text-5xl font-extrabold">{share.data.xp.toLocaleString("en-IN")} XP</span>
                </div>
                <Button className="relative mt-7 w-full text-lg" onClick={home}>
                  <Play className="size-5 fill-current" /> Start climbing
                </Button>
                <p className="relative mt-3 text-xs text-white/55">Free CBSE practice for Class 9–12.</p>
              </>
            ) : null}
          </motion.section>
        )}

        {share && (
          <button onClick={home} className="mx-auto mt-5 block text-sm font-bold text-muted hover:text-fg">
            Not now, show me around →
          </button>
        )}
      </div>
    </div>
  );
}
