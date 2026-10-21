import { Atom, BookOpen, Coins, Dna, FlaskConical, Globe2, Mountain, Scroll, Sigma, Vote, type LucideIcon } from "lucide-react";
import type { SubjectId } from "../content/schema";

/** Literal class names so Tailwind can see them at build time. */
export const SUBJECT_STYLE: Record<
  SubjectId,
  { icon: LucideIcon; text: string; bg: string; soft: string; ring: string; glyph: string }
> = {
  maths: { icon: Sigma, text: "text-maths", bg: "bg-maths", soft: "bg-maths/12", ring: "ring-maths/40", glyph: "∑" },
  physics: { icon: Atom, text: "text-physics", bg: "bg-physics", soft: "bg-physics/12", ring: "ring-physics/40", glyph: "λ" },
  chemistry: { icon: FlaskConical, text: "text-chemistry", bg: "bg-chemistry", soft: "bg-chemistry/12", ring: "ring-chemistry/40", glyph: "⚗" },
  biology: { icon: Dna, text: "text-biology", bg: "bg-biology", soft: "bg-biology/12", ring: "ring-biology/40", glyph: "✿" },
  social: { icon: Globe2, text: "text-social", bg: "bg-social", soft: "bg-social/12", ring: "ring-social/40", glyph: "◍" },
  english: { icon: BookOpen, text: "text-english", bg: "bg-english", soft: "bg-english/12", ring: "ring-english/40", glyph: "Aa" },
  history: { icon: Scroll, text: "text-history", bg: "bg-history", soft: "bg-history/12", ring: "ring-history/40", glyph: "⌛" },
  geography: { icon: Mountain, text: "text-geography", bg: "bg-geography", soft: "bg-geography/12", ring: "ring-geography/40", glyph: "⛰" },
  politics: { icon: Vote, text: "text-politics", bg: "bg-politics", soft: "bg-politics/12", ring: "ring-politics/40", glyph: "⚖" },
  economics: { icon: Coins, text: "text-economics", bg: "bg-economics", soft: "bg-economics/12", ring: "ring-economics/40", glyph: "₹" },
};

export function formatTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
