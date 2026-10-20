import type { SubjectId } from "../../content/schema";

export interface Fact {
  text: string;
  truth: boolean;
  why: string;
  subject: SubjectId;
  topic: string;
}

/** True/false statements from the Class 9 syllabus, many built on common exam mistakes. */
export const FACTS: Fact[] = [
  // Physics
  { subject: "physics", topic: "Motion", truth: true, text: "A car going round a circular track at a steady speed is accelerating.", why: "Its direction keeps changing, so its velocity changes. A change in velocity is acceleration." },
  { subject: "physics", topic: "Motion", truth: true, text: "Displacement can be zero even when the distance travelled is not.", why: "Run one full lap and stop at the start: distance is the lap length, displacement is zero." },
  { subject: "physics", topic: "Gravitation", truth: false, text: "Heavier objects always fall faster than lighter ones.", why: "Without air resistance, every object falls with the same acceleration, g ≈ 9.8 m/s²." },
  { subject: "physics", topic: "Force and laws of motion", truth: false, text: "The SI unit of force is the joule.", why: "Force is measured in newtons (N). The joule is the unit of work and energy." },
  { subject: "physics", topic: "Gravitation", truth: false, text: "Your mass becomes smaller on the Moon.", why: "Mass stays the same everywhere. Your weight on the Moon is about one-sixth of your weight on Earth." },
  { subject: "physics", topic: "Sound", truth: true, text: "Sound cannot travel through a vacuum.", why: "Sound needs a medium (solid, liquid or gas) to travel. That's why space is silent." },
  { subject: "physics", topic: "Sound", truth: false, text: "Sound travels faster in air than in steel.", why: "Sound is fastest in solids. It moves at about 5,960 m/s in steel and about 346 m/s in air." },
  { subject: "physics", topic: "Force and laws of motion", truth: false, text: "A book resting on a table has no forces acting on it.", why: "Gravity pulls it down and the table pushes it up. The forces are balanced, so it stays at rest." },
  { subject: "physics", topic: "Force and laws of motion", truth: true, text: "A heavier object has more inertia than a lighter one.", why: "Inertia depends on mass. That's why it's harder to push a loaded trolley than an empty one." },
  { subject: "physics", topic: "Work and energy", truth: true, text: "Holding a heavy bag still does zero work in physics.", why: "Work = force × displacement. The bag doesn't move, so the work done on it is zero, even though you feel tired." },
  { subject: "physics", topic: "Sound", truth: false, text: "Humans can hear a sound of 50,000 Hz.", why: "Humans hear roughly 20 Hz to 20,000 Hz. 50,000 Hz is ultrasound. Bats and dolphins can hear it." },
  { subject: "physics", topic: "Work and energy", truth: true, text: "1 kilowatt-hour equals 3.6 million joules.", why: "1 kWh = 1000 W × 3600 s = 3,600,000 J. It is the 'unit' on your electricity bill." },
  { subject: "physics", topic: "Work and energy", truth: false, text: "If a ball's speed doubles, its kinetic energy doubles.", why: "KE = ½mv². Double the speed and the kinetic energy becomes four times as much." },
  { subject: "physics", topic: "Gravitation", truth: false, text: "If the distance between two objects is halved, the gravitational force between them doubles.", why: "Gravity follows the inverse-square law. Halving the distance makes the force four times as strong." },
  { subject: "physics", topic: "Gravitation", truth: true, text: "An object floats in water if its density is less than the density of water.", why: "Then the buoyant force can balance its weight before it sinks fully. That is Archimedes' principle at work." },
  { subject: "physics", topic: "Force and laws of motion", truth: true, text: "When a gun is fired, it recoils backwards.", why: "Newton's third law: the gun pushes the bullet forward, so the bullet pushes the gun back." },
  { subject: "physics", topic: "Sound", truth: true, text: "To hear a clear echo, the wall should be at least about 17 m away.", why: "Our ears keep a sound for about 0.1 s. In that time sound travels about 34 m, which is 17 m there and 17 m back." },

  // Chemistry
  { subject: "chemistry", topic: "Matter around us", truth: false, text: "Evaporation happens only when water reaches 100 °C.", why: "Evaporation happens at any temperature, from the surface. That's how wet clothes dry." },
  { subject: "chemistry", topic: "Matter around us", truth: true, text: "Dry ice is solid carbon dioxide.", why: "Solid CO₂ turns straight into gas without melting. That change is called sublimation." },
  { subject: "chemistry", topic: "Is matter pure?", truth: false, text: "Air is a compound.", why: "Air is a mixture of gases. Its make-up can change and it can be separated by physical methods." },
  { subject: "chemistry", topic: "Is matter pure?", truth: true, text: "Brass is a mixture.", why: "Brass is an alloy of copper and zinc. Alloys are mixtures because the proportions can vary." },
  { subject: "chemistry", topic: "Structure of the atom", truth: true, text: "Every atom of an element has the same number of protons.", why: "The number of protons is the atomic number, and it decides which element it is." },
  { subject: "chemistry", topic: "Structure of the atom", truth: false, text: "Rutherford discovered the electron.", why: "J.J. Thomson discovered the electron. Rutherford's gold foil experiment discovered the nucleus." },
  { subject: "chemistry", topic: "Structure of the atom", truth: false, text: "Isotopes of an element have the same mass number.", why: "Isotopes have the same atomic number but different mass numbers. Atoms with the same mass number are isobars." },
  { subject: "chemistry", topic: "Atoms and molecules", truth: true, text: "Mass is neither created nor destroyed in a chemical reaction.", why: "This is the law of conservation of mass, given by Lavoisier. It's why chemical equations must be balanced." },
  { subject: "chemistry", topic: "Structure of the atom", truth: false, text: "A neutron carries a negative charge.", why: "A neutron has no charge. The electron is negative and the proton is positive." },
  { subject: "chemistry", topic: "Is matter pure?", truth: true, text: "Milk is a colloid.", why: "Tiny fat and protein particles stay spread through the water and don't settle. That is a colloid." },
  { subject: "chemistry", topic: "Matter around us", truth: true, text: "Camphor changes straight from solid to gas when heated.", why: "This is sublimation. Naphthalene balls and ammonium chloride sublime too." },
  { subject: "chemistry", topic: "Atoms and molecules", truth: true, text: "One mole of any substance contains about 6.022 × 10²³ particles.", why: "This is the Avogadro number. A mole is just a very big counting unit, like a dozen." },
  { subject: "chemistry", topic: "Matter around us", truth: true, text: "0 °C is about 273 K.", why: "To change Celsius to kelvin, add 273 (273.15 exactly)." },
  { subject: "chemistry", topic: "Atoms and molecules", truth: false, text: "The chemical formula of common salt is NaCl₂.", why: "Sodium has a valency of 1 and chlorine also has a valency of 1, so the formula is NaCl." },

  // Biology
  { subject: "biology", topic: "The fundamental unit of life", truth: true, text: "Robert Hooke first saw cells, in a thin slice of cork.", why: "In 1665 he saw tiny box-like compartments in cork and called them 'cells'." },
  { subject: "biology", topic: "The fundamental unit of life", truth: true, text: "Mitochondria are called the powerhouse of the cell.", why: "They release energy from food during respiration and store it as ATP." },
  { subject: "biology", topic: "The fundamental unit of life", truth: false, text: "Animal cells have a cell wall.", why: "Only plant cells (and fungi and bacteria) have a cell wall. Animal cells have just a cell membrane." },
  { subject: "biology", topic: "The fundamental unit of life", truth: false, text: "Bacteria have a well-defined nucleus.", why: "Bacteria are prokaryotes. Their genetic material has no nuclear membrane around it." },
  { subject: "biology", topic: "Tissues", truth: false, text: "In plants, the xylem carries food.", why: "Xylem carries water and minerals. Phloem carries food." },
  { subject: "biology", topic: "The fundamental unit of life", truth: true, text: "Lysosomes are called the 'suicide bags' of the cell.", why: "When a cell is damaged, lysosomes can burst and their enzymes digest the cell itself." },
  { subject: "biology", topic: "The fundamental unit of life", truth: true, text: "Ribosomes are where proteins are made.", why: "Ribosomes, many of them on the rough ER, join amino acids together to build proteins." },
  { subject: "biology", topic: "Tissues", truth: true, text: "Heart muscle keeps contracting rhythmically all through life.", why: "Cardiac muscle is involuntary and keeps working without rest." },
  { subject: "biology", topic: "Tissues", truth: true, text: "A nerve cell can be up to a metre long.", why: "Neurons have long fibres (axons) to carry messages across the body, so they are the longest cells." },
  { subject: "biology", topic: "Tissues", truth: false, text: "Tendons join bone to bone.", why: "Tendons join muscle to bone. Ligaments join bone to bone." },
  { subject: "biology", topic: "Health and disease", truth: false, text: "Antibiotics kill viruses.", why: "Antibiotics work against bacteria. They do not work on viral illnesses like the common cold." },
  { subject: "biology", topic: "Health and disease", truth: false, text: "Malaria is caused by a virus.", why: "Malaria is caused by a protozoan, Plasmodium. It is spread by the female Anopheles mosquito." },
  { subject: "biology", topic: "Tissues", truth: false, text: "Red blood cells in humans have a nucleus.", why: "Mature human red blood cells lose their nucleus, which leaves more room for haemoglobin to carry oxygen." },

  // Maths
  { subject: "maths", topic: "Number systems", truth: false, text: "√2 is a rational number.", why: "√2 cannot be written as p/q. Its decimal goes on forever without repeating, so it is irrational." },
  { subject: "maths", topic: "Number systems", truth: true, text: "Every integer is a rational number.", why: "Any integer n can be written as n/1, so it fits the form p/q." },
  { subject: "maths", topic: "Number systems", truth: false, text: "π is exactly equal to 22/7.", why: "22/7 is only an approximation. π is irrational, so no fraction is exactly equal to it." },
  { subject: "maths", topic: "Number systems", truth: false, text: "0.3333… (with 3 repeating forever) is irrational.", why: "A repeating decimal is rational. 0.333… = 1/3." },
  { subject: "maths", topic: "Polynomials", truth: false, text: "A polynomial of degree 2 is called a cubic polynomial.", why: "Degree 2 is quadratic. Degree 3 is cubic." },
  { subject: "maths", topic: "Polynomials", truth: false, text: "(a + b)² = a² + b²", why: "(a + b)² = a² + 2ab + b². Students often forget the middle term, 2ab." },
  { subject: "maths", topic: "Euclid's geometry", truth: true, text: "Exactly one line can pass through two different points.", why: "This is one of Euclid's axioms." },
  { subject: "maths", topic: "Coordinate geometry", truth: false, text: "The point (0, 5) lies on the x-axis.", why: "When x = 0 the point is on the y-axis. Points on the x-axis have y = 0." },
  { subject: "maths", topic: "Lines and angles", truth: true, text: "Vertically opposite angles are always equal.", why: "When two lines cross, the opposite angles are equal. This is a basic theorem in Lines and Angles." },
  { subject: "maths", topic: "Quadrilaterals", truth: true, text: "Every square is a rhombus.", why: "A rhombus has all four sides equal, and a square does too. A square just also has 90° angles." },
  { subject: "maths", topic: "Quadrilaterals", truth: true, text: "The diagonals of a rectangle are equal in length.", why: "Use congruent triangles (SAS) on the two halves of the rectangle to prove it." },
  { subject: "maths", topic: "Triangles", truth: false, text: "A triangle can have two right angles.", why: "The angles of a triangle add up to 180°. Two right angles already make 180°, leaving nothing for the third angle." },

  // Social science
  { subject: "social", topic: "The French Revolution", truth: true, text: "The French Revolution began in 1789.", why: "It began on 14 July 1789, when a crowd stormed the Bastille fortress-prison in Paris." },
  { subject: "social", topic: "India – size and location", truth: true, text: "The Tropic of Cancer passes through India.", why: "It divides India almost into two halves and passes through eight states." },
  { subject: "social", topic: "India – size and location", truth: true, text: "India's Standard Meridian (82°30′E) passes through Mirzapur in Uttar Pradesh.", why: "Indian Standard Time is based on this longitude." },
  { subject: "social", topic: "India – size and location", truth: false, text: "India is the largest country in the world by area.", why: "India is the seventh-largest country by area. Russia is the largest." },
  { subject: "social", topic: "Electoral politics", truth: false, text: "In India, only educated adults can vote.", why: "Universal adult franchise: every citizen aged 18 or above can vote, whatever their education, income or religion." },
  { subject: "social", topic: "Constitutional design", truth: true, text: "The Constitution of India came into effect on 26 January 1950.", why: "That's why 26 January is celebrated as Republic Day." },
  { subject: "social", topic: "Nazism and the rise of Hitler", truth: true, text: "Hitler became Chancellor of Germany in 1933.", why: "He was appointed in January 1933 and quickly destroyed democracy in Germany." },
  { subject: "social", topic: "Physical features of India", truth: true, text: "The Lakshadweep islands are made of coral.", why: "They are coral islands in the Arabian Sea. The Andaman and Nicobar Islands are of volcanic and mountain origin." },
  { subject: "social", topic: "Physical features of India", truth: false, text: "The Himalayas are among the oldest mountains in the world.", why: "The Himalayas are young fold mountains. The Aravalli hills are among the oldest." },
  { subject: "social", topic: "Physical features of India", truth: true, text: "The Western Ghats are higher and more continuous than the Eastern Ghats.", why: "The Eastern Ghats are broken up by rivers flowing into the Bay of Bengal." },
  { subject: "social", topic: "Electoral politics", truth: false, text: "The voting age in India is 21 years.", why: "It was lowered from 21 to 18 years in 1989 by the 61st Amendment." },
  { subject: "social", topic: "Socialism in Europe and the Russian Revolution", truth: true, text: "The Bolsheviks came to power in Russia in October 1917.", why: "Led by Lenin, they took over in the October Revolution of 1917." },
  { subject: "social", topic: "Working of institutions", truth: false, text: "Members of the Rajya Sabha are directly elected by the people.", why: "Most Rajya Sabha members are elected by the elected members of the state legislative assemblies. Lok Sabha members are directly elected." },
  { subject: "social", topic: "Drainage", truth: false, text: "The Narmada flows from west to east into the Bay of Bengal.", why: "The Narmada flows westwards through a rift valley into the Arabian Sea." },
];
