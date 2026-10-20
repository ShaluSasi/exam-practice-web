/**
 * Number Rush problems. Every problem is generated on the fly, with wrong
 * options built from the mistakes students really make (adding the bottoms
 * of fractions, multiplying powers instead of adding them, ignoring BODMAS…)
 * and a short tip shown in the end-of-game review.
 */

export type Skill =
  | "Times tables"
  | "Add & subtract"
  | "Squares"
  | "Negative numbers"
  | "Percentages"
  | "Square roots"
  | "Exponents"
  | "Fractions"
  | "BODMAS"
  | "Cubes"
  | "HCF & LCM"
  | "Linear equations";

export interface Problem {
  skill: Skill;
  /** Text with $maths$. */
  prompt: string;
  answer: string;
  options: string[];
  tip: string;
}

/** Skills unlocked at each level (level 1 is the first entry). */
export const LEVEL_SKILLS: Skill[][] = [
  ["Times tables", "Add & subtract"],
  ["Squares", "Negative numbers"],
  ["Percentages", "Square roots"],
  ["Exponents", "Fractions"],
  ["BODMAS", "Cubes"],
  ["HCF & LCM", "Linear equations"],
];
export const MAX_LEVEL = LEVEL_SKILLS.length;

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

function shuffle<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

/** Four distinct options: the answer, the listed mistakes, then padding from `pad`. */
function options(answer: string, wrong: string[], pad: (i: number) => string): string[] {
  const set = new Set([answer]);
  for (const w of wrong) if (set.size < 4) set.add(w);
  for (let i = 1; set.size < 4 && i < 50; i++) set.add(pad(i));
  return shuffle([...set]);
}

const $ = (x: string | number) => `$${x}$`;

/** Numeric problem: options are numbers; padding steps away from the answer. */
function numeric(skill: Skill, prompt: string, answer: number, wrong: number[], tip: string, positive = true): Problem {
  const ok = (n: number) => Number.isInteger(n) && n !== answer && (!positive || n > 0);
  const steps = [1, -1, 2, -2, 10, -10, 3, -3, 5, -5, 4, -4, 20, -20];
  return {
    skill,
    prompt,
    answer: $(answer),
    options: options(
      $(answer),
      wrong.filter(ok).map($),
      (i) => {
        const n = answer + steps[(i - 1) % steps.length] * Math.ceil(i / steps.length);
        return ok(n) ? $(n) : $(answer + 100 + i);
      },
    ),
    tip,
  };
}

