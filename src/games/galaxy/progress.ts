import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Crown, Flame, Gem, Medal, Orbit, Rocket, Skull, Sparkles, Target, Trophy, type LucideIcon } from "lucide-react";
import type { SectionId } from "./sections";

/** One finished Galaxy Guardian run. */
export interface RunStats {
  score: number;
  correct: number;
  answered: number;
  wave: number;
  /** Difficulty level reached (climbs one per wave, up to the mission's top level). */
  level: number;
  bestCombo: number;
  bosses: number;
  powerups: number;
  asteroids: number;
  stardust: number;
}

export interface Lifetime {
  runs: number;
  score: number;
  correct: number;
  asteroids: number;
  bosses: number;
  bestWave: number;
  bestCombo: number;
  stardust: number;
}

export const RANKS = [
  { name: "Cadet", at: 0 },
  { name: "Pilot", at: 1_500 },
  { name: "Ace", at: 6_000 },
  { name: "Captain", at: 15_000 },
  { name: "Commander", at: 35_000 },
  { name: "Admiral", at: 75_000 },
  { name: "Legend", at: 150_000 },
];

export function rankOf(score: number) {
  let i = 0;
  while (i + 1 < RANKS.length && score >= RANKS[i + 1].at) i++;
  const next = RANKS[i + 1];
  return {
    index: i,
    name: RANKS[i].name,
    next: next?.name ?? null,
    progress: next ? (score - RANKS[i].at) / (next.at - RANKS[i].at) : 1,
    toNext: next ? next.at - score : 0,
  };
}

export interface Laser {
  id: string;
  name: string;
  cost: number;
  /** Beam colour, or "rainbow". */
  color: string;
}

export const LASERS: Laser[] = [
  { id: "ion", name: "Ion blue", cost: 0, color: "#5ee7ff" },
  { id: "nebula", name: "Nebula pink", cost: 150, color: "#ff5fd2" },
  { id: "plasma", name: "Plasma green", cost: 300, color: "#6bff8f" },
  { id: "solar", name: "Solar gold", cost: 500, color: "#ffd23f" },
  { id: "prism", name: "Prism", cost: 1_200, color: "rainbow" },
];

export type UpgradeId = "shield" | "cryo" | "nova";

export const UPGRADES: Record<UpgradeId, { name: string; desc: string; costs: number[] }> = {
  shield: { name: "Shield generator", desc: "+1 shield at launch", costs: [200, 500, 1_000] },
  cryo: { name: "Cryo pod", desc: "Start with a Freeze", costs: [150, 450] },
  nova: { name: "Nova core", desc: "Start with a Nova bomb", costs: [250, 700] },
};

interface MissionDef {
  id: string;
  text: string;
  goal: number;
  /** "sum" adds up over the day's runs; "max" keeps the best single run. */
  kind: "sum" | "max";
  stat: keyof RunStats | "runs";
  reward: number;
}

const MISSION_POOL: MissionDef[] = [
  { id: "correct20", text: "Answer 20 questions right", goal: 20, kind: "sum", stat: "correct", reward: 60 },
  { id: "correct50", text: "Answer 50 questions right", goal: 50, kind: "sum", stat: "correct", reward: 140 },
  { id: "combo8", text: "Reach a combo of 8", goal: 8, kind: "max", stat: "bestCombo", reward: 80 },
  { id: "combo15", text: "Reach a combo of 15", goal: 15, kind: "max", stat: "bestCombo", reward: 160 },
  { id: "wave5", text: "Reach wave 5", goal: 5, kind: "max", stat: "wave", reward: 90 },
  { id: "wave8", text: "Reach wave 8", goal: 8, kind: "max", stat: "wave", reward: 170 },
  { id: "boss1", text: "Defeat a mothership", goal: 1, kind: "sum", stat: "bosses", reward: 120 },
  { id: "power3", text: "Collect 3 power-ups", goal: 3, kind: "sum", stat: "powerups", reward: 60 },
  { id: "rocks40", text: "Blast 40 asteroids", goal: 40, kind: "sum", stat: "asteroids", reward: 70 },
  { id: "runs3", text: "Fly 3 missions", goal: 3, kind: "sum", stat: "runs", reward: 50 },
  { id: "score3k", text: "Score 3,000 in one run", goal: 3_000, kind: "max", stat: "score", reward: 110 },
];

export interface Badge {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  test: (l: Lifetime) => boolean;
}

export const BADGES: Badge[] = [
  { id: "launch", name: "First flight", desc: "Fly your first mission", icon: Rocket, test: (l) => l.runs >= 1 },
  { id: "slayer", name: "Boss slayer", desc: "Defeat a mothership", icon: Skull, test: (l) => l.bosses >= 1 },
  { id: "fire", name: "On fire", desc: "Reach a 10 combo", icon: Flame, test: (l) => l.bestCombo >= 10 },
  { id: "deep", name: "Deep space", desc: "Reach wave 8", icon: Orbit, test: (l) => l.bestWave >= 8 },
  { id: "century", name: "Century", desc: "100 right answers in total", icon: Target, test: (l) => l.correct >= 100 },
  { id: "hunter", name: "Boss hunter", desc: "Defeat 10 motherships", icon: Trophy, test: (l) => l.bosses >= 10 },
  { id: "unstoppable", name: "Unstoppable", desc: "Reach a 25 combo", icon: Sparkles, test: (l) => l.bestCombo >= 25 },
  { id: "collector", name: "Star collector", desc: "Earn 2,000 stardust", icon: Gem, test: (l) => l.stardust >= 2_000 },
  { id: "edge", name: "Edge of the galaxy", desc: "Reach wave 12", icon: Medal, test: (l) => l.bestWave >= 12 },
  { id: "legend", name: "Maths legend", desc: "1,000 right answers in total", icon: Crown, test: (l) => l.correct >= 1_000 },
];

