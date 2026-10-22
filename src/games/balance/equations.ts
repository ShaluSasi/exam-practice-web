/**
 * Balance It levels: real reactions from the syllabus, easiest first. Types of
 * reactions (combination, decomposition, displacement...) are Class 10 Chemistry
 * chapter 1 content; this app's Class 9 chemistry doesn't cover equation balancing
 * at all, so every level here is grade 10. The game itself is hidden from Class 9
 * students in the games registry rather than left to show an empty deck.
 */

export interface Equation {
  id: string;
  name: string;
  kind: string;
  left: string[];
  right: string[];
  /** Smallest whole-number coefficients, left then right. */
  solution: number[];
  fact: string;
  /** The class this reaction type is taught in. */
  grade: number;
}

export const EQUATIONS: Equation[] = [
  {
    grade: 10,
    id: "hcl",
    name: "Making hydrogen chloride",
    kind: "Combination",
    left: ["H2", "Cl2"],
    right: ["HCl"],
    solution: [1, 1, 2],
    fact: "Hydrogen chloride dissolved in water is hydrochloric acid. Your stomach makes it to digest food.",
  },
  {
    grade: 10,
    id: "water",
    name: "Burning hydrogen",
    kind: "Combination",
    left: ["H2", "O2"],
    right: ["H2O"],
    solution: [2, 1, 2],
    fact: "Rockets like the ISRO GSLV upper stage burn liquid hydrogen with oxygen. The only exhaust is water vapour.",
  },
  {
    grade: 10,
    id: "mgo",
    name: "Burning magnesium ribbon",
    kind: "Combination",
    left: ["Mg", "O2"],
    right: ["MgO"],
    solution: [2, 1, 2],
    fact: "Magnesium burns with a dazzling white flame. It is the first activity in Class 10 Chemistry, Chapter 1.",
  },
  {
    grade: 10,
    id: "nacl",
    name: "Making common salt",
    kind: "Combination",
    left: ["Na", "Cl2"],
    right: ["NaCl"],
    solution: [2, 1, 2],
    fact: "Sodium is a soft metal that reacts violently with water, and chlorine is a poisonous gas. Together they make the salt on your table!",
  },
  {
    grade: 10,
    id: "nh3",
    name: "Making ammonia",
    kind: "Combination",
    left: ["N2", "H2"],
    right: ["NH3"],
    solution: [1, 3, 2],
    fact: "This is the Haber process. Ammonia from it is used to make fertilisers that help feed half the world.",
  },
  {
    grade: 10,
    id: "zn",
    name: "Zinc in acid",
    kind: "Displacement",
    left: ["Zn", "HCl"],
    right: ["ZnCl2", "H2"],
    solution: [1, 2, 1, 1],
    fact: "Zinc pushes hydrogen out of the acid. The bubbles are hydrogen gas, which burns with a 'pop' sound.",
  },
  {
    grade: 10,
    id: "ch4",
    name: "Burning natural gas",
    kind: "Combustion",
    left: ["CH4", "O2"],
    right: ["CO2", "H2O"],
    solution: [1, 2, 1, 2],
    fact: "Methane is the main gas in CNG and biogas. Burning it gives heat, carbon dioxide and water.",
  },
  {
    grade: 10,
    id: "neutral",
    name: "Acid meets base",
    kind: "Neutralisation",
    left: ["NaOH", "H2SO4"],
    right: ["Na2SO4", "H2O"],
    solution: [2, 1, 1, 2],
    fact: "An acid and a base cancel each other out to form a salt and water. Antacid tablets work the same way.",
  },
  {
    grade: 10,
    id: "baso4",
    name: "White precipitate",
    kind: "Double displacement",
    left: ["BaCl2", "Na2SO4"],
    right: ["BaSO4", "NaCl"],
    solution: [1, 1, 1, 2],
    fact: "Barium sulphate is the white solid that forms. Doctors use it in 'barium meals' to see the stomach on X-rays.",
  },
  {
    grade: 10,
    id: "cu",
    name: "Copper in silver nitrate",
    kind: "Displacement",
    left: ["Cu", "AgNO3"],
    right: ["Cu(NO3)2", "Ag"],
    solution: [1, 2, 1, 2],
    fact: "Copper is more reactive than silver, so it pushes silver out. Shiny silver crystals grow on the copper wire.",
  },
  {
    grade: 10,
    id: "kclo3",
    name: "Heating potassium chlorate",
    kind: "Decomposition",
    left: ["KClO3"],
    right: ["KCl", "O2"],
    solution: [2, 2, 3],
    fact: "This is a quick way to make oxygen in the lab. It also gives oxygen to the flame in fireworks.",
  },
  {
    grade: 10,
    id: "al2o3",
    name: "Aluminium's armour",
    kind: "Combination",
    left: ["Al", "O2"],
    right: ["Al2O3"],
    solution: [4, 3, 2],
    fact: "A thin layer of aluminium oxide protects aluminium utensils from rusting. That's why they stay shiny.",
  },
  {
    grade: 10,
    id: "rust",
    name: "Iron rusting",
    kind: "Combination",
    left: ["Fe", "O2"],
    right: ["Fe2O3"],
    solution: [4, 3, 2],
    fact: "Rust needs both air and water. Painting or galvanising iron with zinc stops it.",
  },
  {
    grade: 10,
    id: "steam",
    name: "Iron and steam",
    kind: "Displacement",
    left: ["Fe", "H2O"],
    right: ["Fe3O4", "H2"],
    solution: [3, 4, 1, 4],
    fact: "Red-hot iron takes oxygen from steam and leaves hydrogen behind. This equation is in your Class 10 textbook.",
  },
  {
    grade: 10,
    id: "thermite",
    name: "Thermite welding",
    kind: "Displacement",
    left: ["Fe2O3", "Al"],
    right: ["Al2O3", "Fe"],
    solution: [1, 2, 1, 2],
    fact: "This reaction gets hot enough to melt iron. Railways use it to weld broken tracks.",
  },
  {
    grade: 10,
    id: "blast",
    name: "Blast furnace",
    kind: "Redox",
    left: ["Fe2O3", "CO"],
    right: ["Fe", "CO2"],
    solution: [1, 3, 2, 3],
    fact: "Carbon monoxide takes oxygen away from iron ore, which is reduction. That is how steel plants get iron.",
  },
  {
    grade: 10,
    id: "alhcl",
    name: "Aluminium in acid",
    kind: "Displacement",
    left: ["Al", "HCl"],
    right: ["AlCl3", "H2"],
    solution: [2, 6, 2, 3],
    fact: "Aluminium is more reactive than zinc, but its oxide coat slows it down at first.",
  },
  {
    grade: 10,
    id: "feso4",
    name: "Heating green vitriol",
    kind: "Decomposition",
    left: ["FeSO4"],
    right: ["Fe2O3", "SO2", "SO3"],
    solution: [2, 1, 1, 1],
    fact: "Green ferrous sulphate crystals turn reddish-brown and give off gases that smell of burning sulphur.",
  },
  {
    grade: 10,
    id: "propane",
    name: "Burning LPG",
    kind: "Combustion",
    left: ["C3H8", "O2"],
    right: ["CO2", "H2O"],
    solution: [1, 5, 3, 4],
    fact: "Propane is part of the LPG in your kitchen cylinder. A blue flame means it is burning completely.",
  },
  {
    grade: 10,
    id: "lead",
    name: "Heating lead nitrate",
    kind: "Decomposition",
    left: ["Pb(NO3)2"],
    right: ["PbO", "NO2", "O2"],
    solution: [2, 2, 4, 1],
    fact: "Brown fumes of nitrogen dioxide appear. This classic activity is in Class 10, Chapter 1.",
  },
  {
    grade: 10,
    id: "respire",
    name: "Respiration",
    kind: "Combustion (in your cells)",
    left: ["C6H12O6", "O2"],
    right: ["CO2", "H2O"],
    solution: [1, 6, 6, 6],
    fact: "Every cell in your body runs this reaction in its mitochondria to release energy from glucose.",
  },
  {
    grade: 10,
    id: "photo",
    name: "Photosynthesis",
    kind: "Uses sunlight",
    left: ["CO2", "H2O"],
    right: ["C6H12O6", "O2"],
    solution: [6, 6, 1, 6],
    fact: "Plants run respiration in reverse using sunlight and chlorophyll. Almost all the oxygen you breathe comes from it.",
  },
  {
    grade: 10,
    id: "butane",
    name: "Boss level: butane",
    kind: "Combustion",
    left: ["C4H10", "O2"],
    right: ["CO2", "H2O"],
    solution: [2, 13, 8, 10],
    fact: "Butane fills lighters and is also part of LPG. One butane needs 6½ oxygen molecules, so every number doubles to stay whole.",
  },
];