const GENERATORS: Record<Skill, (level: number) => Problem> = {
  "Times tables": (level) => {
    const a = rnd(3, level < 3 ? 12 : 19);
    const b = rnd(3, 12);
    const tip =
      a > 10
        ? `Split it: $${a} \\times ${b} = 10 \\times ${b} + ${a - 10} \\times ${b} = ${10 * b} + ${(a - 10) * b}$.`
        : `Build from a table you know: $${a} \\times ${b} = ${a} \\times ${b - 1} + ${a} = ${a * (b - 1)} + ${a}$.`;
    return numeric("Times tables", `$${a} \\times ${b}$`, a * b, [a * (b + 1), a * (b - 1), (a + 1) * b, a * b + 10], tip);
  },

  "Add & subtract": () => {
    const a = rnd(34, 98);
    let b = rnd(13, a - 8);
    if (b % 10 === 0) b++;
    const tens = Math.floor(b / 10) * 10;
    if (Math.random() < 0.5) {
      return numeric("Add & subtract", `$${a} + ${b}$`, a + b, [a + b - 10, a + b + 10, a + b - 1], `Add the tens first, then the ones: $${a} + ${tens} = ${a + tens}$, then $+ ${b - tens}$.`);
    }
    return numeric("Add & subtract", `$${a} - ${b}$`, a - b, [a - b + 10, a - b - 10, a - b + 2], `Take away the tens first, then the ones: $${a} - ${tens} = ${a - tens}$, then $- ${b - tens}$.`);
  },

  Squares: (level) => {
    const n = rnd(11, level < 4 ? 20 : 25);
    const t = Math.floor(n / 10) * 10;
    const u = n - t;
    const tip =
      u === 0
        ? `$${n}^2 = ${n} \\times ${n} = ${n * n}$.`
        : `Use $(a+b)^2 = a^2 + 2ab + b^2$: $${n}^2 = ${t * t} + ${2 * t * u} + ${u * u} = ${n * n}$.`;
    return numeric("Squares", `$${n}^2$`, n * n, [t * t + u * u, n * n + n, 2 * n, (n + 1) * (n + 1) - 1], tip);
  },

  "Negative numbers": () => {
    const a = rnd(2, 12);
    const b = rnd(2, 12);
    const form = rnd(1, 3);
    if (form === 1)
      return numeric("Negative numbers", `$(-${a}) \\times ${b}$`, -a * b, [a * b, -(a + b), -a * b - 1], "A minus times a plus gives a minus.", false);
    if (form === 2)
      return numeric("Negative numbers", `$(-${a}) \\times (-${b})$`, a * b, [-a * b, -(a + b), a + b], "A minus times a minus gives a **plus**.", false);
    return numeric(
      "Negative numbers",
      `$-${a} - (-${b})$`,
      -a + b,
      [-a - b, a + b, a - b],
      `Taking away a negative is the same as adding: $-${a} - (-${b}) = -${a} + ${b}$.`,
      false,
    );
  },

  Percentages: () => {
    const p = pick([5, 10, 15, 20, 25, 50, 75]);
    const n = 20 * rnd(2, 15);
    const ans = (p * n) / 100;
    const how: Record<number, string> = {
      5: `5% is half of 10%. 10% of ${n} is ${n / 10}, so 5% is ${ans}.`,
      10: `For 10%, divide by 10: ${n} ÷ 10 = ${ans}.`,
      15: `15% = 10% + 5% = ${n / 10} + ${n / 20} = ${ans}.`,
      20: `20% is double 10%: 2 × ${n / 10} = ${ans}.`,
      25: `25% is a quarter: ${n} ÷ 4 = ${ans}.`,
      50: `50% is half: ${n} ÷ 2 = ${ans}.`,
      75: `75% is three quarters: ${n} ÷ 4 × 3 = ${ans}.`,
    };
    return numeric("Percentages", `$${p}\\%$ of $${n}$`, ans, [ans * 10, n - ans, ans + n / 10, n / p], how[p]);
  },

  "Square roots": () => {
    const n = rnd(11, 25);
    return numeric(
      "Square roots",
      `$\\sqrt{${n * n}}$`,
      n,
      [n + 1, n - 1, n + 10, Math.round((n * n) / 2)],
      `$${n}^2 = ${n * n}$, so $\\sqrt{${n * n}} = ${n}$. Knowing squares up to $25^2$ makes roots instant.`,
    );
  },

  Exponents: () => {
    const b = pick(["2", "3", "5", "7", "a", "x"]);
    const m = rnd(2, 8);
    const n = rnd(2, 6);
    const form = rnd(1, 3);
    const pw = (k: number) => `$${b}^{${k}}$`;
    const build = (prompt: string, ans: number, wrong: number[], tip: string): Problem => ({
      skill: "Exponents",
      prompt,
      answer: pw(ans),
      options: options(pw(ans), wrong.filter((k) => k > 0 && k !== ans).map(pw), (i) => pw(ans + i + 1)),
      tip,
    });
    if (form === 1) return build(`$${b}^{${m}} \\times ${b}^{${n}}$`, m + n, [m * n, Math.abs(m - n), m + n + 1], "Same base, multiplying: **add** the powers. $a^m \\times a^n = a^{m+n}$.");
    if (form === 2) {
      const hi = m + n;
      return build(`$${b}^{${hi}} \\div ${b}^{${n}}$`, m, [hi + n, hi * n, m + 1], "Same base, dividing: **subtract** the powers. $a^m \\div a^n = a^{m-n}$.");
    }
    return build(`$(${b}^{${m}})^{${n}}$`, m * n, [m + n, m * n + 1, Math.abs(m * n - m)], "Power of a power: **multiply** the powers. $(a^m)^n = a^{mn}$.");
  },

  Fractions: () => {
    const a = rnd(2, 9);
    let b = rnd(2, 9);
    if (b === a) b = a === 9 ? 8 : a + 1;
    const frac = (p: number, q: number) => {
      const g = gcd(p, q);
      return `$\\frac{${p / g}}{${q / g}}$`;
    };
    const ans = frac(a + b, a * b);
    const wrong = [frac(2, a + b), frac(1, a + b), frac(1, a * b), frac(a + b, a * b + 1)].filter((w) => w !== ans);
    return {
      skill: "Fractions",
      prompt: `$\\frac{1}{${a}} + \\frac{1}{${b}}$`,
      answer: ans,
      options: options(ans, wrong, (i) => frac(i + 2, a * b + i)),
      tip: `Make the bottoms the same first: $\\frac{${b}}{${a * b}} + \\frac{${a}}{${a * b}} = \\frac{${a + b}}{${a * b}}$. Never add the bottoms!`,
    };
  },

  BODMAS: () => {
    const a = rnd(2, 15);
    const b = rnd(2, 9);
    const c = rnd(2, 9);
    if (Math.random() < 0.5)
      return numeric(
        "BODMAS",
        `$${a} + ${b} \\times ${c}$`,
        a + b * c,
        [(a + b) * c, a * b + c, a + b + c],
        `BODMAS: multiply before you add. $${b} \\times ${c} = ${b * c}$, then $${a} + ${b * c} = ${a + b * c}$.`,
      );
    return numeric(
      "BODMAS",
      `$${b} \\times (${a} + ${c})$`,
      b * (a + c),
      [b * a + c, b + a + c, b * a * c],
      `Brackets first: $${a} + ${c} = ${a + c}$, then $${b} \\times ${a + c} = ${b * (a + c)}$.`,
    );
  },

  Cubes: () => {
    const n = rnd(2, 12);
    return numeric("Cubes", `$${n}^3$`, n ** 3, [n * n, 3 * n, n ** 3 + n, (n + 1) ** 3], `$${n}^3 = ${n} \\times ${n} \\times ${n} = ${n * n} \\times ${n} = ${n ** 3}$. It is not $3 \\times ${n}$.`);
  },

  "HCF & LCM": () => {
    const [p, q] = pick([[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [2, 7], [3, 7], [5, 6]] as const);
    const g = rnd(2, 9);
    const x = g * p;
    const y = g * q;
    const lcm = g * p * q;
    const tip = `$${x} = ${g} \\times ${p}$ and $${y} = ${g} \\times ${q}$. HCF $= ${g}$, LCM $= ${g} \\times ${p} \\times ${q} = ${lcm}$. Check: HCF × LCM $= ${x} \\times ${y}$.`;
    return Math.random() < 0.5
      ? numeric("HCF & LCM", `HCF of $${x}$ and $${y}$`, g, [lcm, p, g * p, 1], tip)
      : numeric("HCF & LCM", `LCM of $${x}$ and $${y}$`, lcm, [x * y, g, x + y, lcm * 2], tip);
  },

  "Linear equations": () => {
    const x = rnd(2, 12);
    const a = rnd(2, 9);
    const b = rnd(1, 20);
    const c = a * x + b;
    return numeric(
      "Linear equations",
      `$${a}x + ${b} = ${c}$, so $x = ?$`,
      x,
      [(c + b) / a, c - b, x + 1, Math.round(c / a)],
      `Take ${b} from both sides: $${a}x = ${c - b}$. Then divide by ${a}: $x = ${x}$.`,
    );
  },
};

/** A new problem for the level, avoiding the previous skill and prompt where possible. */
export function nextProblem(level: number, prev?: Problem): Problem {
  const pool = LEVEL_SKILLS.slice(0, level).flat();
  // Lean on the newest skills so a level-up feels new.
  const fresh = LEVEL_SKILLS[level - 1];
  for (let i = 0; i < 6; i++) {
    const skill = Math.random() < 0.45 ? pick(fresh) : pick(pool);
    if (prev && skill === prev.skill && pool.length > 1) continue;
    const p = GENERATORS[skill](level);
    if (p.prompt !== prev?.prompt) return p;
  }
  return GENERATORS[pick(pool)](level);
}
