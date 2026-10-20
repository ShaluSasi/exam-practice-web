/**
 * Galaxy Guardian missions: one kind of question each (multiplication,
 * division, fractions…), plus Mixed. Every mission is a ladder of levels;
 * each wave climbs one level, so the numbers get bigger and the questions
 * trickier as the student survives longer.
 *
 * Wrong options are the mistakes students really make (forgetting to carry,
 * adding the bottoms of fractions, multiplying powers instead of adding…),
 * and every question has a short tip for the end-of-game review.
 */

export type SectionId =
  | "mixed"
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "squares"
  | "fractions"
  | "percent"
  | "integers"
  | "powers"
  | "equations"
  | "bodmas";

export interface Question {
  skill: string;
  /** Text with $maths$. */
  prompt: string;
  answer: string;
  options: string[];
  tip: string;
  /** Extra seconds for the asteroids to fall, for questions that need working out. */
  slow?: number;
}

interface Tier {
  label: string;
  make: () => Question;
  slow?: number;
}

export interface Section {
  id: SectionId;
  name: string;
  /** Big glyph on the mission card. */
  symbol: string;
  color: string;
  blurb: string;
  tiers: Tier[];
}

// ---------- helpers ----------

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const $ = (x: string | number) => `$${x}$`;
/** Rounds away floating-point noise: 0.1 + 0.2 -> 0.3. */
const tidy = (n: number) => Math.round(n * 1000) / 1000;
/** A number with one decimal place that isn't whole, between a/10 and b/10. */
function dec(a: number, b: number): number {
  let n = rnd(a, b);
  while (n % 10 === 0) n = rnd(a, b);
  return n / 10;
}

function shuffle<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

/** Four distinct options: the answer, the listed mistakes, then padding. */
function four(answer: string, wrong: string[], pad: (i: number) => string): string[] {
  const set = new Set([answer]);
  for (const w of wrong) if (set.size < 4) set.add(w);
  for (let i = 1; set.size < 4 && i < 60; i++) set.add(pad(i));
  return shuffle([...set]);
}

interface NumOpts {
  /** Allow zero and negative options. */
  signed?: boolean;
  /** Smallest gap between padding options (0.1 for decimals). */
  step?: number;
  /** How a value is shown, e.g. with a % sign. */
  show?: (n: number) => string;
}

/** A question whose options are numbers. */
function num(skill: string, prompt: string, answer: number, wrong: number[], tip: string, o: NumOpts = {}): Question {
  const step = o.step ?? 1;
  const show = o.show ?? ((n: number) => $(tidy(n)));
  const ok = (n: number) => Number.isFinite(n) && tidy(n) !== tidy(answer) && (o.signed || n > 0) && (step < 1 || Number.isInteger(n));
  const steps = [1, -1, 2, -2, 10, -10, 3, -3, 5, -5, 4, -4, 20, -20];
  return {
    skill,
    prompt,
    answer: show(answer),
    options: four(
      show(answer),
      wrong.filter(ok).map(show),
      (i) => {
        const n = tidy(answer + steps[(i - 1) % steps.length] * Math.ceil(i / steps.length) * step);
        return ok(n) ? show(n) : show(tidy(answer + (100 + i) * step));
      },
    ),
    tip,
  };
}

const pct = (n: number) => `$${tidy(n)}\\%$`;

/** "a + 300 = …, + 40 = …, + 5 = …": add or take away `b` one place value at a time. */
function placeTip(a: number, b: number, op: "+" | "−"): string {
  const parts: number[] = [];
  let rest = b;
  for (let p = 10 ** Math.floor(Math.log10(Math.max(1, b))); p >= 1; p /= 10) {
    const d = Math.floor(rest / p) * p;
    if (d) parts.push(d);
    rest -= d;
  }
  let acc = a;
  const steps = parts.map((d) => {
    acc = op === "+" ? acc + d : acc - d;
    return `${op} ${d} = ${acc}`;
  });
  if (steps.length < 2) return `Count ${op === "+" ? "on" : "back"} from $${a}$: $${a} ${steps[0] ?? ""}$.`;
  return `One place at a time: $${a} ${steps.join(",\\ ")}$.`;
}

/** Splits `a` into place values and multiplies each by `b`. */
function splitTip(a: number, b: number): string {
  const parts: number[] = [];
  let rest = a;
  for (let p = 10 ** Math.floor(Math.log10(a)); p >= 1; p /= 10) {
    const d = Math.floor(rest / p) * p;
    if (d) parts.push(d);
    rest -= d;
  }
  return `Split it up: $${parts.map((d) => `${d} \\times ${b}`).join(" + ")} = ${parts.map((d) => d * b).join(" + ")} = ${a * b}$.`;
}

// ---------- fractions ----------

type Frac = [number, number];

function simplify([p, q]: Frac): Frac {
  const g = gcd(p, q) || 1;
  return q / g < 0 ? [-p / g, -q / g] : [p / g, q / g];
}

/** LaTeX for a fraction in simplest form; whole numbers stay whole, and `mixed` writes 7/2 as 3½. */
function texFrac(f: Frac, mixed = false): string {
  const [p, q] = simplify(f);
  if (q === 1) return `${p}`;
  if (mixed && Math.abs(p) > q) {
    const w = Math.trunc(p / q);
    return `${w}\\frac{${Math.abs(p - w * q)}}{${q}}`;
  }
  return `${p < 0 ? "-" : ""}\\frac{${Math.abs(p)}}{${q}}`;
}

/** Options are fractions with different values (never 2/4 next to 1/2). */
function fracQ(skill: string, prompt: string, answer: Frac, wrong: Frac[], tip: string, mixed = false): Question {
  const key = (f: Frac) => simplify(f).join("/");
  const seen = new Set([key(answer)]);
  const opts = [$(texFrac(answer, mixed))];
  const add = (f: Frac) => {
    if (opts.length >= 4 || f[1] <= 0 || f[0] <= 0 || seen.has(key(f))) return;
    seen.add(key(f));
    opts.push($(texFrac(f, mixed)));
  };
  wrong.forEach(add);
  const [p, q] = simplify(answer);
  for (let i = 1; opts.length < 4 && i < 30; i++) add(i % 2 ? [p + Math.ceil(i / 2), q] : [p, q + i / 2]);
  return { skill, prompt, answer: opts[0], options: shuffle(opts), tip };
}

const F = (p: number | string, q: number | string) => `\\frac{${p}}{${q}}`;

// ---------- the missions ----------

const ADD = "Addition";
const SUB = "Subtraction";
const MUL = "Multiplication";
const DIV = "Division";

