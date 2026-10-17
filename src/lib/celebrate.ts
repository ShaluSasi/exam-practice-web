import confetti from "canvas-confetti";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const COLORS = ["#FF8A1F", "#5B5EF0", "#0F9F5F", "#0B93D4", "#A24EE8", "#FFD23F"];

/** Confetti burst from an element (or the centre of the screen). */
export function burst(from?: Element | null, big = false) {
  if (reduced()) return;
  const r = from?.getBoundingClientRect();
  const origin = r
    ? { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }
    : { x: 0.5, y: 0.6 };
  confetti({
    particleCount: big ? 160 : 60,
    spread: big ? 100 : 70,
    startVelocity: big ? 45 : 32,
    ticks: big ? 260 : 160,
    scalar: 0.9,
    origin,
    colors: COLORS,
    disableForReducedMotion: true,
  });
}
