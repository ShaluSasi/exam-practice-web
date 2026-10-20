// Writes scripts/.demo-seed.sql: ~40 sample students with rounds and Galaxy
// Guardian runs spread over the last 60 days, so the leaderboards can be tried locally.
// Use: npm run db:seed:local   Remove: npm run db:unseed:local
// Local database only. All sample IDs start with "demo-".
import { writeFileSync } from "node:fs";

const first = ["Aarav", "Diya", "Vihaan", "Ananya", "Arjun", "Isha", "Kabir", "Meera", "Rohan", "Saanvi", "Aditya", "Kavya", "Ishaan", "Riya", "Krish", "Tara", "Dev", "Nisha", "Aryan", "Pooja", "Rahul", "Sneha", "Neel", "Aditi", "Varun", "Priya", "Yash", "Zara", "Om", "Lakshmi", "Harsh", "Anika", "Sahil", "Myra", "Karan", "Navya", "Reyansh", "Siya", "Atharv", "Fatima"];
const last = ["Sharma", "Nair", "Iyer", "Patel", "Reddy", "Menon", "Gupta", "Khan", "Das", "Pillai", "Joshi", "Singh", "Rao", "Kumar", "Bose"];
const chapters = [
  ["biology|9|Cell: The Building Block of Life", "Cell: The Building Block of Life"],
  ["physics|9|Motion", "Motion"],
  ["chemistry|9|Atoms and Molecules", "Atoms and Molecules"],
  ["maths|9|Number Systems", "Number Systems"],
  ["mixed", "Mixed practice"],
];

const galaxySections = ["mixed", "mul", "mul", "div", "add", "sub", "fractions", "percent", "squares", "integers", "powers", "equations", "bodmas"];

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (a) => a[Math.floor(rand() * a.length)];
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const now = Date.now();
const DAY = 86_400_000;
const lines = [];
first.forEach((name, i) => {
  const id = `demo-${i + 1}`;
  const full = `${name} ${pick(last)}`;
  const email = `${name.toLowerCase()}.${i + 1}@demo.prepquest`;
  lines.push(
    `INSERT INTO users (id, email, name, created_at, last_login_at, imported_at) VALUES (${q(id)}, ${q(email)}, ${q(full)}, ${now - 60 * DAY}, ${now}, ${now});`,
  );
  // Some students play a lot, some a little; a few only recently.
  const keen = rand();
  const count = 1 + Math.floor(keen * keen * 14);
  for (let r = 0; r < count; r++) {
    const [key, title] = pick(chapters);
    const accuracy = Math.round(35 + rand() * 65);
    const correct = Math.round((accuracy / 100) * 20);
    const xp = Math.round(correct * (8 + rand() * 6));
    const ago = rand() < 0.35 ? rand() * 6 * DAY : rand() * 60 * DAY;
    lines.push(
      `INSERT INTO rounds (user_id, email, client_id, title, correct, total, marks, max_marks, accuracy, xp, best_streak, time_ms, played_at, source, created_at, quiz_key) VALUES (${q(id)}, ${q(email)}, ${q(`${id}-r${r}`)}, ${q(title)}, ${correct}, 20, ${correct}, 20, ${accuracy}, ${xp}, ${Math.max(1, Math.round(correct * rand()))}, ${Math.round(180_000 + rand() * 600_000)}, ${Math.round(now - ago)}, 'live', ${now}, ${q(key)});`,
    );
  }
  // Galaxy Guardian runs, for the game scoreboards.
  const runs = Math.floor(rand() * rand() * 12);
  for (let r = 0; r < runs; r++) {
    const section = pick(galaxySections);
    const wave = 1 + Math.floor(rand() * rand() * 12);
    const correct = (wave - 1) * 6 + Math.floor(rand() * 6);
    const answered = correct + Math.floor(rand() * 6);
    const score = Math.round(correct * (25 + wave * 14) + 50 * wave * wave);
    const ago = rand() < 0.4 ? rand() * 6 * DAY : rand() * 60 * DAY;
    lines.push(
      `INSERT INTO game_runs (user_id, client_id, game, section, score, wave, level, correct, answered, best_combo, played_at, created_at) VALUES (${q(id)}, ${q(`${id}-g${r}`)}, 'galaxy', ${q(section)}, ${score}, ${wave}, ${Math.min(wave, 10)}, ${correct}, ${answered}, ${Math.min(correct, 3 + Math.floor(rand() * 15))}, ${Math.round(now - ago)}, ${now});`,
    );
  }
});
writeFileSync(new URL("./.demo-seed.sql", import.meta.url), lines.join("\n") + "\n");
console.log(`Wrote ${lines.length} statements for ${first.length} demo students.`);
