import { motion } from "motion/react";
import { Monitor, Moon, Sun, Volume2, VolumeX, Zap } from "lucide-react";
import { region } from "../config/regions";
import { useProfile, type ThemePref } from "../store/profile";
import { useNav } from "../store/nav";
import { AccountButton } from "./Account";

const NEXT_THEME: Record<ThemePref, ThemePref> = { system: "light", light: "dark", dark: "system" };
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon };

/** Goes to the landing (home) page, leaving any challenge link or result behind. */
function goHome() {
  if (window.location.pathname !== "/") window.history.replaceState(null, "", "/");
  useNav.setState({ challengeCode: null, opponent: null });
  useNav.getState().goLanding();
}

export function Logo() {
  return (
    <button type="button" onClick={goHome} aria-label={`${region.appName} home`} className="flex items-center gap-2.5 rounded-xl">
      <LogoMark />
    </button>
  );
}

function LogoMark() {
  return (
    <div className="flex items-center gap-2.5">
      <motion.div
        className="grid size-9 place-items-center rounded-xl bg-fg"
        whileHover={{ rotate: -8, scale: 1.05 }}
      >
        <svg viewBox="0 0 64 64" className="size-6">
          <motion.path
            d="M14 34l11 11 25-27"
            fill="none"
            stroke="var(--brand)"
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          />
        </svg>
      </motion.div>
      <span className="font-display text-xl font-extrabold tracking-tight">{region.appName}</span>
    </div>
  );
}

export function IconToggle({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      aria-label={label}
      title={label}
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      className="grid size-10 place-items-center rounded-xl border-2 border-line bg-surface text-muted transition-colors hover:text-fg"
    >
      {children}
    </motion.button>
  );
}

export function SettingsToggles() {
  const { theme, setTheme, soundOn, toggleSound } = useProfile();
  const ThemeIcon = THEME_ICON[theme];
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <IconToggle label={soundOn ? "Mute sounds" : "Turn sounds on"} onClick={toggleSound}>
        {soundOn ? <Volume2 className="size-[18px]" /> : <VolumeX className="size-[18px]" />}
      </IconToggle>
      <IconToggle label={`Theme: ${theme}`} onClick={() => setTheme(NEXT_THEME[theme])}>
        <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}>
          <ThemeIcon className="size-[18px]" />
        </motion.span>
      </IconToggle>
      <AccountButton />
    </div>
  );
}

export function XpPill({ xp }: { xp: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border-2 border-line bg-surface py-1.5 pl-2 pr-3 font-display font-bold">
      <Zap className="size-4 fill-brand text-brand" />
      <motion.span key={xp} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="tabular-nums">
        {xp}
      </motion.span>
      <span className="hidden text-xs text-muted sm:inline">XP</span>
    </div>
  );
}
