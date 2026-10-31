/**
 * Draws the share picture (1080x1350, the 4:5 shape that fills a phone
 * screen in WhatsApp chats, Status and Instagram) in the browser.
 */
import { formatTime } from "./subjects";

export type CardData =
  | {
      kind: "round";
      name: string;
      title: string;
      accuracy: number;
      marks: number;
      maxMarks: number;
      xp: number;
      streak: number;
      timeMs: number;
      questions: number;
      url: string;
    }
  | { kind: "rank"; name: string; rank: number; participants: number; periodLabel: string; xp: number; url: string }
  | {
      kind: "game";
      name: string;
      gameTitle: string;
      sectionName: string;
      symbol: string;
      score?: { points: number; level: number; wave: number; correct: number };
      rank?: { rank: number; participants: number; periodLabel: string; points: number };
      url: string;
    };

const W = 1080;
const H = 1350;
const NAVY = "#12152e";
const NAVY_2 = "#1f2450";
const CREAM = "#f7f5f0";
const MUTED = "rgba(247,245,240,0.62)";
const BRAND = "#ff8a1f";
const GOLD = "#ffc53d";
const OK = "#2fd389";
const DISPLAY = '"Bricolage Grotesque", system-ui, sans-serif';
const SANS = '"Plus Jakarta Sans", system-ui, sans-serif';

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Largest font size (down to `min`) at which `text` fits in `maxWidth`. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, family: string, size: number, maxWidth: number, min = 24) {
  for (; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  return size;
}

/** Splits text into at most `max` lines that fit `maxWidth` (last line gets "…"). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    lines.length = max;
    let last = lines[max - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1) last = last.slice(0, -1);
    lines[max - 1] = `${last}…`;
  }
  return lines;
}

function background(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, NAVY_2);
  g.addColorStop(1, NAVY);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Glow behind the centrepiece.
  const glow = ctx.createRadialGradient(W / 2, 560, 40, W / 2, 560, 560);
  glow.addColorStop(0, "rgba(255,138,31,0.28)");
  glow.addColorStop(1, "rgba(255,138,31,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // Dot grid, like the app's paper background.
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let y = 24; y < H; y += 36) for (let x = 24; x < W; x += 36) ctx.fillRect(x, y, 3, 3);
  // Floating maths glyphs.
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.font = `800 150px ${DISPLAY}`;
  for (const [c, x, y] of [["∑", 60, 330], ["π", 900, 300], ["√", 70, 1010], ["∫", 930, 960], ["Δ", 860, 640]] as const) {
    ctx.fillText(c, x, y);
  }
}

function header(ctx: CanvasRenderingContext2D) {
  rounded(ctx, 72, 64, 84, 84, 22);
  ctx.fillStyle = CREAM;
  ctx.fill();
  ctx.strokeStyle = BRAND;
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(94, 108);
  ctx.lineTo(110, 124);
  ctx.lineTo(136, 92);
  ctx.stroke();
  ctx.fillStyle = CREAM;
  ctx.font = `800 54px ${DISPLAY}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Vijayeemantra", 180, 108);
  ctx.font = `600 30px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "right";
  ctx.fillText("CBSE practice", W - 72, 108);
}

function pill(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, bg: string, fg: string) {
  ctx.font = `800 30px ${SANS}`;
  const w = ctx.measureText(text).width + 56;
  rounded(ctx, cx - w / 2, y, w, 58, 29);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, y + 30);
}

function footer(ctx: CanvasRenderingContext2D, cta: string, url: string) {
  const y = H - 250;
  rounded(ctx, 72, y, W - 144, 178, 36);
  const g = ctx.createLinearGradient(72, y, W - 72, y + 178);
  g.addColorStop(0, BRAND);
  g.addColorStop(1, GOLD);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = NAVY;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fit(ctx, cta, 800, DISPLAY, 54, W - 220);
  ctx.fillText(cta, W / 2, y + 66);
  ctx.font = `700 32px ${SANS}`;
  ctx.fillText(url.replace(/^https?:\/\//, ""), W / 2, y + 128);
}

function stats(ctx: CanvasRenderingContext2D, items: [string, string][], y: number) {
  const gap = 20;
  const w = (W - 144 - gap * (items.length - 1)) / items.length;
  items.forEach(([label, value], i) => {
    const x = 72 + i * (w + gap);
    rounded(ctx, x, y, w, 150, 28);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = CREAM;
    fit(ctx, value, 800, DISPLAY, 56, w - 24);
    ctx.fillText(value, x + w / 2, y + 62);
    ctx.fillStyle = MUTED;
    ctx.font = `700 24px ${SANS}`;
    ctx.fillText(label.toUpperCase(), x + w / 2, y + 114);
  });
}

function drawRound(ctx: CanvasRenderingContext2D, d: Extract<CardData, { kind: "round" }>) {
  pill(ctx, "⚡ CHALLENGE", W / 2, 196, BRAND, NAVY);
  ctx.fillStyle = CREAM;
  ctx.textAlign = "center";
  fit(ctx, `${d.name} scored`, 700, SANS, 46, W - 200);
  ctx.fillText(`${d.name} scored`, W / 2, 318);

  // Score ring.
  const cx = W / 2;
  const cy = 560;
  const r = 190;
  ctx.lineWidth = 40;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const arc = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  arc.addColorStop(0, GOLD);
  arc.addColorStop(1, BRAND);
  ctx.strokeStyle = arc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.max(0.02, d.accuracy / 100) * Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = CREAM;
  ctx.font = `800 150px ${DISPLAY}`;
  ctx.textBaseline = "middle";
  ctx.fillText(`${d.accuracy}%`, cx, cy + 6);

  ctx.font = `800 52px ${DISPLAY}`;
  const lines = wrap(ctx, d.title, W - 200, 2);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 830 + i * 62));

  stats(
    ctx,
    [
      ["Marks", `${d.marks}/${d.maxMarks}`],
      ["XP", `+${d.xp}`],
      ["Streak", `${d.streak}🔥`],
      ["Time", formatTime(d.timeMs)],
    ],
    lines.length > 1 ? 920 : 890,
  );
  footer(ctx, `Can you beat me? Same ${d.questions} questions 👉`, d.url);
}

function crown(ctx: CanvasRenderingContext2D, cx: number, y: number) {
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(cx - 90, y + 80);
  ctx.lineTo(cx - 100, y);
  ctx.lineTo(cx - 45, y + 40);
  ctx.lineTo(cx, y - 20);
  ctx.lineTo(cx + 45, y + 40);
  ctx.lineTo(cx + 100, y);
  ctx.lineTo(cx + 90, y + 80);
  ctx.closePath();
  ctx.fill();
}

function drawRank(ctx: CanvasRenderingContext2D, d: Extract<CardData, { kind: "rank" }>) {
  pill(ctx, "🏆 LEADERBOARD", W / 2, 196, BRAND, NAVY);
  ctx.fillStyle = CREAM;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fit(ctx, `${d.name} is`, 700, SANS, 46, W - 200);
  ctx.fillText(`${d.name} is`, W / 2, 318);
  if (d.rank <= 3) crown(ctx, W / 2, 370);

  const g = ctx.createLinearGradient(0, 450, 0, 740);
  g.addColorStop(0, GOLD);
  g.addColorStop(1, BRAND);
  ctx.fillStyle = g;
  fit(ctx, `#${d.rank}`, 800, DISPLAY, 300, W - 200, 120);
  ctx.fillText(`#${d.rank}`, W / 2, 600);

  ctx.fillStyle = CREAM;
  ctx.font = `700 46px ${SANS}`;
  ctx.fillText(`of ${d.participants} students ${d.periodLabel}`, W / 2, 775);
  const top = Math.max(1, Math.ceil((d.rank / Math.max(1, d.participants)) * 100));
  pill(ctx, `TOP ${top}%`, W / 2, 818, OK, NAVY);

  stats(ctx, [["XP earned", d.xp.toLocaleString("en-IN")]], 910);
  footer(ctx, "Think you can beat me? 👉", d.url);
}

/** Deep space: stars, a glowing planet and a ringed one. */
function spaceBackground(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#1a0b3d");
  g.addColorStop(0.55, "#0b1030");
  g.addColorStop(1, "#060818");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, c] of [[880, 260, 520, "rgba(192,38,211,0.30)"], [160, 1050, 480, "rgba(56,189,248,0.22)"], [W / 2, 600, 420, "rgba(167,139,250,0.22)"]] as const) {
    const glow = ctx.createRadialGradient(x, y, 10, x, y, r);
    glow.addColorStop(0, c);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let i = 0; i < 170; i++) {
    const big = rand() > 0.88;
    ctx.globalAlpha = 0.35 + rand() * 0.65;
    ctx.fillStyle = big ? "#bfe9ff" : "#ffffff";
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H, big ? 3 : 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Ringed planet, top right.
  const pg = ctx.createRadialGradient(930, 360, 10, 950, 380, 90);
  pg.addColorStop(0, "#ffd23f");
  pg.addColorStop(1, "#ff7ad9");
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.arc(950, 380, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(950, 380, 120, 26, -0.35, 0, Math.PI * 2);
  ctx.stroke();
  // Earth peeking in, bottom left.
  const eg = ctx.createRadialGradient(90, 980, 10, 60, 1010, 170);
  eg.addColorStop(0, "#38bdf8");
  eg.addColorStop(0.6, "#1d4ed8");
  eg.addColorStop(1, "#0b1f5c");
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(60, 1010, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4ade80";
  ctx.beginPath();
  ctx.ellipse(110, 940, 40, 22, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function rocket(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(0.5);
  ctx.fillStyle = "#ffb03a";
  ctx.beginPath();
  ctx.moveTo(-14, 60);
  ctx.quadraticCurveTo(0, 110, 14, 60);
  ctx.fill();
  ctx.fillStyle = "#f1f5f9";
  ctx.beginPath();
  ctx.moveTo(0, -60);
  ctx.bezierCurveTo(22, -36, 26, 0, 24, 60);
  ctx.lineTo(-24, 60);
  ctx.bezierCurveTo(-26, 0, -22, -36, 0, -60);
  ctx.fill();
  ctx.fillStyle = "#5ee7ff";
  ctx.beginPath();
  ctx.arc(0, -12, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(-24, 20);
  ctx.lineTo(-50, 64);
  ctx.lineTo(-24, 56);
  ctx.moveTo(24, 20);
  ctx.lineTo(50, 64);
  ctx.lineTo(24, 56);
  ctx.fill();
  ctx.restore();
}

function drawGame(ctx: CanvasRenderingContext2D, d: Extract<CardData, { kind: "game" }>) {
  pill(ctx, `🚀 ${d.gameTitle.toUpperCase()}`, W / 2, 196, "#c084fc", NAVY);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const mission = `${d.symbol}  ${d.sectionName}${d.sectionName === "Overall" ? "" : " mission"}`;
  const gold = (y0: number, y1: number) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, GOLD);
    g.addColorStop(1, "#ff7ad9");
    return g;
  };

  if (d.rank) {
    ctx.fillStyle = CREAM;
    fit(ctx, `${d.name} is`, 700, SANS, 46, W - 200);
    ctx.fillText(`${d.name} is`, W / 2, 318);
    if (d.rank.rank <= 3) crown(ctx, W / 2, 370);
    ctx.fillStyle = gold(450, 740);
    fit(ctx, `#${d.rank.rank}`, 800, DISPLAY, 300, W - 200, 120);
    ctx.fillText(`#${d.rank.rank}`, W / 2, 600);
    ctx.fillStyle = CREAM;
    ctx.font = `700 44px ${SANS}`;
    ctx.fillText(`of ${d.rank.participants} pilots ${d.rank.periodLabel}`, W / 2, 770);
    pill(ctx, mission, W / 2, 812, "rgba(255,255,255,0.14)", CREAM);
    stats(ctx, [["Points", d.rank.points.toLocaleString("en-IN")]], 910);
    footer(ctx, "Think you can beat me? 👉", d.url);
    return;
  }

  if (d.score) {
    ctx.fillStyle = CREAM;
    fit(ctx, `${d.name} scored`, 700, SANS, 46, W - 200);
    ctx.fillText(`${d.name} scored`, W / 2, 318);
    rocket(ctx, 150, 560, 1.15);
    ctx.fillStyle = gold(420, 680);
    const pts = d.score.points.toLocaleString("en-IN");
    fit(ctx, pts, 800, DISPLAY, 230, W - 360, 100);
    ctx.fillText(pts, W / 2 + 40, 545);
    ctx.fillStyle = MUTED;
    ctx.font = `800 40px ${SANS}`;
    ctx.fillText("POINTS", W / 2 + 40, 680);
    pill(ctx, mission, W / 2, 740, "rgba(255,255,255,0.14)", CREAM);
    stats(
      ctx,
      [
        ["Level", `${d.score.level}`],
        ["Wave", `${d.score.wave}`],
        ["Correct", `${d.score.correct}`],
      ],
      870,
    );
    footer(ctx, "Can you beat my score? 👉", d.url);
    return;
  }

  // Invite.
  rocket(ctx, W / 2, 470, 2.2);
  ctx.fillStyle = CREAM;
  fit(ctx, "Save Earth with maths!", 800, DISPLAY, 84, W - 160);
  ctx.fillText("Save Earth with maths!", W / 2, 700);
  ctx.fillStyle = MUTED;
  ctx.font = `700 38px ${SANS}`;
  ctx.fillText("Blast the asteroid with the right answer", W / 2, 775);
  const glyphs = ["+", "−", "×", "÷", "%", "½", "x²", "aⁿ"];
  const gw = 104;
  const x0 = W / 2 - ((glyphs.length - 1) * (gw + 12)) / 2;
  glyphs.forEach((t, i) => {
    const x = x0 + i * (gw + 12);
    rounded(ctx, x - gw / 2, 840, gw, gw, 28);
    ctx.fillStyle = ["#6bff8f", "#5ee7ff", "#ffd23f", "#ff9a3c", "#38bdf8", "#a3e635", "#ff7ad9", "#facc15"][i];
    ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.font = `800 52px ${DISPLAY}`;
    ctx.fillText(t, x, 892);
  });
  footer(ctx, `${d.name === "I" ? "Come" : `${d.name} says: come`} play with me! 👉`, d.url);
}

/** Renders the card and returns it as a PNG. */
export async function renderShareCard(data: CardData): Promise<Blob> {
  await Promise.all([
    document.fonts.load(`800 100px "Bricolage Grotesque"`),
    document.fonts.load(`700 40px "Plus Jakarta Sans"`),
    document.fonts.load(`800 40px "Plus Jakarta Sans"`),
  ]).catch(() => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  if (data.kind === "game") spaceBackground(ctx);
  else background(ctx);
  header(ctx);
  if (data.kind === "round") drawRound(ctx, data);
  else if (data.kind === "rank") drawRank(ctx, data);
  else drawGame(ctx, data);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw card"))), "image/png"));
}