/** Counts atoms in a formula like "Ca(OH)2" or "Fe2O3". */
export function parseFormula(formula: string): Record<string, number> {
  let i = 0;
  const num = () => {
    let s = "";
    while (i < formula.length && /\d/.test(formula[i])) s += formula[i++];
    return s ? Number(s) : 1;
  };
  const group = (): Record<string, number> => {
    const out: Record<string, number> = {};
    const add = (el: string, n: number) => (out[el] = (out[el] ?? 0) + n);
    while (i < formula.length && formula[i] !== ")") {
      if (formula[i] === "(") {
        i++;
        const inner = group();
        i++; // ")"
        const k = num();
        for (const [el, n] of Object.entries(inner)) add(el, n * k);
      } else {
        let el = formula[i++];
        while (i < formula.length && /[a-z]/.test(formula[i])) el += formula[i++];
        add(el, num());
      }
    }
    return out;
  };
  return group();
}

/** Total atoms of each element on one side, given coefficients. */
export function countSide(formulas: string[], coefs: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  formulas.forEach((f, k) => {
    for (const [el, n] of Object.entries(parseFormula(f))) out[el] = (out[el] ?? 0) + n * coefs[k];
  });
  return out;
}

/** Elements in the order they first appear in the equation. */
export function elementsOf(eq: Equation): string[] {
  const seen: string[] = [];
  for (const f of [...eq.left, ...eq.right]) for (const el of Object.keys(parseFormula(f))) if (!seen.includes(el)) seen.push(el);
  return seen;
}

/** Atom colours, loosely after the CPK colours used in molecule models. */
export const ATOM_COLOR: Record<string, string> = {
  H: "#cfd6e6",
  O: "#ef4444",
  C: "#3f4458",
  N: "#3b82f6",
  Cl: "#22c55e",
  Na: "#a855f7",
  Mg: "#14b8a6",
  Fe: "#d97706",
  S: "#eab308",
  K: "#8b5cf6",
  Al: "#94a3b8",
  Zn: "#64748b",
  Cu: "#c2410c",
  Ag: "#a3a3a3",
  Ba: "#10b981",
  Pb: "#57534e",
};
