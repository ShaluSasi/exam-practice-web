import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ChevronRight, Gauge, ListOrdered } from "lucide-react";
import { ROUND_SIZE } from "../engine/scoring";
import { SettingsToggles } from "../components/TopBar";
import { useAuth } from "../store/auth";
import { useNav, type Screen } from "../store/nav";
import { useProfile } from "../store/profile";

/** worker/questions.ts clamps `count` to this; matched here so the field cannot ask for more than the server will give. */
const MAX_ROUND_SIZE = 50;

/** Pages only admins (ADMIN_EMAILS in wrangler.jsonc) may open; App.tsx sends everyone else home. */
export const ADMIN_SCREENS: Screen[] = ["admin", "difficulty", "sequence"];

const LINKS = [
  {
    screen: "difficulty" as const,
    icon: Gauge,
    title: "Question difficulty",
    text: "See every chapter's easy, moderate and hard questions, and change any question's difficulty.",
  },
  {
    screen: "sequence" as const,
    icon: ListOrdered,
    title: "Question sequence",
    text: "Set the order each chapter's questions are asked in, by drag and drop.",
  },
];

/** Admin-only test setting: how many questions a chapter round draws, instead of the usual ROUND_SIZE. Other accounts are unaffected (App.tsx only applies it for admins). */
function RoundSizeSetting() {
  const adminRoundSize = useProfile((s) => s.adminRoundSize);
  const setAdminRoundSize = useProfile((s) => s.setAdminRoundSize);
  const [text, setText] = useState(String(adminRoundSize ?? ""));

  const commit = (value: string) => {
    const n = Math.round(Number(value));
    const clamped = value.trim() === "" || !Number.isFinite(n) ? null : Math.min(MAX_ROUND_SIZE, Math.max(1, n));
    setAdminRoundSize(clamped);
    setText(String(clamped ?? ""));
  };

  return (
    <div className="mb-6 rounded-[24px] border-2 border-line bg-surface p-5">
      <label htmlFor="admin-round-size" className="block font-display text-lg font-extrabold">
        Questions per chapter (admin test setting)
      </label>
      <p className="mt-0.5 text-sm text-muted">
        Only changes your own chapter practice rounds, so you can test with fewer questions. Other accounts always get {ROUND_SIZE}.
      </p>
      <input
        id="admin-round-size"
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_ROUND_SIZE}
        placeholder={String(ROUND_SIZE)}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        className="mt-3 w-28 rounded-xl border-2 border-line bg-bg px-3 py-2 font-display font-bold tabular-nums outline-none focus:border-brand"
      />
    </div>
  );
}

export function AdminScreen() {
  const go = useNav((s) => s.go);
  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <header className="flex items-center gap-2 py-5">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => go("home")}
            aria-label="Back to home"
            className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-line bg-surface text-muted hover:text-fg"
          >
            <ArrowLeft className="size-5" />
          </motion.button>
          <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Configuration</h1>
          <SettingsToggles />
        </header>
        <RoundSizeSetting />
        <ul className="grid gap-3 sm:grid-cols-2">
          {LINKS.map((l, i) => (
            <motion.li key={l.screen} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <button
                type="button"
                onClick={() => go(l.screen)}
                className="group flex w-full items-center gap-4 rounded-[24px] border-2 border-line bg-surface p-5 text-left transition hover:border-fg/30"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft">
                  <l.icon className="size-6 text-brand" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-extrabold">{l.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{l.text}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-fg" />
              </button>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** True once sign-in is known and the account is not an admin: admin pages must not show. */
export function useNotAdmin(): boolean {
  const status = useAuth((s) => s.status);
  const role = useAuth((s) => s.user?.role);
  return status !== "loading" && role !== "admin";
}

/** Leaves an admin page for anyone who is not (or is no longer) an admin. */
export function useAdminGuard(screen: Screen) {
  const notAdmin = useNotAdmin();
  const go = useNav((s) => s.go);
  useEffect(() => {
    if (ADMIN_SCREENS.includes(screen) && notAdmin) go("home");
  }, [screen, notAdmin, go]);
}