const dayKey = () => new Date().toLocaleDateString("en-CA");

/** Three missions for today, the same all day. */
export function missionsFor(day: string): MissionDef[] {
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pool = [...MISSION_POOL];
  const out: MissionDef[] = [];
  while (out.length < 3) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0]);
  }
  return out;
}

/** This device's best run in one mission. */
export interface SectionRecord {
  best: number;
  bestLevel: number;
  plays: number;
}

interface GalaxyState {
  /** Mission picked on the start screen. */
  section: SectionId;
  sections: Partial<Record<SectionId, SectionRecord>>;
  setSection: (id: SectionId) => void;
  stardust: number;
  upgrades: Record<UpgradeId, number>;
  owned: string[];
  laser: string;
  lifetime: Lifetime;
  badges: string[];
  missions: { day: string; progress: Record<string, number>; claimed: string[] };
  buyUpgrade: (id: UpgradeId) => boolean;
  buyLaser: (id: string) => boolean;
  selectLaser: (id: string) => void;
  claimMission: (id: string) => number;
  /** Saves a run. Returns badges unlocked and missions finished by it. */
  recordRun: (run: RunStats, section: SectionId) => { badges: Badge[]; missions: string[] };
}

const EMPTY_LIFETIME: Lifetime = { runs: 0, score: 0, correct: 0, asteroids: 0, bosses: 0, bestWave: 0, bestCombo: 0, stardust: 0 };

export const useGalaxy = create<GalaxyState>()(
  persist(
    (set, get) => ({
      section: "mixed",
      sections: {},
      setSection: (section) => set({ section }),
      stardust: 0,
      upgrades: { shield: 0, cryo: 0, nova: 0 },
      owned: ["ion"],
      laser: "ion",
      lifetime: EMPTY_LIFETIME,
      badges: [],
      missions: { day: dayKey(), progress: {}, claimed: [] },
      buyUpgrade: (id) => {
        const s = get();
        const cost = UPGRADES[id].costs[s.upgrades[id]];
        if (cost === undefined || s.stardust < cost) return false;
        set({ stardust: s.stardust - cost, upgrades: { ...s.upgrades, [id]: s.upgrades[id] + 1 } });
        return true;
      },
      buyLaser: (id) => {
        const s = get();
        const l = LASERS.find((x) => x.id === id);
        if (!l || s.owned.includes(id) || s.stardust < l.cost) return false;
        set({ stardust: s.stardust - l.cost, owned: [...s.owned, id], laser: id });
        return true;
      },
      selectLaser: (laser) => set((s) => (s.owned.includes(laser) ? { laser } : {})),
      claimMission: (id) => {
        const s = get();
        const m = missionsFor(s.missions.day).find((x) => x.id === id);
        if (!m || s.missions.day !== dayKey() || s.missions.claimed.includes(id) || (s.missions.progress[id] ?? 0) < m.goal) return 0;
        set({ stardust: s.stardust + m.reward, missions: { ...s.missions, claimed: [...s.missions.claimed, id] } });
        return m.reward;
      },
      recordRun: (run, section) => {
        const s = get();
        const prev = s.sections[section];
        const record: SectionRecord = {
          best: Math.max(prev?.best ?? 0, run.score),
          bestLevel: Math.max(prev?.bestLevel ?? 0, run.level),
          plays: (prev?.plays ?? 0) + 1,
        };
        const l = s.lifetime;
        const lifetime: Lifetime = {
          runs: l.runs + 1,
          score: l.score + run.score,
          correct: l.correct + run.correct,
          asteroids: l.asteroids + run.asteroids,
          bosses: l.bosses + run.bosses,
          bestWave: Math.max(l.bestWave, run.wave),
          bestCombo: Math.max(l.bestCombo, run.bestCombo),
          stardust: l.stardust + run.stardust,
        };
        const newBadges = BADGES.filter((b) => !s.badges.includes(b.id) && b.test(lifetime));

        const day = dayKey();
        const missions = s.missions.day === day ? s.missions : { day, progress: {}, claimed: [] };
        const progress = { ...missions.progress };
        const done: string[] = [];
        for (const m of missionsFor(day)) {
          const before = progress[m.id] ?? 0;
          const v = m.stat === "runs" ? 1 : run[m.stat];
          progress[m.id] = m.kind === "sum" ? before + v : Math.max(before, v);
          if (before < m.goal && progress[m.id] >= m.goal) done.push(m.text);
        }

        set({
          lifetime,
          sections: { ...s.sections, [section]: record },
          stardust: s.stardust + run.stardust,
          badges: [...s.badges, ...newBadges.map((b) => b.id)],
          missions: { ...missions, progress },
        });
        return { badges: newBadges, missions: done };
      },
    }),
    { name: "prepquest-galaxy", storage: createJSONStorage(() => localStorage) },
  ),
);

/** Today's missions with progress (yesterday's progress no longer counts). */
export function useTodayMissions() {
  const missions = useGalaxy((s) => s.missions);
  const day = dayKey();
  const fresh = missions.day === day;
  return missionsFor(day).map((m) => {
    const p = fresh ? (missions.progress[m.id] ?? 0) : 0;
    return { ...m, progress: Math.min(p, m.goal), done: p >= m.goal, claimed: fresh && missions.claimed.includes(m.id) };
  });
}