function addQ(a: number, b: number): Question {
  const s = a + b;
  return num(ADD, `$${a} + ${b}$`, s, [s - 10, s + 10, s + 1, s - 1, s + 100], placeTip(a, b, "+"));
}

function subQ(a: number, b: number): Question {
  const d = a - b;
  return num(SUB, `$${a} - ${b}$`, d, [d + 10, d - 10, d + 1, d - 1, d + 100], placeTip(a, b, "−"));
}

function mulQ(a: number, b: number, tip?: string): Question {
  const p = a * b;
  return num(MUL, `$${a} \\times ${b}$`, p, [a * (b + 1), a * (b - 1), (a + 1) * b, p + 10, p - 10], tip ?? (a > 12 ? splitTip(a, b) : `Count up in ${b}s ${a} times, or use $${a} \\times ${b - 1} + ${a} = ${a * (b - 1)} + ${a}$.`));
}

function divQ(d: number, q: number, tip?: string): Question {
  const n = d * q;
  return num(DIV, `$${n} \\div ${d}$`, q, [q + 1, q - 1, q + 10, q - 10, q * 10, n - d], tip ?? `Think of the ${d} times table: $${d} \\times ${q} = ${n}$, so $${n} \\div ${d} = ${q}$.`);
}

const SQ = "Squares & roots";
const square = (n: number, tip?: string) =>
  num(SQ, `$${n}^2$`, n * n, [2 * n, n * n + n, n * n - n, (n + 1) ** 2, n * n + 10], tip ?? `$${n}^2 = ${n} \\times ${n} = ${n * n}$. It is not $2 \\times ${n}$.`);
const root = (n: number) =>
  num(SQ, `$\\sqrt{${n * n}}$`, n, [n + 1, n - 1, n + 10, Math.round((n * n) / 2), n * 2], `$${n} \\times ${n} = ${n * n}$, so $\\sqrt{${n * n}} = ${n}$.`);

const FR = "Fractions";
const PC = "Percentages";
const INT = "Integers";
const POW = "Powers";
const EQ = "Equations";
const BOD = "BODMAS";

function powQ(b: string, prompt: string, ans: number, wrong: number[], tip: string): Question {
  const pw = (k: number) => `$${b}^{${k}}$`;
  return { skill: POW, prompt, answer: pw(ans), options: four(pw(ans), wrong.filter((k) => k > 0 && k !== ans).map(pw), (i) => pw(ans + i + 1)), tip };
}

