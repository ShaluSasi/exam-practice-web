import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bomb, ChevronsUp, Flame, Gem, Shield, ShieldPlus, Snowflake, Zap } from "lucide-react";
import clsx from "clsx";
import { RichText } from "../../components/RichText";
import { burst } from "../../lib/celebrate";
import { play } from "../../lib/sound";
import type { Mistake, SkillScore } from "../GameKit";
import { LASERS, useGalaxy, type RunStats } from "./progress";
import { levelForWave, levelLabel, maxLevel, nextQuestion, sectionOf, type Question, type SectionId } from "./sections";

/** Right answers needed to clear a normal wave. */
const WAVE_SIZE = 6;
const MAX_POWER = 3;
export const isBossWave = (w: number) => w % 4 === 0;
const multiplierFor = (combo: number) => 1 + Math.min(4, Math.floor(combo / 4));
const FIRE_COMBO = 10;

type PowerKind = "freeze" | "nova" | "shield";

interface Rock {
  id: number;
  qid: number;
  label: string;
  correct: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  /** Time it was destroyed (ms), 0 while alive. */
  dying: number;
  bad: boolean;
  hue: number;
}

interface Capsule {
  id: number;
  kind: PowerKind;
  x: number;
  y: number;
  vy: number;
  t: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: "spark" | "ring" | "coin";
}

interface Beam {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  life: number;
  max: number;
  color: string;
  width: number;
}

interface Boss {
  hp: number;
  max: number;
  x: number;
  y: number;
  targetY: number;
  charge: number;
  chargeMax: number;
  t: number;
  hitAt: number;
}

