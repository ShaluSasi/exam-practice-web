import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, X } from "lucide-react";
import clsx from "clsx";
import { RichText } from "../components/RichText";
import { play } from "../lib/sound";
import type { QuestionProps } from "./ChoiceQuestions";

const PAIR_COLORS = ["#5B5EF0", "#E0782A", "#0B93D4", "#D63F8C", "#0F9F5F", "#A24EE8"];

const NO_PAIRS: Record<string, string> = {};

/**
 * Card text. It takes the room left beside the badge and picture, but drops onto its own line
 * when that room is under 4.5rem (narrow phones), and long names such as "Platyhelminthes"
 * break with a hyphen instead of pushing the card wider than its column.
 */
const LABEL = "min-w-0 flex-1 basis-[4.5rem] break-words [overflow-wrap:anywhere] hyphens-auto";

function Thumb({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} draggable={false} className="size-11 shrink-0 select-none rounded-xl sm:size-14" />;
}

interface Line {
  id: string;
  d: string;
  color: string;
}

/** Tap a left item, then its match on the right. Pairs are joined by animated curves. */
export function MatchQuestion({ q, response = NO_PAIRS, onChange, reveal }: QuestionProps<"match">) {
  const [active, setActive] = useState<string | null>(q.left[0]?.id ?? null);
  const box = useRef<HTMLDivElement>(null);
  const leftEls = useRef<Record<string, HTMLElement | null>>({});
  const rightEls = useRef<Record<string, HTMLElement | null>>({});
  const [lines, setLines] = useState<Line[]>([]);
  /**
   * Stacked: the items and their matches as two lists, one under the other. Used only when a card's
   * content cannot fit in half the width, e.g. a chemical equation on a phone; the numbered badges
   * on the matches then show the pairing instead of connector lines.
   */
  const [stacked, setStacked] = useState(false);
  const stackedAt = useRef(0);

  const colorOf = (leftId: string) => PAIR_COLORS[q.left.findIndex((l) => l.id === leftId) % PAIR_COLORS.length];
  const leftFor = (rightId: string) => Object.keys(response).find((l) => response[l] === rightId);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    let live = true;
    const measure = () => {
      if (!live) return;
      const c = el.getBoundingClientRect();
      // Decide only once fonts have loaded: a formula in a fallback font measures wider than it will be.
      if (!stacked && document.fonts?.status !== "loading") {
        // Plain text wraps, so only content that cannot wrap (maths, equations) is ever wider than its card.
        const tooWide = [...el.querySelectorAll<HTMLElement>("[data-match-label]")].some((n) => n.scrollWidth > n.clientWidth + 1);
        if (tooWide) {
          stackedAt.current = c.width;
          setStacked(true);
          return;
        }
      } else {
        // Go back to side by side only if the space grows a lot (e.g. turning the phone), so the layout never flips back and forth.
        if (c.width > stackedAt.current + 80) setStacked(false);
        setLines([]);
        return;
      }
      const next: Line[] = [];
      for (const [l, r] of Object.entries(response)) {
        const a = leftEls.current[l]?.getBoundingClientRect();
        const b = rightEls.current[r]?.getBoundingClientRect();
        if (!a || !b) continue;
        const x1 = a.right - c.left, y1 = a.top + a.height / 2 - c.top;
        const x2 = b.left - c.left, y2 = b.top + b.height / 2 - c.top;
        const mx = (x1 + x2) / 2;
        const color = reveal ? (q.pairs?.[l] === r ? "var(--ok)" : "var(--bad)") : colorOf(l);
        next.push({ id: `${l}-${r}`, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, color });
      }
      setLines(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Maths fonts only start downloading when the first formula appears, so the first measure can use a
    // wider fallback font. When fonts finish loading, check again from side by side.
    const onFonts = () => (stacked ? setStacked(false) : measure());
    document.fonts?.addEventListener("loadingdone", onFonts);
    return () => {
      live = false;
      ro.disconnect();
      document.fonts?.removeEventListener("loadingdone", onFonts);
    };
  }, [response, reveal, stacked]);

  const pickLeft = (id: string) => {
    if (reveal) return;
    play("tap");
    if (active === id && response[id]) {
      const next = { ...response };
      delete next[id];
      onChange(next);
    }
    setActive(id);
  };

  const pickRight = (id: string) => {
    if (reveal || !active) return;
    play("tap");
    const next = { ...response };
    for (const k of Object.keys(next)) if (next[k] === id) delete next[k];
    next[active] = id;
    onChange(next);
    setActive(q.left.find((l) => !next[l.id])?.id ?? null);
  };

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-muted">
        {reveal ? "Your matches" : stacked ? "Tap an item, then its match in the list below" : "Tap an item on the left, then its match on the right"}
      </p>
      {/* minmax(0,1fr): both columns stay exactly half the width. With plain 1fr a long word or a
          picture forces a column wider than half, and the left cards slide over the right ones on phones. */}
      <div
        ref={box}
        className={clsx("relative grid gap-y-3", stacked ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-6 sm:gap-x-20")}
      >
        <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
          {lines.map((ln) => (
            <motion.path
              key={ln.id}
              d={ln.d}
              fill="none"
              stroke={ln.color}
              strokeWidth={3}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          ))}
        </svg>

        <div className="grid min-w-0 content-start gap-3">
          {q.left.map((l, i) => {
            const paired = response[l.id];
            const isActive = !reveal && active === l.id;
            const right = reveal && paired === q.pairs?.[l.id];
            const color = colorOf(l.id);
            return (
              <motion.button
                key={l.id}
                ref={(el) => {
                  leftEls.current[l.id] = el;
                }}
                type="button"
                disabled={reveal}
                onClick={() => pickLeft(l.id)}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 * i }}
                whileTap={reveal ? undefined : { scale: 0.97 }}
                style={paired && !reveal ? { borderColor: color } : undefined}
                className={clsx(
                  "relative flex min-h-14 w-full min-w-0 flex-wrap items-center gap-2 rounded-2xl border-2 bg-surface px-2.5 py-2.5 sm:flex-nowrap sm:gap-2.5 sm:px-3 text-left text-[15px] leading-snug transition-[border-color,box-shadow]",
                  !paired && !isActive && "border-line",
                  isActive && "border-brand shadow-[0_3px_0_0_var(--brand)]",
                  reveal && (right ? "border-ok bg-ok-soft" : "border-bad bg-bad-soft"),
                )}
              >
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full font-display text-xs font-bold text-white"
                  style={{ background: reveal ? (right ? "var(--ok)" : "var(--bad)") : color }}
                >
                  {reveal ? right ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                {l.image && <Thumb src={l.image.src} alt={l.image.alt} />}
                <span data-match-label className={clsx(LABEL, stacked && "overflow-x-auto")}>
                  <RichText text={l.text} className="font-semibold" />
                  {reveal && !right && (
                    <span className="mt-1 block text-xs font-semibold text-ok">
                      → <RichText text={q.right.find((r) => r.id === q.pairs?.[l.id])?.text ?? ""} />
                    </span>
                  )}
                </span>
                {isActive && (
                  <motion.span
                    layoutId={`match-active-${q.id}`}
                    className="absolute -right-1.5 top-1/2 size-3 -translate-y-1/2 rounded-full bg-brand"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        <div className={clsx("grid min-w-0 content-start gap-3", stacked && "mt-3")}>
          {stacked && <p className="text-sm font-semibold text-muted">{reveal ? "Matched to" : "Matches"}</p>}
          {q.right.map((r, i) => {
            const by = leftFor(r.id);
            const color = by ? colorOf(by) : undefined;
            const n = by ? q.left.findIndex((l) => l.id === by) + 1 : null;
            return (
              <motion.button
                key={r.id}
                ref={(el) => {
                  rightEls.current[r.id] = el;
                }}
                type="button"
                disabled={reveal || !active}
                onClick={() => pickRight(r.id)}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 * i + 0.1 }}
                whileTap={reveal || !active ? undefined : { scale: 0.97 }}
                style={by && !reveal ? { borderColor: color } : undefined}
                className={clsx(
                  "flex min-h-14 w-full min-w-0 flex-wrap items-center gap-2 rounded-2xl border-2 bg-surface px-2.5 py-2.5 text-left text-[14px] sm:flex-nowrap sm:gap-2.5 sm:px-3 sm:text-[15px] leading-snug transition-[border-color,transform]",
                  !by && "border-line",
                  !reveal && active && !by && "hover:-translate-y-0.5 hover:border-fg/25",
                  reveal && "border-line",
                  !reveal && !active && "cursor-default",
                )}
              >
                <motion.span
                  key={n ?? "none"}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  className={clsx(
                    "grid size-6 shrink-0 place-items-center rounded-full font-display text-xs font-bold",
                    n ? "text-white" : "border-2 border-dashed border-line",
                  )}
                  style={n ? { background: reveal ? "var(--muted)" : color } : undefined}
                >
                  {n}
                </motion.span>
                {r.image && <Thumb src={r.image.src} alt={r.image.alt} />}
                <span data-match-label className={clsx(LABEL, stacked && "overflow-x-auto")}>
                  <RichText text={r.text} />
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
