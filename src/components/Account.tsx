import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LogOut, Settings, Trophy } from "lucide-react";
import { useNav } from "../store/nav";
import { isNative } from "../lib/platform";
import { useIsDark, useMediaQuery } from "../lib/theme";
import { loadGoogle, useAuth } from "../store/auth";

/** Sign-in error under the button; in the header it hangs below, in `big` buttons it sits in the flow. */
function SignInError({ big }: { big?: boolean }) {
  const error = useAuth((s) => s.error);
  if (!error) return null;
  return (
    <p
      role="alert"
      className={
        big
          ? "mt-3 rounded-xl bg-bad px-3 py-2 text-center text-xs font-semibold text-white"
          : "absolute right-0 top-full z-30 mt-2 w-56 rounded-xl bg-bad px-3 py-2 text-xs font-semibold text-white shadow-pop"
      }
    >
      {error}
    </p>
  );
}

/** Google's own button (their branding rules require it), re-rendered on theme change. `big`: "Continue with Google", full size. */
function GoogleButton({ big }: { big?: boolean }) {
  const clientId = useAuth((s) => s.clientId);
  const dark = useIsDark();
  const wide = useMediaQuery("(min-width: 640px)");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clientId) return;
    let live = true;
    loadGoogle(clientId)
      .then((google) => {
        if (!live || !ref.current) return;
        ref.current.replaceChildren();
        google.accounts.id.renderButton(ref.current, {
          type: "standard",
          theme: dark ? "filled_black" : "outline",
          size: big || wide ? "large" : "medium",
          text: big ? "continue_with" : "signin",
          shape: "pill",
          ...(big ? { logo_alignment: "center" as const, width: 280 } : {}),
        });
      })
      .catch(() => useAuth.setState({ error: "Could not load Google sign-in" }));
    return () => {
      live = false;
    };
  }, [clientId, dark, wide, big]);

  return (
    <div className="relative">
      <div ref={ref} className={big ? "flex min-h-11 items-center justify-center" : "flex h-10 items-center"} />
      <SignInError big={big} />
    </div>
  );
}

/** The app: Google's script can't sign in inside an app, so this opens Android's own Google sign-in. */
function NativeGoogleButton({ big }: { big?: boolean }) {
  const signIn = useAuth((s) => s.signInNative);
  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={() => void signIn()}
        whileTap={{ scale: 0.95 }}
        className={
          big
            ? "mx-auto flex h-12 w-full max-w-[280px] items-center justify-center gap-2.5 rounded-full border-2 border-line bg-surface px-5 font-bold"
            : "flex h-10 items-center gap-2 rounded-full border-2 border-line bg-surface px-4 text-sm font-bold"
        }
      >
        <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
          <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
        </svg>
        {big ? "Continue with Google" : "Sign in"}
      </motion.button>
      <SignInError big={big} />
    </div>
  );
}

/** Large Google sign-in button for prompts (the sign-in gate, the results card). */
export function SignInButton() {
  return isNative ? <NativeGoogleButton big /> : <GoogleButton big />;
}

function Avatar({ name, picture, size = "size-10" }: { name: string; picture: string | null; size?: string }) {
  const [broken, setBroken] = useState(false);
  if (picture && !broken) {
    return <img src={picture} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={`${size} rounded-full object-cover`} />;
  }
  return (
    <span className={`${size} grid place-items-center rounded-full bg-brand font-display font-extrabold text-brand-ink`}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function UserMenu() {
  const user = useAuth((s) => s.user)!;
  const signOut = useAuth((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => ref.current?.contains(e.target as Node) || setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <motion.button
        aria-label={`Account: ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.name}
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.9 }}
        className="grid size-10 place-items-center rounded-full ring-2 ring-line transition hover:ring-fg/30"
      >
        <Avatar name={user.name} picture={user.picture} />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-30 mt-2 w-64 origin-top-right rounded-2xl border-2 border-line bg-surface p-2 shadow-pop"
          >
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar name={user.name} picture={user.picture} size="size-11" />
              <div className="min-w-0">
                <p className="truncate font-display font-bold">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
            </div>
            <div className="my-1 h-0.5 bg-line" />
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                useNav.getState().go("board");
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <Trophy className="size-4" /> Leaderboard
            </button>
            {user.role === "admin" && (
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  useNav.getState().go("admin");
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <Settings className="size-4" /> Configuration
              </button>
            )}
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Header slot: Google sign-in button for guests, avatar menu once signed in. */
export function AccountButton() {
  const status = useAuth((s) => s.status);
  if (status === "signedIn") return <UserMenu />;
  if (status === "signedOut") return isNative ? <NativeGoogleButton /> : <GoogleButton />;
  return null;
}