export interface BattleResult extends RunStats {
  section: SectionId;
  skills: SkillScore[];
  mistakes: Mistake[];
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function shuffle<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

const ROCK_TONES = [
  ["#8a6a5a", "#4a342c", "#ff9a4d"],
  ["#7d6e8f", "#3a2f4f", "#c084fc"],
  ["#6f7d8c", "#2f3a48", "#5ee7ff"],
  ["#8c7a5a", "#4a3d24", "#ffd23f"],
];

const POWER_STYLE: Record<PowerKind, { icon: typeof Snowflake; label: string; color: string; ring: string }> = {
  freeze: { icon: Snowflake, label: "FREEZE", color: "#5ee7ff", ring: "from-[#5ee7ff] to-[#3b82f6]" },
  nova: { icon: Bomb, label: "NOVA", color: "#ff7ad9", ring: "from-[#ff7ad9] to-[#a855f7]" },
  shield: { icon: ShieldPlus, label: "SHIELD", color: "#6bff8f", ring: "from-[#6bff8f] to-[#10b981]" },
};

function Mothership() {
  return (
    <svg viewBox="0 0 160 80" className="h-full w-full drop-shadow-[0_0_18px_rgba(255,60,120,0.55)]" aria-hidden>
      <defs>
        <linearGradient id="ms-body" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#6d28d9" />
          <stop offset="1" stopColor="#1e0b3d" />
        </linearGradient>
        <radialGradient id="ms-dome" cx="0.5" cy="0.7" r="0.6">
          <stop offset="0" stopColor="#ff3d7f" />
          <stop offset="1" stopColor="#5b0b2f" />
        </radialGradient>
      </defs>
      <ellipse cx="80" cy="30" rx="34" ry="24" fill="url(#ms-dome)" />
      <ellipse cx="80" cy="26" rx="10" ry="8" fill="#ffe6f0">
        <animate attributeName="ry" values="8;1;8" dur="3s" repeatCount="indefinite" />
      </ellipse>
      <circle cx="80" cy="26" r="4" fill="#1e0b3d" />
      <ellipse cx="80" cy="48" rx="78" ry="18" fill="url(#ms-body)" stroke="#c084fc" strokeWidth="2" />
      <path d="M14 56 L0 72 M146 56 L160 72 M50 62 L44 78 M110 62 L116 78" stroke="#c084fc" strokeWidth="4" strokeLinecap="round" />
      {[22, 46, 70, 94, 118, 140].map((x, i) => (
        <circle key={x} cx={x} cy="49" r="4" fill={i % 2 ? "#5ee7ff" : "#ffd23f"}>
          <animate attributeName="opacity" values="1;0.2;1" dur="1.2s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

function Turret({ fire }: { fire: boolean }) {
  return (
    <svg viewBox="0 0 60 80" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="tur-body" x1="0" x2="1">
          <stop offset="0" stopColor="#cbd5e1" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
      {fire && (
        <path d="M22 66 Q30 92 38 66 Z" fill="#ffb03a">
          <animate attributeName="d" values="M22 66 Q30 92 38 66 Z;M22 66 Q30 80 38 66 Z;M22 66 Q30 92 38 66 Z" dur="0.25s" repeatCount="indefinite" />
        </path>
      )}
      <path d="M30 2 C40 14 44 34 42 64 L18 64 C16 34 20 14 30 2 Z" fill="url(#tur-body)" stroke="#334155" strokeWidth="2" />
      <circle cx="30" cy="30" r="7" fill="#5ee7ff" stroke="#1e3a8a" strokeWidth="2" />
      <path d="M18 44 L4 64 L18 60 Z M42 44 L56 64 L42 60 Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" />
    </svg>
  );
}

interface Hud {
  level: number;
  score: number;
  stardust: number;
  shield: number;
  maxShield: number;
  combo: number;
  wave: number;
  waveCorrect: number;
  freeze: number;
  nova: number;
  bossHp: number;
  bossMax: number;
}

export function Battle({ section, onDone }: { section: SectionId; onDone: (r: BattleResult) => void }) {
  const reduce = useReducedMotion();
  const mission = sectionOf(section);
  const lvlOf = (wave: number) => levelForWave(section, wave);
  const { upgrades, laser: laserId } = useGalaxy.getState();
  const laser = LASERS.find((l) => l.id === laserId) ?? LASERS[0];
  const maxShield = 5 + upgrades.shield;

  const fieldRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const turretRef = useRef<HTMLDivElement>(null);
  const bossRef = useRef<HTMLDivElement>(null);
  const chargeRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const [, force] = useReducer((x: number) => x + 1, 0);

  const G = useRef({
    W: 360,
    H: 560,
    rocks: [] as Rock[],
    caps: [] as Capsule[],
    parts: [] as Particle[],
    beams: [] as Beam[],
    stars: [] as { x: number; y: number; z: number }[],
    boss: null as Boss | null,
    els: new Map<number, HTMLDivElement>(),
    capEls: new Map<number, HTMLDivElement>(),
    nextId: 1,
    qid: 0,
    problem: null as Question | null,
    shake: 0,
    freezeUntil: 0,
    warpUntil: 0,
    paused: true,
    over: false,
    last: 0,
    aim: 0,
  });
  const R = useRef({
    score: 0,
    stardust: 0,
    shield: maxShield,
    maxShield,
    combo: 0,
    bestCombo: 0,
    wave: 1,
    waveCorrect: 0,
    correct: 0,
    answered: 0,
    bosses: 0,
    powerups: 0,
    asteroids: 0,
    freeze: upgrades.cryo,
    nova: upgrades.nova,
    skills: new Map<string, SkillScore>(),
    mistakes: [] as Mistake[],
  });

  const snapshot = (): Hud => {
    const r = R.current;
    const b = G.current.boss;
    return {
      level: lvlOf(r.wave),
      score: r.score,
      stardust: r.stardust,
      shield: r.shield,
      maxShield: r.maxShield,
      combo: r.combo,
      wave: r.wave,
      waveCorrect: r.waveCorrect,
      freeze: r.freeze,
      nova: r.nova,
      bossHp: b?.hp ?? 0,
      bossMax: b?.max ?? 0,
    };
  };
  const [hud, setHud] = useState<Hud>(snapshot);
  const sync = () => setHud(snapshot());
  const [problem, setProblem] = useState<Question | null>(null);
  const [count, setCount] = useState(3);
  const [banner, setBanner] = useState<{ key: number; title: string; sub?: string; tone: "ok" | "boss" | "info" | "level" } | null>(null);
  const [pops, setPops] = useState<{ id: number; x: number; y: number; text: string; color: string }[]>([]);
  const [flash, setFlash] = useState(0);
  const [frozen, setFrozen] = useState(false);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const groundY = () => G.current.H - 74;
  const turretPos = () => ({ x: G.current.W / 2, y: G.current.H - 92 });
  const beamColor = () => (laser.color === "rainbow" ? `hsl(${(performance.now() / 4) % 360} 100% 65%)` : laser.color);

  // ---------- effects ----------
  const sparks = (x: number, y: number, color: string, n: number, speed = 220) => {
    const g = G.current;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(speed * 0.3, speed);
      g.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.4, 0.9), max: 0.9, size: rand(1.5, 4), color, kind: "spark" });
    }
  };
  const ring = (x: number, y: number, color: string, size = 1) => {
    G.current.parts.push({ x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 60 * size, color, kind: "ring" });
  };
  const coins = (x: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) {
      G.current.parts.push({ x, y, vx: rand(-120, 120), vy: rand(-160, -40), life: 1.4, max: 1.4, size: 3.5, color: "#ffd23f", kind: "coin" });
    }
  };
  const beam = (x1: number, y1: number, color = beamColor(), width = 5, from?: { x: number; y: number }) => {
    const t = from ?? turretPos();
    G.current.beams.push({ x0: t.x, y0: t.y, x1, y1, life: 0.22, max: 0.22, color, width });
    if (!from) G.current.aim = (Math.atan2(x1 - t.x, t.y - y1) * 180) / Math.PI;
  };
  const pop = (x: number, y: number, text: string, color = "#ffd23f") => {
    const id = G.current.nextId++;
    setPops((p) => [...p.slice(-5), { id, x, y, text, color }]);
    later(() => setPops((p) => p.filter((q) => q.id !== id)), 1000);
  };
  const shake = (n: number) => {
    if (!reduce) G.current.shake = Math.max(G.current.shake, n);
  };
  const tally = (right: boolean) => {
    const p = G.current.problem;
    if (!p) return;
    const r = R.current;
    r.answered++;
    const s = r.skills.get(p.skill) ?? { name: p.skill, right: 0, total: 0 };
    s.total++;
    if (right) s.right++;
    r.skills.set(p.skill, s);
  };
  const mistake = (given: string) => {
    const p = G.current.problem;
    if (p && !R.current.mistakes.some((m) => m.prompt === p.prompt)) {
      R.current.mistakes.push({ prompt: p.prompt, given, answer: p.answer, tip: p.tip });
    }
  };

  // ---------- game flow ----------
  const finishRun = useCallback(() => {
    const r = R.current;
    onDone({
      section,
      level: lvlOf(r.wave),
      score: r.score,
      correct: r.correct,
      answered: r.answered,
      wave: r.wave,
      bestCombo: r.bestCombo,
      bosses: r.bosses,
      powerups: r.powerups,
      asteroids: r.asteroids,
      stardust: r.stardust,
      skills: [...r.skills.values()],
      mistakes: r.mistakes.slice(0, 10),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDone, section]);

  const gameOver = () => {
    const g = G.current;
    if (g.over) return;
    g.over = true;
    g.paused = true;
    const { x } = turretPos();
    for (let i = 0; i < 5; i++) later(() => {
      sparks(x + rand(-120, 120), groundY() + rand(-10, 30), i % 2 ? "#ff5a3c" : "#ffd23f", 40, 320);
      ring(x + rand(-80, 80), groundY(), "#ff5a3c", 2);
      play("boom");
      shake(22);
    }, i * 220);
    for (const rk of g.rocks) if (!rk.dying) rk.dying = performance.now();
    force();
    setBanner({ key: Date.now(), title: "SHIELDS DOWN", sub: "Earth needs you. Try again!", tone: "boss" });
    later(finishRun, 2200);
  };

  const damage = (n: number) => {
    const r = R.current;
    r.shield = Math.max(0, r.shield - n);
    r.combo = 0;
    shake(16);
    setFlash((f) => f + 1);
    play("hit");
    sync();
    if (r.shield <= 0) gameOver();
  };

  const spawnCapsule = () => {
    const g = G.current;
    const r = R.current;
    const kinds: PowerKind[] = ["freeze", "nova", ...(r.shield < r.maxShield ? (["shield", "shield"] as PowerKind[]) : [])];
    g.caps.push({ id: g.nextId++, kind: kinds[Math.floor(Math.random() * kinds.length)], x: rand(40, g.W - 40), y: -30, vy: 62, t: 0 });
  };

  const ask = () => {
    const g = G.current;
    const r = R.current;
    if (g.over) return;
    const p = nextQuestion(section, lvlOf(r.wave), g.problem ?? undefined);
    g.problem = p;
    g.qid++;
    setProblem(p);
    const rad = clamp(g.W / 9, 34, 46);
    // Faster every wave; harder sums get a little extra time to work out.
    const fall = (Math.max(4.8, 9.8 - r.wave * 0.5) + (p.slow ?? 0)) * (isBossWave(r.wave) ? 1.2 : 1);
    const vy = (groundY() + rad) / fall;
    const lanes = shuffle([0, 1, 2, 3]);
    const laneW = g.W / 4;
    p.options.forEach((label, i) => {
      g.rocks.push({
        id: g.nextId++,
        qid: g.qid,
        label,
        correct: label === p.answer,
        // One lane each, staggered in height, so answers never overlap.
        x: clamp(laneW * (lanes[i] + 0.5) + rand(-laneW * 0.04, laneW * 0.04), rad + 4, g.W - rad - 4),
        y: -rad - ((i * 37) % 4) * rad * 0.55 - rand(0, 12),
        vx: rand(-3, 3),
        vy: vy * rand(0.94, 1.06),
        r: rad * rand(0.96, 1.08),
        rot: rand(0, 360),
        vr: rand(-50, 50),
        dying: 0,
        bad: false,
        hue: Math.floor(Math.random() * ROCK_TONES.length),
      });
    });
    if (r.wave >= 2 && g.caps.length === 0 && Math.random() < 0.2) spawnCapsule();
    force();
  };

  const clearRocks = () => {
    const now = performance.now();
    for (const rk of G.current.rocks) if (!rk.dying) rk.dying = now;
    force();
  };

  const startWave = () => {
    const g = G.current;
    const r = R.current;
    g.paused = false;
    if (isBossWave(r.wave)) {
      const max = 4 + r.wave / 2;
      g.boss = { hp: max, max, x: g.W / 2, y: -90, targetY: 118, charge: 0, chargeMax: Math.max(13, 22 - r.wave * 0.5), t: 0, hitAt: 0 };
    }
    sync();
    ask();
  };

  const waveClear = (bossDown = false) => {
    const g = G.current;
    const r = R.current;
    g.paused = true;
    clearRocks();
    const bonus = 50 * r.wave * lvlOf(r.wave);
    const dust = r.wave * 2;
    r.score += bonus;
    r.stardust += dust;
    sync();
    later(
      () => {
        setBanner({ key: Date.now(), title: `WAVE ${r.wave} CLEAR`, sub: `+${bonus} bonus · +${dust} stardust`, tone: "ok" });
        play("levelup");
      },
      bossDown ? 1400 : 300,
    );
    later(
      () => {
        const oldLevel = lvlOf(r.wave);
        r.wave++;
        r.waveCorrect = 0;
        g.warpUntil = performance.now() + 1300;
        play("warp");
        sync();
        const boss = isBossWave(r.wave);
        const lvl = lvlOf(r.wave);
        later(() => {
          if (lvl > oldLevel) {
            setBanner({ key: Date.now(), title: `LEVEL ${lvl}`, sub: levelLabel(section, lvl), tone: "level" });
            play("combo");
          } else {
            setBanner({ key: Date.now(), title: `WAVE ${r.wave}`, sub: lvl >= maxLevel(section) ? "Top level · faster asteroids!" : "Faster asteroids!", tone: "info" });
          }
        }, 900);
        if (boss) {
          later(() => {
            setBanner({ key: Date.now(), title: "⚠ MOTHERSHIP", sub: "Every right answer hits it. Destroy it before it charges!", tone: "boss" });
            play("hit");
          }, 2500);
        }
        later(startWave, boss ? 3900 : 2600);
      },
      bossDown ? 2600 : 1600,
    );
  };

  const hitBoss = (dmg: number) => {
    const g = G.current;
    const b = g.boss;
    if (!b) return;
    later(() => {
      if (!g.boss) return;
      beam(b.x, b.y + 20, "#ffffff", 8);
      b.hp = Math.max(0, b.hp - dmg);
      b.hitAt = performance.now();
      sparks(b.x + rand(-40, 40), b.y + 30, "#ff7ad9", 26, 260);
      ring(b.x, b.y + 30, "#ff7ad9");
      shake(8);
      play("boom");
      if (b.hp <= 0) {
        const r = R.current;
        for (let i = 0; i < 6; i++) later(() => {
          sparks(b.x + rand(-70, 70), b.y + rand(0, 50), ["#ffd23f", "#ff5a3c", "#ff7ad9", "#5ee7ff"][i % 4], 50, 380);
          ring(b.x + rand(-50, 50), b.y + 30, "#ffd23f", 2.4);
          play("boom");
          shake(24);
        }, i * 160);
        coins(b.x, b.y + 30, 24);
        r.bosses++;
        r.stardust += 40;
        r.score += 400 * lvlOf(r.wave);
        pop(b.x, b.y + 40, `+${400 * lvlOf(r.wave)}`, "#ff7ad9");
        later(() => {
          g.boss = null;
          burst(fieldRef.current, true);
          setBanner({ key: Date.now(), title: "MOTHERSHIP DOWN!", sub: "+40 stardust", tone: "ok" });
          sync();
        }, 1000);
        waveClear(true);
      } else {
        later(ask, 300);
      }
      sync();
    }, 140);
  };

  const shoot = (id: number, nova = false) => {
    const g = G.current;
    const r = R.current;
    const rock = g.rocks.find((x) => x.id === id);
    if (!rock || rock.dying || g.paused || g.over) return;
    const fire = r.combo >= FIRE_COMBO;
    beam(rock.x, rock.y, fire ? "#fff3b0" : beamColor(), fire ? 8 : 5);
    play("laser");

    if (rock.correct) {
      tally(true);
      const lvl = lvlOf(r.wave);
      const before = multiplierFor(r.combo);
      r.combo++;
      r.bestCombo = Math.max(r.bestCombo, r.combo);
      r.correct++;
      r.asteroids++;
      r.waveCorrect++;
      const mult = multiplierFor(r.combo);
      const speedBonus = Math.round(clamp(1 - rock.y / groundY(), 0, 1) * 10) * lvl;
      const pts = (10 * lvl + speedBonus) * mult;
      r.score += pts;
      const dust = r.combo >= FIRE_COMBO ? 2 : 1;
      r.stardust += dust;
      rock.dying = performance.now();
      const tone = ROCK_TONES[rock.hue][2];
      sparks(rock.x, rock.y, tone, 34);
      sparks(rock.x, rock.y, "#ffffff", 10, 140);
      ring(rock.x, rock.y, tone);
      coins(rock.x, rock.y, dust * 3);
      pop(rock.x, rock.y - rock.r, `+${pts}`);
      shake(5);
      later(() => play("boom"), 60);
      if (mult > before) {
        later(() => play("combo"), 120);
        pop(rock.x, rock.y - rock.r - 30, `×${mult} COMBO`, "#ff7ad9");
      }
      if (r.combo === FIRE_COMBO) {
        setBanner({ key: Date.now(), title: "ON FIRE!", sub: "Golden laser · double stardust", tone: "ok" });
        later(() => setBanner(null), 1300);
      }
      // The other answers to this question fizzle out.
      for (const o of g.rocks) {
        if (o.qid === rock.qid && !o.dying) {
          o.dying = performance.now();
          sparks(o.x, o.y, "#94a3b8", 8, 90);
        }
      }
      force();
      sync();
      if (g.boss) hitBoss(fire || nova ? 2 : 1);
      else if (r.waveCorrect >= WAVE_SIZE) waveClear();
      else later(ask, 380);
    } else {
      tally(false);
      mistake(rock.label);
      rock.dying = performance.now();
      rock.bad = true;
      sparks(rock.x, rock.y, "#ff3d3d", 22);
      pop(rock.x, rock.y - rock.r, "WRONG −1", "#ff6b6b");
      force();
      damage(1);
    }
  };

  const miss = (rock: Rock) => {
    const g = G.current;
    tally(false);
    mistake("Too slow: it hit Earth");
    rock.dying = performance.now();
    sparks(rock.x, groundY(), "#ff9a4d", 40, 300);
    ring(rock.x, groundY(), "#ff5a3c", 1.6);
    pop(rock.x, groundY() - 30, "IMPACT!", "#ff6b6b");
    for (const o of g.rocks) if (o.qid === rock.qid && !o.dying) o.dying = performance.now();
    force();
    damage(1);
    if (!g.over) later(ask, 650);
  };

  const collect = (id: number) => {
    const g = G.current;
    const r = R.current;
    const cap = g.caps.find((c) => c.id === id);
    if (!cap || g.over) return;
    g.caps = g.caps.filter((c) => c.id !== id);
    const st = POWER_STYLE[cap.kind];
    if (cap.kind === "shield") r.shield = Math.min(r.maxShield, r.shield + 1);
    else r[cap.kind] = Math.min(MAX_POWER, r[cap.kind] + 1);
    r.powerups++;
    sparks(cap.x, cap.y, st.color, 30, 200);
    ring(cap.x, cap.y, st.color, 1.3);
    pop(cap.x, cap.y - 20, `+${st.label}`, st.color);
    play("power");
    force();
    sync();
  };

  const fireFreeze = () => {
    const r = R.current;
    const g = G.current;
    if (r.freeze <= 0 || frozen || g.paused || g.over) return;
    r.freeze--;
    g.freezeUntil = performance.now() + 5000;
    setFrozen(true);
    later(() => setFrozen(false), 5000);
    ring(g.W / 2, g.H / 2, "#5ee7ff", 5);
    play("power");
    sync();
  };

  const fireNova = () => {
    const r = R.current;
    const g = G.current;
    if (r.nova <= 0 || g.paused || g.over) return;
    const target = g.rocks.find((x) => x.qid === g.qid && x.correct && !x.dying);
    if (!target) return;
    r.nova--;
    const t = turretPos();
    ring(t.x, t.y, "#ff7ad9", 6);
    play("power");
    shoot(target.id, true);
  };

  // ---------- size ----------
  useLayoutEffect(() => {
    const el = fieldRef.current;
    const cv = canvasRef.current;
    if (!el || !cv) return;
    const fit = () => {
      const g = G.current;
      g.W = el.clientWidth;
      g.H = el.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = g.W * dpr;
      cv.height = g.H * dpr;
      cv.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (g.stars.length === 0) {
        for (let i = 0; i < 120; i++) g.stars.push({ x: Math.random() * g.W, y: Math.random() * g.H, z: Math.random() });
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------- countdown ----------
  useEffect(() => {
    if (count < 0) return;
    play(count === 0 ? "warp" : "tick");
    if (count === 0) G.current.warpUntil = performance.now() + 900;
    const t = setTimeout(() => {
      if (count === 0) {
        setBanner({ key: Date.now(), title: "WAVE 1", sub: `${mission.name} · ${levelLabel(section, 1)}`, tone: "info" });
        setTimeout(startWave, 900);
      }
      setCount(count - 1);
    }, count === 0 ? 700 : 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), banner.tone === "boss" && G.current.over ? 3000 : 1700);
    return () => clearTimeout(t);
  }, [banner]);

  // ---------- frame loop ----------
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const frame = (t: number) => {
      const g = G.current;
      const dt = Math.min(0.05, (t - (g.last || t)) / 1000);
      g.last = t;
      const now = performance.now();
      const frozenNow = now < g.freezeUntil;
      const warp = now < g.warpUntil;
      const gy = g.H - 74;

      // Asteroids
      let removed = false;
      for (const rk of g.rocks) {
        if (!rk.dying) {
          if (!frozenNow && !g.paused) {
            rk.y += rk.vy * dt;
            rk.x += rk.vx * dt;
            rk.rot += rk.vr * dt;
          }
          if (rk.x < rk.r || rk.x > g.W - rk.r) rk.vx = -rk.vx;
          if (rk.correct && rk.y + rk.r * 0.5 >= gy && !g.over) miss(rk);
          else if (!rk.correct && rk.y > gy) {
            rk.dying = now;
            removed = true;
          }
        } else if (now - rk.dying > 360) removed = true;
        const el = g.els.get(rk.id);
        if (el) {
          el.style.transform = `translate(${rk.x - rk.r}px, ${rk.y - rk.r}px)`;
          (el.firstElementChild as HTMLElement | null)?.style.setProperty("transform", `rotate(${rk.rot}deg)`);
        }
      }
      if (removed) {
        g.rocks = g.rocks.filter((rk) => !rk.dying || now - rk.dying <= 360);
        force();
      }

      // Power-up capsules
      for (const c of g.caps) {
        c.t += dt;
        if (!frozenNow) c.y += c.vy * dt;
        const el = g.capEls.get(c.id);
        if (el) el.style.transform = `translate(${c.x - 26 + Math.sin(c.t * 2.5) * 18}px, ${c.y - 26}px)`;
      }
      if (g.caps.some((c) => c.y > g.H + 40)) {
        g.caps = g.caps.filter((c) => c.y <= g.H + 40);
        force();
      }

      // Mothership
      const b = g.boss;
      if (b) {
        b.t += dt;
        b.y += (b.targetY - b.y) * Math.min(1, dt * 1.6);
        b.x = g.W / 2 + Math.sin(b.t * 0.7) * g.W * 0.2;
        if (!frozenNow && !g.paused && !g.over && b.hp > 0) {
          b.charge += dt;
          if (b.charge >= b.chargeMax) {
            b.charge = 0;
            beam(g.W / 2 + rand(-60, 60), gy + 10, "#ff3d7f", 14, { x: b.x, y: b.y + 40 });
            sparks(g.W / 2, gy, "#ff3d7f", 50, 340);
            damage(2);
            setBanner({ key: Date.now(), title: "MOTHERSHIP FIRED!", sub: "−2 shields. Answer faster!", tone: "boss" });
          }
        }
        if (bossRef.current) {
          const hit = now - b.hitAt < 120;
          bossRef.current.style.transform = `translate(${b.x - 80}px, ${b.y - 30}px) ${hit ? "scale(1.06)" : ""}`;
          bossRef.current.style.filter = hit ? "brightness(2.2)" : "";
        }
        if (chargeRef.current) chargeRef.current.style.width = `${(b.charge / b.chargeMax) * 100}%`;
      }

      // Turret aim
      if (turretRef.current) turretRef.current.style.transform = `rotate(${clamp(g.aim, -70, 70)}deg)`;
      g.aim *= Math.pow(0.04, dt);

      // Canvas: stars, beams, particles
      ctx.clearRect(0, 0, g.W, g.H);
      for (const s of g.stars) {
        const v = (14 + s.z * 50) * (warp ? 16 : 1);
        if (!g.over) s.y += v * dt;
        if (s.y > g.H) {
          s.y = -4;
          s.x = Math.random() * g.W;
        }
        ctx.globalAlpha = 0.25 + s.z * 0.75;
        ctx.fillStyle = s.z > 0.85 ? "#bfe9ff" : "#ffffff";
        if (warp) ctx.fillRect(s.x, s.y - v * 0.05, 1.2, v * 0.05);
        else ctx.fillRect(s.x, s.y, s.z > 0.7 ? 2 : 1.2, s.z > 0.7 ? 2 : 1.2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "lighter";
      g.beams = g.beams.filter((bm) => (bm.life -= dt) > 0);
      for (const bm of g.beams) {
        const k = bm.life / bm.max;
        ctx.strokeStyle = bm.color;
        ctx.shadowColor = bm.color;
        ctx.shadowBlur = 22;
        ctx.lineCap = "round";
        ctx.lineWidth = bm.width * k + 1;
        ctx.beginPath();
        ctx.moveTo(bm.x0, bm.y0);
        ctx.lineTo(bm.x1, bm.y1);
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1, bm.width * 0.35 * k);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = bm.color;
        ctx.arc(bm.x1, bm.y1, 14 * k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      g.parts = g.parts.filter((p) => (p.life -= dt) > 0);
      for (const p of g.parts) {
        const k = p.life / p.max;
        if (p.kind === "ring") {
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * k + 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - k) + 6, 0, Math.PI * 2);
          ctx.stroke();
          continue;
        }
        if (p.kind === "coin") {
          // Stardust flies up to the counter in the top-right corner.
          const tx = g.W - 34;
          const ty = 22;
          if (p.max - p.life > 0.35) {
            p.vx += (tx - p.x) * dt * 9;
            p.vy += (ty - p.y) * dt * 9;
            p.vx *= 0.9;
            p.vy *= 0.9;
          }
          if (Math.hypot(tx - p.x, ty - p.y) < 14) p.life = 0;
        } else {
          p.vx *= 0.96;
          p.vy = p.vy * 0.96 + 40 * dt;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = p.kind === "coin" ? 1 : k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.kind === "coin" ? 1 : 0.5 + k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // Screen shake
      if (shakeRef.current) {
        g.shake *= Math.pow(0.002, dt);
        const s = g.shake > 0.3 ? g.shake : 0;
        shakeRef.current.style.transform = s ? `translate(${rand(-s, s)}px, ${rand(-s, s)}px)` : "";
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keys: 1–4 shoot the answers in screen order (left to right), F freeze, N nova.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = G.current;
      if (e.key === "f" || e.key === "F") fireFreeze();
      else if (e.key === "n" || e.key === "N") fireNova();
      else {
        const i = Number(e.key) - 1;
        const live = g.rocks.filter((x) => x.qid === g.qid && !x.dying).sort((a, b) => a.x - b.x);
        if (i >= 0 && live[i]) shoot(live[i].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const g = G.current;
  const mult = multiplierFor(hud.combo);
  const fire = hud.combo >= FIRE_COMBO;
  const boss = g.boss;

  return (
    <div className="mx-auto max-w-xl pb-8">
      <div ref={shakeRef} className="overflow-hidden rounded-[28px] border-2 border-[#2a2f6b] bg-[#060818] shadow-pop">
        {/* Battlefield */}
        <div
          ref={fieldRef}
          className="relative h-[max(420px,min(62dvh,600px))] touch-manipulation select-none overflow-hidden"
          style={{
            background:
              "radial-gradient(120% 60% at 20% 10%, rgba(124,58,237,0.35), transparent 60%), radial-gradient(90% 50% at 90% 30%, rgba(236,72,153,0.22), transparent 60%), radial-gradient(80% 40% at 50% 100%, rgba(14,165,233,0.25), transparent 70%), #060818",
          }}
        >
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

          {/* Earth */}
          <div className="pointer-events-none absolute left-1/2 top-[calc(100%-74px)] aspect-square w-[180%] -translate-x-1/2">
            <motion.div
              key={flash}
              initial={{ opacity: flash ? 1 : 0.85 }}
              animate={{ opacity: 0.25 + (hud.shield / hud.maxShield) * 0.6 }}
              transition={{ duration: 0.6 }}
              className="absolute -inset-[14px] rounded-full border-[3px]"
              style={{
                borderColor: hud.shield / hud.maxShield > 0.4 ? "#5ee7ff" : "#ff5a5a",
                boxShadow: `0 0 30px 6px ${hud.shield / hud.maxShield > 0.4 ? "rgba(94,231,255,0.45)" : "rgba(255,90,90,0.5)"}`,
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(ellipse 4% 1.6% at 36% 3%, #4ade80 60%, transparent 100%), radial-gradient(ellipse 2.5% 1.2% at 41% 5%, #34d399 60%, transparent 100%), radial-gradient(ellipse 5% 1.8% at 60% 4%, #4ade80 60%, transparent 100%), radial-gradient(ellipse 2% 1% at 66% 7%, #6ee7b7 60%, transparent 100%), radial-gradient(ellipse 3% 1.2% at 50% 9%, #34d399 60%, transparent 100%), radial-gradient(circle at 50% 0%, #38bdf8, #1d4ed8 30%, #0b1f5c 60%)",
                boxShadow: "0 -10px 60px 10px rgba(56,189,248,0.35)",
              }}
            />
          </div>

          {/* Turret */}
          <div className="pointer-events-none absolute left-1/2 top-[calc(100%-122px)] h-[60px] w-[46px] -translate-x-1/2">
            <div ref={turretRef} className="h-full w-full origin-[50%_80%]">
              <Turret fire={fire} />
            </div>
          </div>

          {/* Mothership */}
          {boss && (
            <div ref={bossRef} className="pointer-events-none absolute left-0 top-0 h-[80px] w-[160px]" style={{ transform: `translate(${boss.x - 80}px, ${boss.y - 30}px)` }}>
              <Mothership />
              <div className="absolute -bottom-3 left-4 right-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div ref={chargeRef} className="h-full rounded-full bg-gradient-to-r from-[#ff9a3c] to-[#ff3d7f]" />
              </div>
            </div>
          )}

          {/* Asteroids */}
          {g.rocks.map((rk) => {
            const [c1, c2, glow] = ROCK_TONES[rk.hue];
            return (
              <div
                key={rk.id}
                ref={(el) => {
                  if (el) g.els.set(rk.id, el);
                  else g.els.delete(rk.id);
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  shoot(rk.id);
                }}
                role="button"
                aria-label={`Answer ${rk.label.replace(/\$/g, "")}`}
                className={clsx("absolute left-0 top-0 grid cursor-crosshair place-items-center", rk.dying && "pointer-events-none")}
                style={{ width: rk.r * 2, height: rk.r * 2, transform: `translate(${rk.x - rk.r}px, ${rk.y - rk.r}px)` }}
              >
                <div
                  className="absolute inset-0 transition-[opacity,filter] duration-300"
                  style={{
                    borderRadius: "46% 54% 42% 58% / 52% 44% 56% 48%",
                    background: `radial-gradient(circle at 32% 28%, ${c1}, ${c2} 70%)`,
                    boxShadow: `inset -6px -8px 0 rgba(0,0,0,0.35), inset 4px 5px 0 rgba(255,255,255,0.12), 0 0 22px ${frozen ? "#5ee7ff" : glow}66`,
                    opacity: rk.dying ? 0 : 1,
                    filter: frozen ? "saturate(0.3) brightness(1.3) hue-rotate(160deg)" : rk.bad ? "brightness(1.6) sepia(1) hue-rotate(-40deg)" : undefined,
                  }}
                >
                  <span className="absolute left-[22%] top-[24%] size-[18%] rounded-full bg-black/25 shadow-[inset_1px_1px_0_rgba(255,255,255,0.15)]" />
                  <span className="absolute bottom-[22%] right-[20%] size-[24%] rounded-full bg-black/25 shadow-[inset_1px_1px_0_rgba(255,255,255,0.15)]" />
                  <span className="absolute bottom-[34%] left-[18%] size-[11%] rounded-full bg-black/25" />
                </div>
                <span
                  className="relative font-display text-[19px] font-extrabold text-white transition-opacity duration-200 [text-shadow:0_2px_3px_rgba(0,0,0,0.9)]"
                  style={{ opacity: rk.dying ? 0 : 1 }}
                >
                  <RichText text={rk.label} />
                </span>
              </div>
            );
          })}

          {/* Power-up capsules */}
          {g.caps.map((c) => {
            const st = POWER_STYLE[c.kind];
            return (
              <div
                key={c.id}
                ref={(el) => {
                  if (el) g.capEls.set(c.id, el);
                  else g.capEls.delete(c.id);
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  collect(c.id);
                }}
                role="button"
                aria-label={`Collect ${st.label}`}
                className="absolute left-0 top-0 size-[52px] cursor-pointer"
                style={{ transform: `translate(${c.x - 26}px, ${c.y - 26}px)` }}
              >
                <motion.div
                  animate={{ rotate: 360, scale: [1, 1.12, 1] }}
                  transition={{ rotate: { duration: 4, repeat: Infinity, ease: "linear" }, scale: { duration: 0.9, repeat: Infinity } }}
                  className={clsx("absolute inset-0 rounded-full bg-gradient-to-br p-[3px]", st.ring)}
                  style={{ boxShadow: `0 0 24px ${st.color}` }}
                >
                  <div className="grid h-full w-full place-items-center rounded-full bg-[#0b1030]">
                    <st.icon className="size-6" style={{ color: st.color }} />
                  </div>
                </motion.div>
              </div>
            );
          })}

          {/* Score pops */}
          {pops.map((p) => (
            <motion.span
              key={p.id}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], y: -60, scale: [0.5, 1.3, 1, 1] }}
              transition={{ duration: 0.95, ease: "easeOut" }}
              className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap font-display text-2xl font-extrabold [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]"
              style={{ left: p.x, top: p.y, color: p.color }}
            >
              {p.text}
            </motion.span>
          ))}

          {/* HUD */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-[#060818]/90 to-transparent px-3 pb-6 pt-3 text-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-0.5" aria-label={`${hud.shield} shields`}>
                {Array.from({ length: hud.maxShield }, (_, i) => (
                  <motion.span key={i} animate={i < hud.shield ? { scale: 1, opacity: 1 } : { scale: 0.75, opacity: 0.25 }}>
                    <Shield className={clsx("size-5", i < hud.shield ? "fill-[#5ee7ff] text-[#5ee7ff]" : "text-white")} />
                  </motion.span>
                ))}
              </div>
              <div className="flex items-center gap-3 font-display font-extrabold tabular-nums">
                <motion.span key={hud.score} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="flex items-center gap-1 text-lg">
                  <Zap className="size-4 fill-[#ffd23f] text-[#ffd23f]" />
                  {hud.score}
                </motion.span>
                <motion.span key={`d${hud.stardust}`} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="flex items-center gap-1 text-[#ffd23f]">
                  <Gem className="size-4" />
                  {hud.stardust}
                </motion.span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 font-display text-xs font-extrabold tracking-wider backdrop-blur">
                WAVE {hud.wave}
                {isBossWave(hud.wave) && <span className="text-[#ff7ad9]"> · BOSS</span>}
              </span>
              <motion.span
                key={`lvl${hud.level}`}
                initial={{ scale: 1.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 12 }}
                title={levelLabel(section, hud.level)}
                className="shrink-0 rounded-full px-2 py-0.5 font-display text-xs font-extrabold text-[#0b1030]"
                style={{ background: mission.color }}
              >
                {mission.symbol} L{hud.level}
              </motion.span>
              {boss ? (
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-[#ff3d7f] to-[#c026d3]" animate={{ width: `${(hud.bossHp / Math.max(1, hud.bossMax)) * 100}%` }} />
                </div>
              ) : (
                <div className="flex flex-1 gap-1">
                  {Array.from({ length: WAVE_SIZE }, (_, i) => (
                    <span key={i} className={clsx("h-1.5 flex-1 rounded-full transition-colors", i < hud.waveCorrect ? "bg-[#6bff8f]" : "bg-white/15")} />
                  ))}
                </div>
              )}
              <motion.span
                key={mult}
                initial={{ scale: mult > 1 ? 1.7 : 1 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className={clsx(
                  "flex items-center gap-1 rounded-full px-2.5 py-0.5 font-display text-xs font-extrabold",
                  fire ? "bg-gradient-to-r from-[#ff9a3c] to-[#ff3d7f]" : mult > 1 ? "bg-[#ff7ad9]/30" : "bg-white/10",
                )}
              >
                <Flame className={clsx("size-3.5", hud.combo > 0 && "fill-current")} />
                {hud.combo}
                {mult > 1 && ` ×${mult}`}
              </motion.span>
            </div>
          </div>

          {/* Frozen tint */}
          <AnimatePresence>
            {frozen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 border-4 border-[#5ee7ff]/60 bg-[#5ee7ff]/10"
              />
            )}
          </AnimatePresence>

          {/* Damage flash */}
          <AnimatePresence>
            {flash > 0 && (
              <motion.div
                key={flash}
                initial={{ opacity: 0.7 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="pointer-events-none absolute inset-0"
                style={{ boxShadow: "inset 0 0 90px 30px rgba(255,40,40,0.75)" }}
              />
            )}
          </AnimatePresence>

          {/* Countdown */}
          <AnimatePresence>
            {count >= 0 && (
              <motion.div key={count} className="pointer-events-none absolute inset-0 grid place-items-center">
                <motion.span
                  initial={{ scale: 3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.3, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16 }}
                  className="bg-gradient-to-b from-white to-[#a78bfa] bg-clip-text font-display text-8xl font-extrabold text-transparent"
                >
                  {count === 0 ? "LAUNCH!" : count}
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Banner */}
          <AnimatePresence>
            {banner && (
              <motion.div
                key={banner.key}
                initial={{ opacity: 0, scale: 0.4, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.4 }}
                transition={{ type: "spring", stiffness: 280, damping: 16 }}
                className="pointer-events-none absolute inset-x-4 top-[34%] text-center"
              >
                <p
                  className={clsx(
                    "font-display text-5xl font-extrabold tracking-tight [text-shadow:0_4px_24px_rgba(0,0,0,0.6)]",
                    banner.tone === "boss" ? "text-[#ff5a7a]" : banner.tone === "ok" ? "text-[#6bff8f]" : banner.tone === "level" ? "text-[#ffd23f]" : "text-white",
                  )}
                >
                  {banner.title}
                </p>
                {banner.tone === "level" && (
                  <motion.span
                    className="mx-auto mb-2 flex w-fit items-center gap-1 rounded-full bg-[#ffd23f] px-3 py-1 font-display text-xs font-extrabold tracking-widest text-[#0b1030]"
                    initial={{ y: 16, opacity: 0, scale: 0.6 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 380, damping: 14 }}
                  >
                    <ChevronsUp className="size-4" /> HARDER QUESTIONS
                  </motion.span>
                )}
                {banner.sub && <p className="mt-1 font-display text-lg font-bold text-white/85">{banner.sub}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Question bar */}
        <div className="flex items-stretch gap-2 border-t-2 border-[#2a2f6b] bg-gradient-to-b from-[#0d1238] to-[#080b24] p-3 text-white">
          <PowerButton label="Freeze (F)" icon={Snowflake} color="#5ee7ff" n={hud.freeze} active={frozen} onClick={fireFreeze} />
          <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border-2 border-white/10 bg-white/5 px-3 py-2 text-center">
            <AnimatePresence mode="popLayout">
              {problem ? (
                <motion.div key={problem.prompt + g.qid} initial={{ y: 26, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -26, opacity: 0 }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a78bfa]">{problem.skill} · shoot the answer</p>
                  <RichText text={problem.prompt} className="mt-0.5 block font-display text-2xl font-extrabold sm:text-3xl" />
                </motion.div>
              ) : (
                <p className="py-3 font-display font-bold text-white/60">Get ready…</p>
              )}
            </AnimatePresence>
          </div>
          <PowerButton label="Nova (N)" icon={Bomb} color="#ff7ad9" n={hud.nova} onClick={fireNova} />
        </div>
      </div>
      <p className="mt-2 text-center text-xs font-semibold text-muted">
        Tap an asteroid to fire. Keyboard: 1–4 shoot left to right · F freeze · N nova
      </p>
    </div>
  );
}

function PowerButton({ label, icon: Icon, color, n, active, onClick }: { label: string; icon: typeof Snowflake; color: string; n: number; active?: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={n === 0}
      whileTap={{ scale: 0.88 }}
      animate={n > 0 && !active ? { boxShadow: [`0 0 0px ${color}00`, `0 0 18px ${color}`, `0 0 0px ${color}00`] } : {}}
      transition={{ duration: 1.6, repeat: Infinity }}
      className="relative grid w-16 shrink-0 place-items-center rounded-2xl border-2 bg-white/5 disabled:opacity-30"
      style={{ borderColor: n > 0 ? color : "rgba(255,255,255,0.1)" }}
    >
      <Icon className="size-7" style={{ color }} />
      <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full font-display text-xs font-extrabold text-[#0b1030]" style={{ background: color }}>
        {n}
      </span>
    </motion.button>
  );
}