export const SECTIONS: Section[] = [
  {
    id: "mixed",
    name: "Mixed",
    symbol: "∞",
    color: "#c084fc",
    blurb: "A bit of everything",
    tiers: [], // Built from the other missions below.
  },
  {
    id: "add",
    name: "Addition",
    symbol: "+",
    color: "#6bff8f",
    blurb: "From 7 + 5 to 4-digit sums",
    tiers: [
      { label: "Single digits", make: () => { const a = rnd(2, 9), b = rnd(2, 9); return num(ADD, `$${a} + ${b}$`, a + b, [a + b + 1, a + b - 1, a + b + 2], `Start at the bigger number and count on: $${Math.max(a, b)}$, then ${Math.min(a, b)} more.`); } },
      { label: "2-digit + 1-digit", make: () => addQ(rnd(11, 89), rnd(3, 9)) },
      { label: "2-digit + 2-digit", make: () => addQ(rnd(12, 59), rnd(12, 39)) },
      { label: "Bigger 2-digit sums", make: () => addQ(rnd(35, 99), rnd(35, 99)) },
      { label: "3-digit + 2-digit", make: () => addQ(rnd(101, 899), rnd(11, 99)), slow: 0.5 },
      { label: "3-digit + 3-digit", make: () => addQ(rnd(120, 799), rnd(120, 799)), slow: 1 },
      {
        label: "Three numbers",
        slow: 1,
        make: () => {
          const a = rnd(12, 79), b = rnd(12, 79), c = rnd(12, 79), s = a + b + c;
          return num(ADD, `$${a} + ${b} + ${c}$`, s, [s - 10, s + 10, s - 1, a + b, s + 20], `Two at a time: $${a} + ${b} = ${a + b}$, then $${a + b} + ${c} = ${s}$.`);
        },
      },
      {
        label: "Decimals",
        slow: 1,
        make: () => {
          const a = dec(11, 99), b = dec(11, 99), s = tidy(a + b);
          const tenths = Math.round((a % 1) * 10) + Math.round((b % 1) * 10);
          // Adding the parts separately: 4.7 + 3.8 -> 7.15.
          const slip = tenths >= 10 ? Number(`${Math.floor(a) + Math.floor(b)}.${tenths}`) : s + 1;
          return num(ADD, `$${a} + ${b}$`, s, [slip, tidy(s - 1), tidy(s + 0.1), tidy(s - 0.1)], `Line up the decimal points. Ten tenths make one whole, so carry it: $${a} + ${b} = ${s}$.`, { step: 0.1 });
        },
      },
      { label: "4-digit + 3-digit", make: () => addQ(rnd(1000, 8999), rnd(101, 999)), slow: 1.5 },
      { label: "4-digit + 4-digit", make: () => addQ(rnd(1000, 4999), rnd(1000, 4999)), slow: 2 },
    ],
  },
  {
    id: "sub",
    name: "Subtraction",
    symbol: "−",
    color: "#5ee7ff",
    blurb: "Take-aways, borrowing, below zero",
    tiers: [
      { label: "Take away from teens", make: () => { const a = rnd(11, 18), b = rnd(2, 9); return num(SUB, `$${a} - ${b}$`, a - b, [a - b + 1, a - b - 1, a + b], `Think of adding: $${b} + ? = ${a}$. The answer is $${a - b}$.`); } },
      { label: "2-digit − 1-digit", make: () => subQ(rnd(21, 99), rnd(3, 9)) },
      { label: "2-digit − 2-digit", make: () => { const a = rnd(40, 99); return subQ(a, rnd(11, a - 6)); } },
      { label: "3-digit − 2-digit", make: () => subQ(rnd(120, 999), rnd(11, 99)), slow: 0.5 },
      { label: "3-digit − 3-digit", make: () => { const a = rnd(300, 999); return subQ(a, rnd(101, a - 20)); }, slow: 1 },
      {
        label: "Below zero",
        make: () => {
          const a = rnd(2, 20), b = a + rnd(1, 20);
          return num(SUB, `$${a} - ${b}$`, a - b, [b - a, a - b + 1, a - b - 1, -(a + b)], `You take away more than you have, so the answer is negative: $${b} - ${a} = ${b - a}$, so $${a} - ${b} = -${b - a}$.`, { signed: true });
        },
      },
      {
        label: "Decimals",
        slow: 1,
        make: () => {
          const a = dec(50, 199), b = dec(11, Math.round(a * 10) - 5), d = tidy(a - b);
          return num(SUB, `$${a} - ${b}$`, d, [tidy(d + 1), tidy(d - 1), tidy(d + 0.1), tidy(d - 0.1)], `Line up the decimal points, then take away tenths and ones: $${a} - ${b} = ${d}$.`, { step: 0.1 });
        },
      },
      { label: "4-digit − 3-digit", make: () => subQ(rnd(1000, 9999), rnd(101, 999)), slow: 1.5 },
      { label: "4-digit − 4-digit", make: () => { const a = rnd(3000, 9999); return subQ(a, rnd(1000, a - 100)); }, slow: 2 },
    ],
  },
  {
    id: "mul",
    name: "Multiplication",
    symbol: "×",
    color: "#ffd23f",
    blurb: "Tables to 3-digit products",
    tiers: [
      { label: "Tables of 2, 5 and 10", make: () => mulQ(pick([2, 5, 10]), rnd(1, 10)) },
      { label: "Tables up to 5", make: () => mulQ(rnd(3, 5), rnd(2, 10)) },
      { label: "Tables up to 10", make: () => mulQ(rnd(6, 10), rnd(2, 10)) },
      { label: "Tables up to 12", make: () => mulQ(rnd(6, 12), rnd(6, 12)) },
      {
        label: "Multiplying tens",
        make: () => {
          const a = rnd(2, 9), t = rnd(2, 9);
          return mulQ(a, t * 10, `$${a} \\times ${t} = ${a * t}$, then add a zero: $${a} \\times ${t * 10} = ${a * t * 10}$.`);
        },
      },
      { label: "2-digit × 1-digit", make: () => { const a = rnd(13, 49), b = rnd(3, 9); return mulQ(a, b, splitTip(a, b)); }, slow: 0.5 },
      { label: "Bigger 2-digit × 1-digit", make: () => { const a = rnd(51, 99), b = rnd(6, 9); return mulQ(a, b, splitTip(a, b)); }, slow: 1 },
      {
        label: "Teens × teens",
        slow: 1,
        make: () => {
          const a = rnd(11, 19), b = rnd(11, 19);
          return mulQ(a, b, `$${a} \\times ${b} = ${a} \\times 10 + ${a} \\times ${b - 10} = ${a * 10} + ${a * (b - 10)} = ${a * b}$.`);
        },
      },
      { label: "2-digit × 2-digit", make: () => { const a = rnd(21, 49), b = rnd(11, 29); return mulQ(b, a, splitTip(b, a)); }, slow: 2 },
      { label: "3-digit × 1-digit", make: () => { const a = rnd(101, 999), b = rnd(3, 9); return mulQ(a, b, splitTip(a, b)); }, slow: 2 },
    ],
  },
  {
    id: "div",
    name: "Division",
    symbol: "÷",
    color: "#ff9a3c",
    blurb: "Sharing, remainders, long division",
    tiers: [
      { label: "Dividing by 2, 5 and 10", make: () => divQ(pick([2, 5, 10]), rnd(1, 10)) },
      { label: "Tables up to 5", make: () => divQ(rnd(3, 5), rnd(2, 10)) },
      { label: "Tables up to 10", make: () => divQ(rnd(6, 10), rnd(2, 10)) },
      { label: "Tables up to 12", make: () => divQ(rnd(6, 12), rnd(6, 12)) },
      {
        label: "Dividing tens",
        make: () => {
          const d = rnd(2, 9), q = rnd(2, 9);
          return divQ(d, q * 10, `$${d * q} \\div ${d} = ${q}$, so $${d * q * 10} \\div ${d} = ${q * 10}$.`);
        },
      },
      {
        label: "2-digit answers",
        slow: 0.5,
        make: () => {
          const d = rnd(3, 9), q = rnd(11, 30), t = Math.floor(q / 10) * 10;
          return divQ(d, q, `Split it: $${d * q} = ${d * t} + ${d * (q - t)}$. $${d * t} \\div ${d} = ${t}$ and $${d * (q - t)} \\div ${d} = ${q - t}$, so the answer is $${q}$.`);
        },
      },
      {
        label: "Bigger 2-digit answers",
        slow: 1,
        make: () => {
          const d = rnd(4, 9), q = rnd(31, 99), t = Math.floor(q / 10) * 10;
          return divQ(d, q, `Split it: $${d * q} = ${d * t} + ${d * (q - t)}$. $${d * t} \\div ${d} = ${t}$ and $${d * (q - t)} \\div ${d} = ${q - t}$, so the answer is $${q}$.`);
        },
      },
      {
        label: "With remainders",
        slow: 1,
        make: () => {
          const d = rnd(3, 9), q = rnd(5, 20), r = rnd(1, d - 1), n = d * q + r;
          const R = (a: number, b: number) => `$${a}\\text{ r }${b}$`;
          const wrong = [R(q + 1, r), R(q - 1, r), R(q, r < d - 1 ? r + 1 : r - 1), R(q, d - r)];
          return {
            skill: DIV,
            prompt: `$${n} \\div ${d}$`,
            answer: R(q, r),
            options: four(R(q, r), wrong, (i) => R(q + i + 1, r)),
            tip: `$${d} \\times ${q} = ${d * q}$ and $${n} - ${d * q} = ${r}$ is left over. The remainder is always less than ${d}.`,
          };
        },
      },
      { label: "Dividing by teens", make: () => divQ(rnd(11, 19), rnd(3, 15)), slow: 1.5 },
      {
        label: "3- and 4-digit ÷ 1-digit",
        slow: 2,
        make: () => {
          const d = rnd(3, 9), q = rnd(120, 999);
          return divQ(d, q, `Check by multiplying: ${splitTip(q, d).replace("Split it up: ", "")} So $${d * q} \\div ${d} = ${q}$.`);
        },
      },
    ],
  },
  {
    id: "squares",
    name: "Squares & roots",
    symbol: "x²",
    color: "#ff7ad9",
    blurb: "Squares, square roots and cubes",
    tiers: [
      { label: "Squares up to 10²", make: () => square(rnd(2, 10)) },
      { label: "Roots up to √100", make: () => root(rnd(2, 10)) },
      { label: "Squares up to 15²", make: () => square(rnd(11, 15)) },
      { label: "Roots up to √225", make: () => root(rnd(11, 15)) },
      {
        label: "Squares up to 25²",
        make: () => {
          const n = rnd(16, 25), t = Math.floor(n / 10) * 10, u = n - t;
          return square(n, u ? `Use $(a+b)^2 = a^2 + 2ab + b^2$: $${n}^2 = ${t * t} + ${2 * t * u} + ${u * u} = ${n * n}$.` : undefined);
        },
      },
      { label: "Roots up to √625", make: () => root(rnd(16, 25)) },
      {
        label: "Cubes",
        make: () => {
          const n = rnd(2, 6);
          return num(SQ, `$${n}^3$`, n ** 3, [3 * n, n * n, n ** 3 + n, (n + 1) ** 3], `$${n}^3 = ${n} \\times ${n} \\times ${n} = ${n * n} \\times ${n} = ${n ** 3}$. It is not $3 \\times ${n}$.`);
        },
      },
      {
        label: "Cube roots",
        make: () => {
          const n = rnd(2, 10);
          return num(SQ, `$\\sqrt[3]{${n ** 3}}$`, n, [n + 1, n - 1, Math.round(n ** 3 / 3), n * n], `$${n} \\times ${n} \\times ${n} = ${n ** 3}$, so $\\sqrt[3]{${n ** 3}} = ${n}$.`);
        },
      },
      {
        label: "Squares ending in 5",
        make: () => {
          const t = rnd(2, 9), n = t * 10 + 5;
          return square(n, `Trick for numbers ending in 5: $${t} \\times ${t + 1} = ${t * (t + 1)}$, then write 25 after it: $${n}^2 = ${n * n}$.`);
        },
      },
      {
        label: "Squares up to 50²",
        slow: 1,
        make: () => {
          const n = rnd(26, 50), t = Math.floor(n / 10) * 10, u = n - t;
          return square(n, u ? `Use $(a+b)^2 = a^2 + 2ab + b^2$: $${n}^2 = ${t * t} + ${2 * t * u} + ${u * u} = ${n * n}$.` : undefined);
        },
      },
    ],
  },
  {
    id: "fractions",
    name: "Fractions",
    symbol: "½",
    color: "#a3e635",
    blurb: "Halves to mixed numbers",
    tiers: [
      {
        label: "Fraction of a number",
        make: () => {
          const q = pick([2, 3, 4, 5, 10]), k = rnd(2, 12), n = q * k;
          return num(FR, `$${F(1, q)}$ of $${n}$`, k, [n * q, n - q, k + 1, k - 1], `Divide by the bottom number: $${n} \\div ${q} = ${k}$.`);
        },
      },
      {
        label: "Same bottoms",
        make: () => {
          const q = rnd(5, 12), a = rnd(1, q - 3), b = rnd(1, q - a - 1);
          return fracQ(FR, `$${F(a, q)} + ${F(b, q)}$`, [a + b, q], [[a + b, 2 * q], [a * b, q], [a + b + 1, q]], `The bottoms match, so just add the tops: $${F(a + b, q)}$. Never add the bottoms!`);
        },
      },
      {
        label: "Simplest form",
        make: () => {
          const q = rnd(3, 9), p = rnd(1, q - 1), [sp, sq] = simplify([p, q]), g = rnd(2, 6);
          return fracQ(FR, `Simplify $${F(sp * g, sq * g)}$`, [sp, sq], [[sp + 1, sq], [sq, sp], [sp, sq + 1], [sp * g - 1, sq * g - 1]], `Divide the top and bottom by the same number, ${g}: $${F(sp * g, sq * g)} = ${F(sp, sq)}$.`);
        },
      },
      {
        label: "Halves, quarters, eighths",
        make: () => {
          const q1 = pick([2, 3, 4, 5]), k = pick([2, 3]), q2 = q1 * k, a = rnd(1, q1 - 1), b = rnd(1, q2 - 1);
          return fracQ(FR, `$${F(a, q1)} + ${F(b, q2)}$`, [a * k + b, q2], [[a + b, q1 + q2], [a + b, q2], [a * k + b, q1 + q2]], `Make the bottoms the same: $${F(a, q1)} = ${F(a * k, q2)}$, so $${F(a * k, q2)} + ${F(b, q2)} = ${F(a * k + b, q2)}$.`);
        },
      },
      {
        label: "Adding unit fractions",
        make: () => {
          const a = rnd(2, 9);
          let b = rnd(2, 9);
          if (b === a) b = a === 9 ? 8 : a + 1;
          return fracQ(FR, `$${F(1, a)} + ${F(1, b)}$`, [a + b, a * b], [[2, a + b], [1, a + b], [1, a * b], [a + b, a * b + 1]], `Make the bottoms the same: $${F(b, a * b)} + ${F(a, a * b)} = ${F(a + b, a * b)}$. Never add the bottoms!`);
        },
      },
      {
        label: "Subtracting fractions",
        slow: 0.5,
        make: () => {
          let a: number, b: number, c: number, d: number;
          do {
            b = rnd(2, 6);
            d = rnd(2, 6);
            a = rnd(1, b - 1);
            c = rnd(1, d - 1);
          } while (b === d || a * d === c * b);
          // Bigger fraction first, so the answer is positive.
          if (a * d < c * b) [a, b, c, d] = [c, d, a, b];
          return fracQ(FR, `$${F(a, b)} - ${F(c, d)}$`, [a * d - c * b, b * d], [[Math.abs(a - c) || 1, Math.abs(b - d) || 1], [a - c > 0 ? a - c : 1, b * d], [a * d - c * b + 1, b * d]], `Make the bottoms the same: $${F(a * d, b * d)} - ${F(c * b, b * d)} = ${F(a * d - c * b, b * d)}$.`);
        },
      },
      {
        label: "Multiplying fractions",
        make: () => {
          const a = rnd(1, 5), b = rnd(a + 1, 9), c = rnd(1, 5), d = rnd(c + 1, 9);
          return fracQ(FR, `$${F(a, b)} \\times ${F(c, d)}$`, [a * c, b * d], [[a * d, b * c], [a + c, b + d], [a * c, b + d]], `Top times top, bottom times bottom: $${F(`${a} \\times ${c}`, `${b} \\times ${d}`)} = ${F(a * c, b * d)}$.`);
        },
      },
      {
        label: "Dividing fractions",
        slow: 0.5,
        make: () => {
          const a = rnd(1, 5), b = rnd(a + 1, 9), c = rnd(1, 5), d = rnd(c + 1, 9);
          return fracQ(FR, `$${F(a, b)} \\div ${F(c, d)}$`, [a * d, b * c], [[a * c, b * d], [b * c, a * d], [a + d, b + c]], `Keep, change, flip: $${F(a, b)} \\times ${F(d, c)} = ${F(a * d, b * c)}$.`);
        },
      },
      {
        label: "Mixed numbers",
        slow: 1.5,
        make: () => {
          const w1 = rnd(1, 4), w2 = rnd(1, 4), b = pick([2, 3, 4, 5]), d = pick([2, 3, 4, 5]), a = rnd(1, b - 1), c = rnd(1, d - 1);
          const ans: Frac = [(w1 * b + a) * d + (w2 * d + c) * b, b * d];
          return fracQ(
            FR,
            `$${w1}${F(a, b)} + ${w2}${F(c, d)}$`,
            ans,
            [[(w1 + w2) * (b + d) + a + c, b + d], [ans[0] + b * d, ans[1]], [ans[0] - b * d, ans[1]]],
            `Add the wholes: $${w1} + ${w2} = ${w1 + w2}$. Then the fractions: $${F(a, b)} + ${F(c, d)} = ${texFrac([a * d + c * b, b * d], true)}$. Together: $${texFrac(ans, true)}$.`,
            true,
          );
        },
      },
      {
        label: "Any two fractions",
        slow: 1,
        make: () => {
          const b = rnd(3, 9), d = rnd(3, 9), a = rnd(1, b - 1), c = rnd(1, d - 1);
          return fracQ(FR, `$${F(a, b)} + ${F(c, d)}$`, [a * d + c * b, b * d], [[a + c, b + d], [a * c, b * d], [a * d + c * b + 1, b * d]], `Make the bottoms the same: $${F(a * d, b * d)} + ${F(c * b, b * d)} = ${F(a * d + c * b, b * d)}$.`, true);
        },
      },
    ],
  },
  {
    id: "percent",
    name: "Percentages",
    symbol: "%",
    color: "#38bdf8",
    blurb: "Percent of, increase, decrease",
    tiers: [
      {
        label: "50% and 10%",
        make: () => {
          const p = pick([50, 10]), n = 10 * rnd(2, 20), a = (p * n) / 100;
          return num(PC, `$${p}\\%$ of $${n}$`, a, [a * 10, n - a, a + 5, n / 5], p === 50 ? `50% is half: $${n} \\div 2 = ${a}$.` : `For 10%, divide by 10: $${n} \\div 10 = ${a}$.`);
        },
      },
      {
        label: "25% and 20%",
        make: () => {
          const p = pick([25, 20]), n = 20 * rnd(2, 20), a = (p * n) / 100;
          return num(PC, `$${p}\\%$ of $${n}$`, a, [a * 10, n - a, n / 10, a + 10], p === 25 ? `25% is a quarter: $${n} \\div 4 = ${a}$.` : `20% is double 10%: $2 \\times ${n / 10} = ${a}$.`);
        },
      },
      {
        label: "5%, 15% and 75%",
        make: () => {
          const p = pick([5, 15, 75]), n = 20 * rnd(2, 20), a = (p * n) / 100;
          const how: Record<number, string> = {
            5: `5% is half of 10%: $${n / 10} \\div 2 = ${a}$.`,
            15: `15% = 10% + 5% $= ${n / 10} + ${n / 20} = ${a}$.`,
            75: `75% is three quarters: $${n} \\div 4 \\times 3 = ${a}$.`,
          };
          return num(PC, `$${p}\\%$ of $${n}$`, a, [a * 10, n - a, a + n / 10, n / p], how[p]);
        },
      },
      {
        label: "Any percent",
        make: () => {
          const p = pick([3, 4, 6, 7, 8, 9, 30, 40, 60, 70, 90]), n = p < 10 ? 100 * rnd(1, 9) : 10 * rnd(2, 30), a = (p * n) / 100;
          return num(PC, `$${p}\\%$ of $${n}$`, a, [a * 10, n - a, a + p, p * n], p < 10 ? `1% of ${n} is $${n / 100}$, so ${p}% is $${p} \\times ${n / 100} = ${a}$.` : `10% of ${n} is $${n / 10}$, so ${p}% is $${p / 10} \\times ${n / 10} = ${a}$.`);
        },
      },
      {
        label: "What percent is it?",
        make: () => {
          for (;;) {
            const p = pick([10, 20, 25, 40, 50, 60, 75, 80]), b = pick([20, 40, 80, 200, 400]), a = (p * b) / 100;
            if (!Number.isInteger(a)) continue;
            return num(PC, `$${a}$ out of $${b}$ is what %?`, p, [100 - p, a, p / 2, p + 10], `Make it a fraction and scale to 100: $${F(a, b)} = ${F(p, 100)} = ${p}\\%$.`, { show: pct });
          }
        },
      },
      {
        label: "Increase by a percent",
        slow: 0.5,
        make: () => {
          const p = pick([10, 20, 25, 50, 5, 15]), n = 20 * rnd(2, 20), inc = (p * n) / 100;
          return num(PC, `Increase $${n}$ by $${p}\\%$`, n + inc, [n + p, inc, n - inc, n + inc * 2], `${p}% of ${n} is $${inc}$, so the new amount is $${n} + ${inc} = ${n + inc}$.`);
        },
      },
      {
        label: "Decrease by a percent",
        slow: 0.5,
        make: () => {
          const p = pick([10, 20, 25, 50, 5, 15]), n = 20 * rnd(2, 20), dec = (p * n) / 100;
          return num(PC, `Decrease $${n}$ by $${p}\\%$`, n - dec, [n - p, dec, n + dec, n - dec * 2], `${p}% of ${n} is $${dec}$, so the new amount is $${n} - ${dec} = ${n - dec}$.`);
        },
      },
      {
        label: "Fraction percents",
        slow: 1,
        make: () => {
          const [tex, top, bottom] = pick([["12\\frac{1}{2}", 1, 8], ["33\\frac{1}{3}", 1, 3], ["66\\frac{2}{3}", 2, 3], ["37\\frac{1}{2}", 3, 8], ["62\\frac{1}{2}", 5, 8]] as const);
          const n = 24 * rnd(1, 10), a = (n * top) / bottom;
          return num(PC, `$${tex}\\%$ of $${n}$`, a, [n / 3, n / 8, a + n / 8, a * 2], `$${tex}\\%$ is the same as $${F(top, bottom)}$, so it's $${n} \\div ${bottom}${top > 1 ? ` \\times ${top}` : ""} = ${a}$.`);
        },
      },
      {
        label: "Find the whole",
        slow: 1,
        make: () => {
          const p = pick([10, 20, 25, 50, 5]), whole = 20 * rnd(2, 20), part = (p * whole) / 100;
          return num(PC, `$${p}\\%$ of a number is $${part}$. Find the number.`, whole, [(part * p) / 100, part * p, whole / 2, whole + part], `${p}% is $${F(p, 100)} = ${texFrac([p, 100])}$ of the number, so the number is $${part} \\times ${100 / p} = ${whole}$.`);
        },
      },
    ],
  },
  {
    id: "integers",
    name: "Integers",
    symbol: "±",
    color: "#f472b6",
    blurb: "Negative numbers and signs",
    tiers: [
      {
        label: "Adding to a negative",
        make: () => {
          const a = rnd(2, 15), b = rnd(2, 15);
          return num(INT, `$-${a} + ${b}$`, b - a, [-(a + b), a + b, a - b, b - a + 1], `Start at $-${a}$ on the number line and move ${b} to the right: $${b - a}$.`, { signed: true });
        },
      },
      {
        label: "Going below zero",
        make: () => {
          const a = rnd(1, 12), b = a + rnd(1, 12);
          return num(INT, `$${a} - ${b}$`, a - b, [b - a, -(a + b), a - b + 1, a - b - 1], `Taking away more than you have goes below zero: $${a} - ${b} = -${b - a}$.`, { signed: true });
        },
      },
      {
        label: "Adding two negatives",
        make: () => {
          const a = rnd(2, 15), b = rnd(2, 15);
          return num(INT, `$-${a} + (-${b})$`, -(a + b), [a + b, b - a, a - b, -(a + b) + 1], `Adding a negative is taking away: $-${a} - ${b} = -${a + b}$.`, { signed: true });
        },
      },
      {
        label: "Minus a minus",
        make: () => {
          const a = rnd(2, 15), b = rnd(2, 15);
          return Math.random() < 0.5
            ? num(INT, `$-${a} - (-${b})$`, b - a, [-(a + b), a + b, a - b], `Taking away a negative is the same as adding: $-${a} + ${b} = ${b - a}$.`, { signed: true })
            : num(INT, `$${a} - (-${b})$`, a + b, [a - b, -(a + b), b - a], `Two minuses next to each other make a plus: $${a} + ${b} = ${a + b}$.`, { signed: true });
        },
      },
      {
        label: "Multiplying signs",
        make: () => {
          const a = rnd(2, 12), b = rnd(2, 12);
          return Math.random() < 0.5
            ? num(INT, `$(-${a}) \\times ${b}$`, -a * b, [a * b, -(a + b), -a * b - 1], "A minus times a plus gives a minus.", { signed: true })
            : num(INT, `$(-${a}) \\times (-${b})$`, a * b, [-a * b, -(a + b), a + b], "A minus times a minus gives a **plus**.", { signed: true });
        },
      },
      {
        label: "Dividing signs",
        make: () => {
          const a = rnd(2, 12), b = rnd(2, 12);
          return Math.random() < 0.5
            ? num(INT, `$(-${a * b}) \\div ${b}$`, -a, [a, -b, a * b], "A minus divided by a plus gives a minus.", { signed: true })
            : num(INT, `$(-${a * b}) \\div (-${b})$`, a, [-a, -b, b], "A minus divided by a minus gives a **plus**.", { signed: true });
        },
      },
      {
        label: "Three terms",
        slow: 0.5,
        make: () => {
          const a = rnd(2, 20), b = rnd(2, 20), c = rnd(2, 20), v = -a + b - c;
          return num(INT, `$-${a} + ${b} - ${c}$`, v, [-v, -a - b - c, -a + b + c, v + 1], `Left to right: $-${a} + ${b} = ${b - a}$, then $${b - a} - ${c} = ${v}$.`, { signed: true });
        },
      },
      {
        label: "Bigger numbers",
        slow: 1,
        make: () => {
          const a = rnd(11, 25), b = rnd(3, 9);
          return Math.random() < 0.5
            ? num(INT, `$(-${a}) \\times (-${b})$`, a * b, [-a * b, a * b + 10, -(a + b)], `Minus times minus is plus: $${a} \\times ${b} = ${a * b}$.`, { signed: true })
            : num(INT, `$-${a * 3} + ${a + b}$`, a + b - a * 3, [a * 3 - a - b, -(a * 4 + b), a + b + a * 3], `The negative is bigger, so the answer is negative: $${a * 3} - ${a + b} = ${a * 2 - b}$, giving $${a + b - a * 3}$.`, { signed: true });
        },
      },
    ],
  },
  {
    id: "powers",
    name: "Powers",
    symbol: "aⁿ",
    color: "#facc15",
    blurb: "Exponents and their laws",
    tiers: [
      {
        label: "Powers of 2",
        make: () => {
          const n = rnd(2, 8);
          return num(POW, `$2^{${n}}$`, 2 ** n, [2 * n, 2 ** (n - 1), 2 ** n + 2, n * n], `Multiply 2 by itself ${n} times: $${Array(n).fill(2).join(" \\times ")} = ${2 ** n}$.`);
        },
      },
      {
        label: "Powers of 3, 5 and 10",
        make: () => {
          const [b, n] = pick([[3, rnd(2, 4)], [5, rnd(2, 4)], [10, rnd(2, 6)]] as const);
          return num(POW, `$${b}^{${n}}$`, b ** n, [b * n, b ** (n - 1), b ** n + b, n ** b > 1e7 ? b * 10 : n ** b], `Multiply ${b} by itself ${n} times: $${Array(n).fill(b).join(" \\times ")} = ${b ** n}$.`);
        },
      },
      {
        label: "Multiply: add the powers",
        make: () => {
          const b = pick(["2", "3", "5", "a", "x"]), m = rnd(2, 8), n = rnd(2, 6);
          return powQ(b, `$${b}^{${m}} \\times ${b}^{${n}}$`, m + n, [m * n, Math.abs(m - n), m + n + 1], "Same base, multiplying: **add** the powers. $a^m \\times a^n = a^{m+n}$.");
        },
      },
      {
        label: "Divide: subtract the powers",
        make: () => {
          const b = pick(["2", "3", "7", "a", "y"]), m = rnd(2, 8), n = rnd(2, 6);
          return powQ(b, `$${b}^{${m + n}} \\div ${b}^{${n}}$`, m, [m + 2 * n, (m + n) * n, m + 1], "Same base, dividing: **subtract** the powers. $a^m \\div a^n = a^{m-n}$.");
        },
      },
      {
        label: "Power of a power",
        make: () => {
          const b = pick(["2", "5", "a", "x"]), m = rnd(2, 6), n = rnd(2, 5);
          return powQ(b, `$(${b}^{${m}})^{${n}}$`, m * n, [m + n, m * n + 1, m ** n], "Power of a power: **multiply** the powers. $(a^m)^n = a^{mn}$.");
        },
      },
      {
        label: "Zero and negative powers",
        make: () => {
          const a = rnd(2, 9);
          if (Math.random() < 0.4) {
            return { skill: POW, prompt: `$${a}^{0}$`, answer: "$1$", options: shuffle(["$1$", "$0$", $(a), `$-${a}$`]), tip: "Anything (except 0) to the power 0 is **1**." };
          }
          const n = a <= 4 ? rnd(1, 3) : 1;
          const ans = `$${F(1, a ** n)}$`;
          return {
            skill: POW,
            prompt: `$${a}^{-${n}}$`,
            answer: ans,
            options: four(ans, [`$-${a ** n}$`, `$-${a * n}$`, `$${F(1, a * n)}$`], (i) => `$${F(1, a ** n + i)}$`),
            tip: `A negative power means "one over": $${a}^{-${n}} = ${F(1, `${a}^{${n}}`)} = ${F(1, a ** n)}$.`,
          };
        },
      },
      {
        label: "Mixing the laws",
        slow: 0.5,
        make: () => {
          const b = pick(["2", "3", "a", "x"]), m = rnd(3, 8), n = rnd(2, 6), p = rnd(2, m + n - 1);
          return powQ(b, `$${b}^{${m}} \\times ${b}^{${n}} \\div ${b}^{${p}}$`, m + n - p, [m * n - p, m + n + p, m + n], `Add, then subtract: $${m} + ${n} - ${p} = ${m + n - p}$.`);
        },
      },
      {
        label: "Same power, different bases",
        slow: 1,
        make: () => {
          const [a, b, n] = pick([[2, 5, rnd(2, 4)], [4, 25, rnd(2, 3)], [2, 3, rnd(2, 3)], [5, 20, 2]] as const);
          const v = (a * b) ** n;
          return num(POW, `$${a}^{${n}} \\times ${b}^{${n}}$`, v, [(a + b) ** n, a * b * n, v * 10, v + a * b], `Same power: multiply the bases first. $(${a} \\times ${b})^{${n}} = ${a * b}^{${n}} = ${v}$.`);
        },
      },
    ],
  },
  {
    id: "equations",
    name: "Equations",
    symbol: "x=",
    color: "#34d399",
    blurb: "Find x, step by step",
    tiers: [
      {
        label: "x + a = b",
        make: () => {
          const x = rnd(2, 20), a = rnd(2, 20), b = x + a;
          return num(EQ, `$x + ${a} = ${b}$`, x, [b + a, b, x + 1, x - 1], `Take ${a} from both sides: $x = ${b} - ${a} = ${x}$.`);
        },
      },
      {
        label: "x − a = b",
        make: () => {
          const x = rnd(12, 40), a = rnd(2, 11), b = x - a;
          return num(EQ, `$x - ${a} = ${b}$`, x, [b - a, b, x + 1, x - 1], `Add ${a} to both sides: $x = ${b} + ${a} = ${x}$.`);
        },
      },
      {
        label: "ax = b",
        make: () => {
          const a = rnd(2, 9), x = rnd(2, 12), b = a * x;
          return num(EQ, `$${a}x = ${b}$`, x, [b - a, b * a, b + a, x + 1], `Divide both sides by ${a}: $x = ${b} \\div ${a} = ${x}$.`);
        },
      },
      {
        label: "ax + b = c",
        make: () => {
          const x = rnd(2, 12), a = rnd(2, 9), b = rnd(1, 20), c = a * x + b;
          return num(EQ, `$${a}x + ${b} = ${c}$`, x, [(c + b) / a, c - b, x + 1, Math.round(c / a)], `Take ${b} from both sides: $${a}x = ${c - b}$. Then divide by ${a}: $x = ${x}$.`);
        },
      },
      {
        label: "ax − b = c",
        make: () => {
          const x = rnd(2, 12), a = rnd(2, 9), b = rnd(1, a * x - 1), c = a * x - b;
          return num(EQ, `$${a}x - ${b} = ${c}$`, x, [(c - b) / a, c + b, x + 1, x - 1], `Add ${b} to both sides: $${a}x = ${c + b}$. Then divide by ${a}: $x = ${x}$.`);
        },
      },
      {
        label: "x divided by a number",
        make: () => {
          const a = rnd(2, 9), b = rnd(2, 12);
          return num(EQ, `$${F("x", a)} = ${b}$`, a * b, [a + b, b - a, b, a * b + a], `Multiply both sides by ${a}: $x = ${b} \\times ${a} = ${a * b}$.`);
        },
      },
      {
        label: "x on both sides",
        slow: 1,
        make: () => {
          const x = rnd(2, 10), c = rnd(1, 5), a = c + rnd(1, 5), b = rnd(1, 15), d = (a - c) * x + b;
          return num(EQ, `$${a}x + ${b} = ${c}x + ${d}$`, x, [(d - b) / (a + c), d - b, x + 1, (d + b) / (a - c)], `Gather the x's: $${a}x - ${c}x = ${d} - ${b}$, so $${a - c}x = ${d - b}$ and $x = ${x}$.`);
        },
      },
      {
        label: "Negative answers",
        slow: 0.5,
        make: () => {
          const x = -rnd(1, 9), a = rnd(2, 9), b = rnd(a * 9 + 1, a * 9 + 30), c = a * x + b;
          return num(EQ, `$${a}x + ${b} = ${c}$`, x, [-x, (c + b) / a, x - 1, x + 1], `Take ${b} from both sides: $${a}x = ${c - b}$. Divide by ${a}: $x = ${x}$.`, { signed: true });
        },
      },
      {
        label: "Brackets",
        slow: 1,
        make: () => {
          const a = rnd(2, 6), b = rnd(1, 9), x = rnd(1, 12), c = a * (x + b);
          return num(EQ, `$${a}(x + ${b}) = ${c}$`, x, [c / a + b, c - a * b - b, c - b, x + 1], `Divide by ${a} first: $x + ${b} = ${c / a}$. Then $x = ${c / a} - ${b} = ${x}$.`);
        },
      },
    ],
  },
  {
    id: "bodmas",
    name: "BODMAS",
    symbol: "( )",
    color: "#fb7185",
    blurb: "Order of operations",
    tiers: [
      {
        label: "× before +",
        make: () => {
          const a = rnd(2, 15), b = rnd(2, 9), c = rnd(2, 9);
          return num(BOD, `$${a} + ${b} \\times ${c}$`, a + b * c, [(a + b) * c, a * b + c, a + b + c], `Multiply before you add: $${b} \\times ${c} = ${b * c}$, then $${a} + ${b * c} = ${a + b * c}$.`);
        },
      },
      {
        label: "× before −",
        make: () => {
          const a = rnd(3, 9), b = rnd(3, 9), c = rnd(2, a * b - 1);
          return num(BOD, `$${a} \\times ${b} - ${c}$`, a * b - c, [a * (b - c), a * b + c, a + b - c], `Multiply first: $${a} \\times ${b} = ${a * b}$, then take away ${c}: $${a * b - c}$.`, { signed: true });
        },
      },
      {
        label: "Brackets first",
        make: () => {
          const a = rnd(2, 15), b = rnd(2, 9), c = rnd(2, 9);
          return num(BOD, `$${b} \\times (${a} + ${c})$`, b * (a + c), [b * a + c, b + a + c, b * a * c], `Brackets first: $${a} + ${c} = ${a + c}$, then $${b} \\times ${a + c} = ${b * (a + c)}$.`);
        },
      },
      {
        label: "÷ before +",
        make: () => {
          const c = rnd(2, 9), k = rnd(2, 9), a = rnd(2, 20), b = c * k;
          return num(BOD, `$${a} + ${b} \\div ${c}$`, a + k, [(a + b) / c, a + b - c, a * k], `Divide before you add: $${b} \\div ${c} = ${k}$, then $${a} + ${k} = ${a + k}$.`);
        },
      },
      {
        label: "Two products",
        make: () => {
          const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9), d = rnd(2, 9), v = a * b + c * d;
          return num(BOD, `$${a} \\times ${b} + ${c} \\times ${d}$`, v, [(a * b + c) * d, a * (b + c) * d, v + 10], `Both multiplications first: $${a * b} + ${c * d} = ${v}$.`);
        },
      },
      {
        label: "Brackets and ÷",
        make: () => {
          const c = rnd(2, 9), k = rnd(2, 12), a = rnd(1, c * k - 1), b = c * k - a;
          return num(BOD, `$(${a} + ${b}) \\div ${c}$`, k, [a + b / c, (a + b) * c, k + 1].map((n) => (Number.isInteger(n) ? n : Math.round(n))), `Brackets first: $${a} + ${b} = ${a + b}$, then $${a + b} \\div ${c} = ${k}$.`);
        },
      },
      {
        label: "Squares in the mix",
        slow: 0.5,
        make: () => {
          const a = rnd(2, 20), b = rnd(2, 6), c = rnd(2, 5), v = a + b * b * c;
          return num(BOD, `$${a} + ${b}^2 \\times ${c}$`, v, [(a + b * b) * c, a + (b * c) ** 2, a + 2 * b * c], `Orders (powers) first: $${b}^2 = ${b * b}$. Then multiply: $${b * b} \\times ${c} = ${b * b * c}$. Then add: $${v}$.`);
        },
      },
      {
        label: "Nested brackets",
        slow: 1,
        make: () => {
          const a = rnd(2, 6), b = rnd(2, 9), c = rnd(2, 6), d = rnd(2, 6), v = a * (b + c * d);
          return num(BOD, `$${a} \\times [${b} + (${c} \\times ${d})]$`, v, [a * b + c * d, (a * b + c) * d, a * (b + c) * d], `Inside out: $${c} \\times ${d} = ${c * d}$, then $${b} + ${c * d} = ${b + c * d}$, then $${a} \\times ${b + c * d} = ${v}$.`);
        },
      },
      {
        label: "Long chains",
        slow: 1.5,
        make: () => {
          const a = rnd(5, 30), b = rnd(2, 9), c = rnd(2, 9), e = rnd(2, 6), d = e * rnd(2, 6), v = a + b * c - d / e;
          return num(BOD, `$${a} + ${b} \\times ${c} - ${d} \\div ${e}$`, v, [((a + b) * c - d) / e, a + b * c - d, (a + b) * c - d / e].map(Math.round), `× and ÷ first: $${b} \\times ${c} = ${b * c}$ and $${d} \\div ${e} = ${d / e}$. Then $${a} + ${b * c} - ${d / e} = ${v}$.`, { signed: true });
        },
      },
    ],
  },
];

