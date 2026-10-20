import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LogOut, Trophy } from "lucide-react";
import { useNav } from "../store/nav";
import { useIsDark, useMediaQuery } from "../lib/theme";
import { loadGoogle, useAuth } from "../store/auth";

/** Google's own button (their branding rules require it), re-rendered on theme change. */
function GoogleButton() {
  const clientId = useAuth((s) => s.clientId);
  const error = useAuth((s) => s.error);
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
          size: wide ? "large" : "medium",
          text: "signin",
          shape: "pill",
        });
      })
      .catch(() => useAuth.setState({ error: "Could not load Google sign-in" }));
    return () => {
      live = false;
    };
  }, [clientId, dark, wide]);

  return (
    <div className="relative">
      <div ref={ref} className="flex h-10 items-center" />
      {error && (
        <p role="alert" className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl bg-bad px-3 py-2 text-xs font-semibold text-white shadow-pop">
          {error}
        </p>
      )}
    </div>
  );
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
  if (status === "signedOut") return <GoogleButton />;
  return null;
}
