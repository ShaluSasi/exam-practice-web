/**
 * Element Lab questions: symbols, valency, atomic number, subatomic particles
 * and separating mixtures, all Class 9 Chemistry (Atoms and Molecules,
 * Structure of the Atom, and Is Matter Around Us Pure?). This deliberately
 * stops short of the periodic table itself (groups, periods, Mendeleev,
 * Dobereiner's triads...), which is Class 10 content this app doesn't teach
 * in Class 9 chemistry. The game is shown to Class 9 students only (see
 * minGrade/maxGrade in the games registry).
 */

export type Skill = "Element symbols" | "Valency" | "Atomic number" | "Subatomic particles" | "Separating mixtures";

export interface ElementQ {
  skill: Skill;
  prompt: string;
  answer: string;
  options: string[];
  tip: string;
}

export const ELEMENT_QUESTIONS: ElementQ[] = [
  // Element symbols: name -> symbol
  { skill: "Element symbols", prompt: "What is the symbol for Hydrogen?", answer: "H", options: ["H", "He", "Hy", "Hg"], tip: "Hydrogen is the simplest element, symbol H, atomic number 1." },
  { skill: "Element symbols", prompt: "What is the symbol for Helium?", answer: "He", options: ["He", "H", "Hl", "Hm"], tip: "Helium's symbol is He, not just H (that's hydrogen)." },
  { skill: "Element symbols", prompt: "What is the symbol for Carbon?", answer: "C", options: ["C", "Ca", "Co", "Cr"], tip: "Carbon's symbol is a single letter: C. Ca is calcium, Co is cobalt." },
  { skill: "Element symbols", prompt: "What is the symbol for Nitrogen?", answer: "N", options: ["N", "Ni", "Na", "No"], tip: "Nitrogen is N. Ni is nickel, Na is sodium." },
  { skill: "Element symbols", prompt: "What is the symbol for Oxygen?", answer: "O", options: ["O", "Ox", "Og", "Os"], tip: "Oxygen's symbol is just O. Os is osmium." },
  { skill: "Element symbols", prompt: "What is the symbol for Sodium?", answer: "Na", options: ["Na", "So", "Sd", "S"], tip: "Sodium's symbol, Na, comes from its Latin name natrium." },
  { skill: "Element symbols", prompt: "What is the symbol for Magnesium?", answer: "Mg", options: ["Mg", "Ma", "Mn", "Mt"], tip: "Magnesium is Mg. Mn is manganese." },
  { skill: "Element symbols", prompt: "What is the symbol for Aluminium?", answer: "Al", options: ["Al", "Au", "Am", "Ag"], tip: "Aluminium is Al. Au is gold, Ag is silver." },
  { skill: "Element symbols", prompt: "What is the symbol for Silicon?", answer: "Si", options: ["Si", "Sc", "Sl", "Sn"], tip: "Silicon is Si. Sn is tin." },
  { skill: "Element symbols", prompt: "What is the symbol for Phosphorus?", answer: "P", options: ["P", "Ph", "Po", "Pt"], tip: "Phosphorus's symbol is just P. Pt is platinum." },
  { skill: "Element symbols", prompt: "What is the symbol for Sulphur?", answer: "S", options: ["S", "Su", "Sl", "Sp"], tip: "Sulphur's symbol is a single letter, S." },
  { skill: "Element symbols", prompt: "What is the symbol for Chlorine?", answer: "Cl", options: ["Cl", "Ch", "Co", "Cr"], tip: "Chlorine is Cl. Co is cobalt, Cr is chromium." },
  { skill: "Element symbols", prompt: "What is the symbol for Potassium?", answer: "K", options: ["K", "P", "Po", "Pt"], tip: "Potassium's symbol, K, comes from its Latin name kalium." },
  { skill: "Element symbols", prompt: "What is the symbol for Calcium?", answer: "Ca", options: ["Ca", "Cl", "Cm", "C"], tip: "Calcium is Ca, not Cl (that's chlorine)." },
  { skill: "Element symbols", prompt: "What is the symbol for Iron?", answer: "Fe", options: ["Fe", "Ir", "In", "I"], tip: "Iron's symbol, Fe, comes from its Latin name ferrum." },
  { skill: "Element symbols", prompt: "What is the symbol for Copper?", answer: "Cu", options: ["Cu", "Co", "Cp", "Cr"], tip: "Copper's symbol, Cu, comes from its Latin name cuprum." },
  { skill: "Element symbols", prompt: "What is the symbol for Zinc?", answer: "Zn", options: ["Zn", "Zi", "Z", "Zc"], tip: "Zinc's symbol is Zn." },
  { skill: "Element symbols", prompt: "What is the symbol for Silver?", answer: "Ag", options: ["Ag", "Si", "Sv", "Al"], tip: "Silver's symbol, Ag, comes from its Latin name argentum." },
  { skill: "Element symbols", prompt: "What is the symbol for Gold?", answer: "Au", options: ["Au", "Go", "Gd", "Ag"], tip: "Gold's symbol, Au, comes from its Latin name aurum." },
  { skill: "Element symbols", prompt: "What is the symbol for Lead?", answer: "Pb", options: ["Pb", "Le", "Ld", "Pt"], tip: "Lead's symbol, Pb, comes from its Latin name plumbum." },
  { skill: "Element symbols", prompt: "What is the symbol for Tin?", answer: "Sn", options: ["Sn", "Ti", "Sl", "Tn"], tip: "Tin's symbol, Sn, comes from its Latin name stannum." },
  { skill: "Element symbols", prompt: "What is the symbol for Mercury?", answer: "Hg", options: ["Hg", "Me", "Hy", "Mc"], tip: "Mercury's symbol, Hg, comes from its Latin name hydrargyrum." },
  { skill: "Element symbols", prompt: "What is the symbol for Neon?", answer: "Ne", options: ["Ne", "No", "Nn", "N"], tip: "Neon is Ne, not just N (that's nitrogen)." },
  { skill: "Element symbols", prompt: "What is the symbol for Argon?", answer: "Ar", options: ["Ar", "Ag", "Au", "An"], tip: "Argon is Ar. Ag is silver." },
  // Element symbols: symbol -> name
  { skill: "Element symbols", prompt: "Which element has the symbol Na?", answer: "Sodium", options: ["Sodium", "Nickel", "Nitrogen", "Neon"], tip: "Na is sodium, from the Latin natrium." },
  { skill: "Element symbols", prompt: "Which element has the symbol K?", answer: "Potassium", options: ["Potassium", "Krypton", "Calcium", "Carbon"], tip: "K is potassium, from the Latin kalium." },
  { skill: "Element symbols", prompt: "Which element has the symbol Fe?", answer: "Iron", options: ["Iron", "Fluorine", "Francium", "Phosphorus"], tip: "Fe is iron, from the Latin ferrum." },
  { skill: "Element symbols", prompt: "Which element has the symbol Au?", answer: "Gold", options: ["Gold", "Silver", "Aluminium", "Argon"], tip: "Au is gold, from the Latin aurum." },
  { skill: "Element symbols", prompt: "Which element has the symbol Ag?", answer: "Silver", options: ["Silver", "Gold", "Aluminium", "Arsenic"], tip: "Ag is silver, from the Latin argentum." },
  { skill: "Element symbols", prompt: "Which element has the symbol Hg?", answer: "Mercury", options: ["Mercury", "Hydrogen", "Helium", "Hafnium"], tip: "Hg is mercury, the only metal that is liquid at room temperature." },
  { skill: "Element symbols", prompt: "Which element has the symbol Sn?", answer: "Tin", options: ["Tin", "Sodium", "Sulphur", "Silicon"], tip: "Sn is tin, from the Latin stannum." },
  { skill: "Element symbols", prompt: "Which element has the symbol Pb?", answer: "Lead", options: ["Lead", "Phosphorus", "Platinum", "Potassium"], tip: "Pb is lead, from the Latin plumbum." },

  // Valency
  { skill: "Valency", prompt: "What is the valency of Hydrogen?", answer: "1", options: ["1", "2", "3", "4"], tip: "Hydrogen forms one bond, as in H2O or HCl." },
  { skill: "Valency", prompt: "What is the valency of Oxygen?", answer: "2", options: ["1", "2", "3", "4"], tip: "Oxygen's valency is 2, as in H2O." },
  { skill: "Valency", prompt: "What is the valency of Nitrogen?", answer: "3", options: ["1", "2", "3", "4"], tip: "Nitrogen's valency is 3, as in NH3." },
  { skill: "Valency", prompt: "What is the valency of Carbon?", answer: "4", options: ["1", "2", "3", "4"], tip: "Carbon's valency is 4, as in CH4." },
  { skill: "Valency", prompt: "What is the valency of Sodium?", answer: "1", options: ["1", "2", "3", "4"], tip: "Sodium's valency is 1, as in NaCl." },
  { skill: "Valency", prompt: "What is the valency of Calcium?", answer: "2", options: ["1", "2", "3", "4"], tip: "Calcium's valency is 2, as in CaCl2." },
  { skill: "Valency", prompt: "What is the valency of Aluminium?", answer: "3", options: ["1", "2", "3", "4"], tip: "Aluminium's valency is 3, as in Al2O3." },
  { skill: "Valency", prompt: "What is the valency of Chlorine?", answer: "1", options: ["1", "2", "3", "4"], tip: "Chlorine's valency is 1, as in HCl or NaCl." },
  { skill: "Valency", prompt: "What is the valency of Magnesium?", answer: "2", options: ["1", "2", "3", "4"], tip: "Magnesium's valency is 2, as in MgO." },
  { skill: "Valency", prompt: "What is the valency of Potassium?", answer: "1", options: ["1", "2", "3", "4"], tip: "Potassium's valency is 1, as in KCl." },
  { skill: "Valency", prompt: "What is the valency of Sulphur in H$_2$S?", answer: "2", options: ["1", "2", "3", "4"], tip: "Sulphur combines with two hydrogen atoms in H2S, so its valency there is 2." },
  { skill: "Valency", prompt: "What is the valency of Phosphorus in PH$_3$?", answer: "3", options: ["1", "2", "3", "5"], tip: "Phosphorus combines with three hydrogen atoms in PH3, so its valency there is 3." },
  { skill: "Valency", prompt: "What is the valency of Fluorine?", answer: "1", options: ["1", "2", "3", "7"], tip: "Fluorine has 7 outer electrons and gains 1 to complete its octet, so its valency is 1. Valency is never 7 here." },
  { skill: "Valency", prompt: "What is the valency of Neon?", answer: "0", options: ["0", "1", "2", "8"], tip: "Neon's outer shell already has 8 electrons, so it doesn't combine. Its valency is 0." },
  { skill: "Valency", prompt: "What is the valency of Silicon?", answer: "4", options: ["1", "2", "3", "4"], tip: "Silicon has 4 outer electrons, like carbon, so its valency is 4, as in SiO2." },
  { skill: "Valency", prompt: "What is the valency of the sulphate ion, SO$_4^{2-}$?", answer: "2", options: ["1", "2", "3", "4"], tip: "The ion carries a charge of 2−, so its valency is 2, as in Na2SO4." },
  { skill: "Valency", prompt: "What is the valency of the hydroxide ion, OH$^-$?", answer: "1", options: ["1", "2", "3", "4"], tip: "The ion carries a charge of 1−, so its valency is 1, as in NaOH." },
  { skill: "Valency", prompt: "What is the valency of the ammonium ion, NH$_4^+$?", answer: "1", options: ["1", "2", "3", "4"], tip: "The ion carries a charge of 1+, so its valency is 1, as in NH4Cl." },
  { skill: "Valency", prompt: "What is the valency of the carbonate ion, CO$_3^{2-}$?", answer: "2", options: ["1", "2", "3", "4"], tip: "The ion carries a charge of 2−, so its valency is 2, as in CaCO3." },

  // Atomic number
  { skill: "Atomic number", prompt: "What is the atomic number of Hydrogen?", answer: "1", options: ["1", "2", "6", "8"], tip: "Hydrogen has 1 proton, so its atomic number is 1." },
  { skill: "Atomic number", prompt: "What is the atomic number of Helium?", answer: "2", options: ["1", "2", "4", "8"], tip: "Helium has 2 protons." },
  { skill: "Atomic number", prompt: "What is the atomic number of Carbon?", answer: "6", options: ["4", "6", "8", "12"], tip: "Carbon has 6 protons." },
  { skill: "Atomic number", prompt: "What is the atomic number of Nitrogen?", answer: "7", options: ["6", "7", "8", "14"], tip: "Nitrogen has 7 protons." },
  { skill: "Atomic number", prompt: "What is the atomic number of Oxygen?", answer: "8", options: ["6", "7", "8", "16"], tip: "Oxygen has 8 protons." },
  { skill: "Atomic number", prompt: "What is the atomic number of Sodium?", answer: "11", options: ["10", "11", "12", "23"], tip: "Sodium has 11 protons." },
  { skill: "Atomic number", prompt: "What is the atomic number of Chlorine?", answer: "17", options: ["16", "17", "18", "35"], tip: "Chlorine has 17 protons." },
  { skill: "Atomic number", prompt: "What is the atomic number of Calcium?", answer: "20", options: ["18", "19", "20", "40"], tip: "Calcium has 20 protons." },
  { skill: "Atomic number", prompt: "What is the atomic number of Lithium?", answer: "3", options: ["2", "3", "4", "7"], tip: "Lithium has 3 protons. 7 is its mass number." },
  { skill: "Atomic number", prompt: "What is the atomic number of Boron?", answer: "5", options: ["4", "5", "6", "11"], tip: "Boron has 5 protons. 11 is its mass number." },
  { skill: "Atomic number", prompt: "What is the atomic number of Fluorine?", answer: "9", options: ["7", "9", "10", "19"], tip: "Fluorine has 9 protons. 19 is its mass number." },
  { skill: "Atomic number", prompt: "What is the atomic number of Neon?", answer: "10", options: ["8", "10", "12", "20"], tip: "Neon has 10 protons. 20 is its mass number." },
  { skill: "Atomic number", prompt: "What is the atomic number of Magnesium?", answer: "12", options: ["11", "12", "13", "24"], tip: "Magnesium has 12 protons. 24 is its mass number." },
  { skill: "Atomic number", prompt: "What is the atomic number of Aluminium?", answer: "13", options: ["12", "13", "14", "27"], tip: "Aluminium has 13 protons. 27 is its mass number." },
  { skill: "Atomic number", prompt: "What is the atomic number of Silicon?", answer: "14", options: ["12", "14", "16", "28"], tip: "Silicon has 14 protons. 28 is its mass number." },
  { skill: "Atomic number", prompt: "What is the atomic number of Phosphorus?", answer: "15", options: ["14", "15", "16", "31"], tip: "Phosphorus has 15 protons. 31 is its mass number." },
  { skill: "Atomic number", prompt: "What is the atomic number of Sulphur?", answer: "16", options: ["15", "16", "17", "32"], tip: "Sulphur has 16 protons. 32 is its mass number." },
  { skill: "Atomic number", prompt: "What is the atomic number of Potassium?", answer: "19", options: ["17", "19", "20", "39"], tip: "Potassium has 19 protons. 39 is its mass number." },

  // Subatomic particles
  { skill: "Subatomic particles", prompt: "Which subatomic particle carries a positive charge?", answer: "Proton", options: ["Proton", "Neutron", "Electron", "Nucleus"], tip: "Protons are positive, electrons are negative, and neutrons carry no charge." },
  { skill: "Subatomic particles", prompt: "Which subatomic particle carries no charge?", answer: "Neutron", options: ["Proton", "Neutron", "Electron", "Ion"], tip: "Neutrons are neutral, which is how they got their name." },
  { skill: "Subatomic particles", prompt: "Which subatomic particle carries a negative charge?", answer: "Electron", options: ["Proton", "Neutron", "Electron", "Nucleus"], tip: "Electrons are negative and move around the nucleus." },
  { skill: "Subatomic particles", prompt: "Protons and neutrons are both found in the atom's...?", answer: "Nucleus", options: ["Nucleus", "Shells", "Orbit", "Valence"], tip: "The nucleus is the small, dense centre of the atom, holding protons and neutrons." },
  { skill: "Subatomic particles", prompt: "Who discovered the electron?", answer: "J.J. Thomson", options: ["J.J. Thomson", "Ernest Rutherford", "James Chadwick", "John Dalton"], tip: "Thomson discovered the electron in 1897 using a cathode ray tube." },
  { skill: "Subatomic particles", prompt: "Whose gold foil experiment discovered the nucleus?", answer: "Rutherford", options: ["Rutherford", "Thomson", "Dalton", "Bohr"], tip: "Rutherford's gold foil experiment showed atoms have a small, dense, positive nucleus." },
  { skill: "Subatomic particles", prompt: "Who discovered the neutron?", answer: "James Chadwick", options: ["James Chadwick", "J.J. Thomson", "Ernest Rutherford", "Niels Bohr"], tip: "Chadwick discovered the neutron in 1932." },
  { skill: "Subatomic particles", prompt: "Who discovered canal rays, which led to the discovery of the proton?", answer: "E. Goldstein", options: ["E. Goldstein", "James Chadwick", "John Dalton", "Niels Bohr"], tip: "Goldstein found positively charged canal rays in 1886. They led to the discovery of the proton." },
  { skill: "Subatomic particles", prompt: "An electron's mass is about how much of a proton's?", answer: "1/2000", options: ["1/2000", "Equal", "1/2", "2000 times"], tip: "An electron is about 2000 times lighter than a proton, so electrons add almost nothing to an atom's mass." },
  { skill: "Subatomic particles", prompt: "Mass number = protons + ...?", answer: "Neutrons", options: ["Neutrons", "Electrons", "Valency", "Shells"], tip: "Mass number counts the particles in the nucleus: protons plus neutrons." },
  { skill: "Subatomic particles", prompt: "Sodium has atomic number 11 and mass number 23. How many neutrons?", answer: "12", options: ["11", "12", "23", "34"], tip: "Neutrons = mass number − atomic number = 23 − 11 = 12." },
  { skill: "Subatomic particles", prompt: "Chlorine-35 has atomic number 17. How many neutrons?", answer: "18", options: ["17", "18", "35", "52"], tip: "Neutrons = 35 − 17 = 18." },
  { skill: "Subatomic particles", prompt: "At most how many electrons can the first shell (K shell) hold?", answer: "2", options: ["2", "8", "18", "32"], tip: "A shell holds at most 2n² electrons. For n = 1 that is 2." },
  { skill: "Subatomic particles", prompt: "What is the electronic configuration of Sodium (11 electrons)?", answer: "2, 8, 1", options: ["2, 8, 1", "2, 9", "8, 2, 1", "2, 8, 2"], tip: "Fill K (2), then L (8), then the one left over goes into M: 2, 8, 1." },
  { skill: "Subatomic particles", prompt: "What is the electronic configuration of Chlorine (17 electrons)?", answer: "2, 8, 7", options: ["2, 8, 7", "2, 7, 8", "2, 8, 8", "8, 8, 1"], tip: "K takes 2, L takes 8, and the remaining 7 go into M: 2, 8, 7." },
  { skill: "Subatomic particles", prompt: "Isotopes of an element have the same number of...?", answer: "Protons", options: ["Protons", "Neutrons", "Nucleons", "Mass number"], tip: "Isotopes share the atomic number (protons) but differ in neutrons, so their mass numbers differ." },
  { skill: "Subatomic particles", prompt: "How many electrons does a sodium ion, Na$^+$, have?", answer: "10", options: ["10", "11", "12", "23"], tip: "A sodium atom has 11 electrons. Na⁺ has lost one, leaving 10." },
  { skill: "Subatomic particles", prompt: "An isotope of which element is used to treat goitre?", answer: "Iodine", options: ["Iodine", "Uranium", "Cobalt", "Carbon"], tip: "Radioactive iodine is used to treat goitre, a thyroid disease. Cobalt-60 is used against cancer." },

  // Separating mixtures
  { skill: "Separating mixtures", prompt: "Which method separates insoluble sand from water?", answer: "Filtration", options: ["Filtration", "Evaporation", "Distillation", "Chromatography"], tip: "Filtration lets a liquid pass through while trapping insoluble solid particles." },
  { skill: "Separating mixtures", prompt: "Which method gets back the salt dissolved in salty water?", answer: "Evaporation", options: ["Evaporation", "Filtration", "Magnetic separation", "Sublimation"], tip: "Evaporation drives off the water, leaving the dissolved salt behind." },
  { skill: "Separating mixtures", prompt: "Which method separates cream from milk?", answer: "Centrifugation", options: ["Centrifugation", "Filtration", "Evaporation", "Decantation"], tip: "Centrifugation spins the milk fast so the lighter cream separates out." },
  { skill: "Separating mixtures", prompt: "Which method separates two miscible liquids with different boiling points, like water and alcohol?", answer: "Distillation", options: ["Distillation", "Filtration", "Sublimation", "Crystallisation"], tip: "Heating the mixture boils off the lower-boiling liquid first, which is then condensed and collected." },
  { skill: "Separating mixtures", prompt: "Which method separates iron filings from a mixture with sand?", answer: "Magnetic separation", options: ["Magnetic separation", "Filtration", "Evaporation", "Centrifugation"], tip: "A magnet pulls out the iron filings, since sand isn't magnetic." },
  { skill: "Separating mixtures", prompt: "Which method separates oil from water, two immiscible liquids?", answer: "Separating funnel", options: ["Separating funnel", "Filtration", "Chromatography", "Sublimation"], tip: "A separating funnel lets the denser liquid be drained off from the bottom, layer by layer." },
  { skill: "Separating mixtures", prompt: "Which method purifies a solid that dissolves more in hot water than in cold?", answer: "Crystallisation", options: ["Crystallisation", "Filtration", "Distillation", "Decantation"], tip: "Cooling a hot saturated solution slowly makes pure crystals of the solid form." },
  { skill: "Separating mixtures", prompt: "Which method separates the different coloured dyes in black ink?", answer: "Chromatography", options: ["Chromatography", "Filtration", "Evaporation", "Centrifugation"], tip: "Chromatography spreads out the dyes because each one travels up the paper at a different speed." },
  { skill: "Separating mixtures", prompt: "Which method separates ammonium chloride from common salt?", answer: "Sublimation", options: ["Sublimation", "Filtration", "Evaporation", "Chromatography"], tip: "Ammonium chloride turns straight into vapour when heated and settles back as a solid on a cool surface. Salt stays behind." },
  { skill: "Separating mixtures", prompt: "Which method separates camphor from sand?", answer: "Sublimation", options: ["Sublimation", "Decantation", "Distillation", "Centrifugation"], tip: "Camphor sublimes on heating, so it can be collected as it cools. Sand doesn't change." },
  { skill: "Separating mixtures", prompt: "Which method separates the gases of air, like oxygen and nitrogen?", answer: "Fractional distillation", options: ["Fractional distillation", "Filtration", "Sublimation", "Centrifugation"], tip: "Air is cooled into a liquid, then warmed. Each gas boils off at its own boiling point." },
  { skill: "Separating mixtures", prompt: "Which method separates petrol, diesel and kerosene from crude oil?", answer: "Fractional distillation", options: ["Fractional distillation", "Crystallisation", "Filtration", "Chromatography"], tip: "Crude oil is heated in a tall column. Each fraction condenses at a different height, by its boiling point." },
  { skill: "Separating mixtures", prompt: "Which method separates butter from curd?", answer: "Centrifugation", options: ["Centrifugation", "Filtration", "Sublimation", "Distillation"], tip: "Churning spins the curd fast, so the lighter butter separates out." },
  { skill: "Separating mixtures", prompt: "Which method gets pure copper sulphate from an impure sample?", answer: "Crystallisation", options: ["Crystallisation", "Evaporation", "Sublimation", "Decantation"], tip: "Crystallisation leaves the impurities behind in the solution. Plain evaporation would leave them in the solid." },
  { skill: "Separating mixtures", prompt: "Mud has settled at the bottom of a glass of water. Pouring off the clear water is called...?", answer: "Decantation", options: ["Decantation", "Filtration", "Sedimentation", "Evaporation"], tip: "Sedimentation is the settling. Decantation is pouring off the liquid above it." },
  { skill: "Separating mixtures", prompt: "Alum makes fine mud particles in water clump together and settle. This is...?", answer: "Coagulation", options: ["Coagulation", "Sublimation", "Chromatography", "Distillation"], tip: "Alum makes the tiny particles stick together into heavier clumps that settle quickly." },
  { skill: "Separating mixtures", prompt: "Which method separates blood cells from plasma in a lab?", answer: "Centrifugation", options: ["Centrifugation", "Filtration", "Evaporation", "Sublimation"], tip: "Spinning the blood fast pushes the heavier cells to the bottom of the tube." },
  { skill: "Separating mixtures", prompt: "Which method separates kerosene from water?", answer: "Separating funnel", options: ["Separating funnel", "Filtration", "Sublimation", "Centrifugation"], tip: "Kerosene and water don't mix. The water, which is denser, is drained from the bottom of the funnel." },
];
