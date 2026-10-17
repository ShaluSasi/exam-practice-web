import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Maximize2, X } from "lucide-react";
import clsx from "clsx";
import type { Media } from "../content/schema";

function Markers({ media }: { media: Media }) {
  return (
    <>
      {media.markers?.map((m, i) => (
        <motion.span
          key={m.label}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.25 + i * 0.08, type: "spring", stiffness: 500, damping: 18 }}
          className="pointer-events-none absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-fg font-display text-sm font-extrabold text-bg shadow-pop ring-2 ring-white"
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
        >
          {m.label}
        </motion.span>
      ))}
    </>
  );
}

/**
 * A question illustration. The frame is exactly the image box, so overlays
 * (markers, hotspot buttons passed as children) can be placed in percent.
 * Sized by width: SVGs with only a viewBox have no intrinsic size.
 */
export function Figure({
  media,
  children,
  zoomable = true,
  className,
  frameClassName = "max-w-[520px]",
}: {
  media: Media;
  children?: ReactNode;
  zoomable?: boolean;
  className?: string;
  frameClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  return (
    <figure className={clsx("flex flex-col items-center", className)}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className={clsx("relative w-full", frameClassName)}
      >
        <img
          src={media.src}
          alt={media.alt}
          draggable={false}
          className="block h-auto w-full select-none rounded-2xl border-2 border-line"
        />
        <Markers media={media} />
        {children}
        {zoomable && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Enlarge image"
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg bg-white/85 text-[#2B2F4A] shadow-card backdrop-blur hover:bg-white"
          >
            <Maximize2 className="size-4" />
          </button>
        )}
      </motion.div>
      {media.caption && <figcaption className="mt-2 text-center text-xs font-semibold text-muted">{media.caption}</figcaption>}

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
              role="dialog"
              aria-label={media.alt}
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="relative"
                style={{ width: "min(900px, 92vw, 110dvh)" }}
              >
                <img src={media.src} alt={media.alt} className="block h-auto w-full rounded-3xl" />
                <Markers media={media} />
              </motion.div>
              <button
                type="button"
                aria-label="Close"
                className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white text-[#2B2F4A]"
              >
                <X className="size-6" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </figure>
  );
}