const BY_ID = new Map(SECTIONS.map((s) => [s.id, s]));
const PLAYABLE = SECTIONS.filter((s) => s.id !== "mixed");

/** Single-character symbols (+, ×, ½) look small next to two-character ones (x², aⁿ), so they get a bigger size. */
export const symbolSize = (symbol: string, big: string, small: string) => ([...symbol].length === 1 ? big : small);

export const SECTION_IDS = SECTIONS.map((s) => s.id);
export const sectionOf = (id: string): Section => BY_ID.get(id as SectionId) ?? SECTIONS[0];
export const isSectionId = (id: string | null | undefined): id is SectionId => !!id && BY_ID.has(id as SectionId);

/** Highest level a mission has; Mixed climbs as far as its hardest mission. */
export const MIXED_MAX = Math.max(...PLAYABLE.map((s) => s.tiers.length));
export const maxLevel = (id: SectionId) => (id === "mixed" ? MIXED_MAX : sectionOf(id).tiers.length);
/** Each wave climbs one level, up to the mission's top level. */
export const levelForWave = (id: SectionId, wave: number) => Math.min(maxLevel(id), wave);

/** What a level is about, e.g. "2-digit × 1-digit". */
export function levelLabel(id: SectionId, level: number): string {
  if (id === "mixed") return level <= 2 ? "Warm-up from every mission" : level >= MIXED_MAX ? "Toughest questions from every mission" : `Level ${level} questions from every mission`;
  const tiers = sectionOf(id).tiers;
  return tiers[Math.min(level, tiers.length) - 1].label;
}

function fromTier(s: Section, level: number): Question {
  // Now and then, a question from the level below keeps earlier skills fresh.
  const l = Math.min(level, s.tiers.length);
  const tier = s.tiers[(l > 1 && Math.random() < 0.2 ? l - 1 : l) - 1];
  return { ...tier.make(), slow: tier.slow };
}

/** A new question for the mission and level, avoiding a repeat of the previous one. */
export function nextQuestion(id: SectionId, level: number, prev?: Question): Question {
  for (let i = 0; i < 8; i++) {
    let q: Question;
    if (id === "mixed") {
      q = fromTier(pick(PLAYABLE), level);
      // A different kind of question each time.
      if (q.skill === prev?.skill && i < 4) continue;
    } else {
      q = fromTier(sectionOf(id), level);
    }
    if (q.prompt !== prev?.prompt && new Set(q.options).size === 4 && q.options.includes(q.answer)) return q;
  }
  return fromTier(id === "mixed" ? pick(PLAYABLE) : sectionOf(id), level);
}
