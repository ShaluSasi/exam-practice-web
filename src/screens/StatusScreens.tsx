import { useEffect } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Download, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "../components/Button";
import { isNative, STORE_URL } from "../lib/platform";

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="paper grid min-h-dvh place-items-center px-4">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-[28px] border-2 border-line bg-surface p-8 text-center shadow-card"
      >
        <span className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-surface-2 text-muted">{icon}</span>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
        {children}
      </motion.section>
    </div>
  );
}

/** Questions come from the server, so practice needs a connection. Retries by itself once back online. */
export function OfflineScreen({
  onRetry,
  onBack,
  busy = false,
  problem,
}: {
  onRetry: () => void;
  onBack?: () => void;
  busy?: boolean;
  /** Set when the server answered but something else went wrong (not a connection problem). */
  problem?: string;
}) {
  useEffect(() => {
    window.addEventListener("online", onRetry);
    return () => window.removeEventListener("online", onRetry);
  }, [onRetry]);

  return (
    <Panel icon={problem ? <RefreshCw className="size-8" /> : <WifiOff className="size-8" />} title={problem ? "Something went wrong" : "You're offline"}>
      <p className="mt-2 text-muted">{problem ?? "Connect to the internet to continue. Your progress so far is saved."}</p>
      <div className="mt-6 grid gap-3">
        <Button onClick={onRetry} disabled={busy}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : <RefreshCw className="size-5" />} Try again
        </Button>
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="size-5" /> Back
          </Button>
        )}
      </div>
    </Panel>
  );
}

/** This build is older than the server supports. */
export function UpdateScreen() {
  return (
    <Panel icon={<Download className="size-8" />} title="Update required">
      <p className="mt-2 text-muted">
        {isNative ? "A new version of PrepQuest is available. Update the app to keep practising." : "PrepQuest has been updated. Reload the page to continue."}
      </p>
      {isNative ? (
        // Capacitor hands links off the app's own pages to Android, which opens them in the Play Store.
        <Button className="mt-6 w-full" onClick={() => (window.location.href = STORE_URL)}>
          <Download className="size-5" /> Update on Google Play
        </Button>
      ) : (
        <Button className="mt-6 w-full" onClick={() => window.location.reload()}>
          <RefreshCw className="size-5" /> Reload
        </Button>
      )}
    </Panel>
  );
}

export function LoadingScreen() {
  return (
    <div className="paper grid min-h-dvh place-items-center text-muted">
      <Loader2 className="size-8 animate-spin" aria-label="Loading" />
    </div>
  );
}
