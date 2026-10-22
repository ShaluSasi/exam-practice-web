import { Atom, FlaskConical, Layers, Rocket, Zap, type LucideIcon } from "lucide-react";
import type { GameId } from "../store/games";

export interface GameMeta {
  id: GameId;
  title: string;
  tagline: string;
  subject: string;
  minutes: string;
  icon: LucideIcon;
  /** Literal gradient classes so Tailwind sees them at build time. */
  gradient: string;
  /** What the score means, e.g. "points" or "stars". */
  unit: string;
  how: string[];
  /** Shown to students and parents: what the game practises. */
  learn: string[];
  /** Lowest class this game's content suits. Hidden from students below it so they never see unlearned material. */
  minGrade?: number;
  /** Highest class this game is meant for. Hidden from students above it. */
  maxGrade?: number;
}

export const GAMES: GameMeta[] = [
  {
    id: "galaxy",
    title: "Galaxy Guardian",
    tagline: "Asteroids are coming. Only maths can save Earth.",
    subject: "Maths",
    minutes: "3–5 min",
    icon: Rocket,
    gradient: "from-[#0b1030] via-[#3b1d8f] to-[#c026d3]",
    unit: "points",
    how: [
      "Choose a mission: ×, ÷, +, −, fractions, percentages and more, or Mixed for a bit of everything.",
      "A question appears below. Tap the asteroid with the right answer to blast it.",
      "If the right asteroid hits Earth, or you shoot a wrong one, you lose a shield.",
      "Every wave you clear is a level up: bigger numbers, trickier questions, faster asteroids. Beat the mothership every 4th wave!",
      "Your best score goes on the scoreboard: see your rank in each mission and overall, and challenge friends with a link.",
    ],
    learn: ["Addition and subtraction", "Times tables", "Division and remainders", "Squares and roots", "Fractions", "Percentages", "Integers", "Laws of exponents", "Linear equations", "BODMAS"],
  },
  {
    id: "rush",
    title: "Number Rush",
    tagline: "60 seconds. How many can you crack?",
    subject: "Maths",
    minutes: "1 min",
    icon: Zap,
    gradient: "from-[#5b5ef0] via-[#7c4dff] to-[#c04df0]",
    unit: "points",
    how: [
      "Tap the right answer before the clock runs out.",
      "Right answers add time. Wrong answers take 3 seconds away.",
      "Get answers right in a row for a combo: up to ×4 points.",
    ],
    learn: ["Times tables", "Squares and roots", "Percentages", "Laws of exponents", "Fractions", "BODMAS", "HCF and LCM", "Linear equations"],
  },
  {
    id: "balance",
    title: "Balance It!",
    tagline: "Balance real reactions from your textbook.",
    subject: "Chemistry",
    minutes: "2 min",
    // Types of reactions is Class 10 Chemistry content; see equations.ts.
    minGrade: 10,
    icon: FlaskConical,
    gradient: "from-[#0b93d4] via-[#6d5cf0] to-[#a24ee8]",
    unit: "stars",
    how: [
      "Tap ▲ and ▼ to change the big numbers in front of each formula.",
      "Make the atoms on both sides equal. The scale shows how close you are.",
      "Fewer moves earn more stars. Stuck? Use a hint.",
    ],
    learn: ["Law of conservation of mass", "Balancing equations", "Types of reactions", "Chemical formulae", "Reactions in daily life"],
  },
  {
    id: "facts",
    title: "Fact or Fiction",
    tagline: "Swipe right for fact, left for fiction.",
    subject: "Science · Maths · Social",
    minutes: "3 min",
    icon: Layers,
    gradient: "from-[#ff8a1f] via-[#f0566a] to-[#d6336c]",
    unit: "points",
    how: [
      "Read the statement. Swipe right if it's true, left if it's false.",
      "Every card shows a one-line reason, so you learn even when you miss.",
      "You have 3 lives. Keep your streak going for bonus points.",
    ],
    learn: ["Common exam traps", "Physics and Chemistry facts", "Cell biology", "Number systems and geometry", "History, geography and civics"],
  },
  {
    id: "elements",
    title: "Element Lab",
    tagline: "Symbols, valency and atoms. How fast can you go?",
    subject: "Chemistry",
    minutes: "1 min",
    // Class 9 chemistry only; Class 10 students don't see it.
    minGrade: 9,
    maxGrade: 9,
    icon: Atom,
    gradient: "from-[#0b93d4] via-[#14b8a6] to-[#22c55e]",
    unit: "points",
    how: [
      "Tap the right answer before the clock runs out.",
      "Right answers add time. Wrong answers take 3 seconds away.",
      "Get answers right in a row for a combo: up to ×4 points.",
    ],
    learn: ["Symbols of elements", "Valency", "Atomic number", "Protons, neutrons and electrons", "Separating mixtures"],
  },
];

export const gameMeta = (id: GameId) => GAMES.find((g) => g.id === id)!;
