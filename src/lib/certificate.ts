/**
 * Draws the certificate of achievement for a passed quiz (2000x1414, A4
 * landscape) in the browser, in the wording and colours the quiz's admin set
 * (src/content/certificate.ts). The code on it can be checked with
 * GET /api/certificates?id=<code>.
 */
import type { Certificate } from "../content/api";
import type { CertificateFormat } from "../content/certificate";
import { region } from "../config/regions";

const W = 2000;
const H = 1414;
const INK = "#1b1e3a";
const MUTED = "#5d6180";
const BRAND = "#ff8a1f";
const PAPER = "#fffaf0";
const DISPLAY = '"Bricolage Grotesque", system-ui, sans-serif';
const SANS = '"Plus Jakarta Sans", system-ui, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

/** Border and seal colours: the main one and its light partner. */
export const THEME_COLORS: Record<CertificateFormat["theme"], { main: string; light: string }> = {
  gold: { main: "#c8962a", light: "#f2d48a" },
  blue: { main: "#2f6fd6", light: "#a9c8f5" },
  green: { main: "#1f9d63", light: "#a6e3c4" },
  purple: { main: "#7b3fbf", light: "#d3b6f2" },
};

/** Largest font size (down to `min`) at which `text` fits in `maxWidth`. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, max: number, min: number, maxWidth: number) {
  let px = max;
  for (; px > min; px -= 2) {
    ctx.font = font(px);
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  ctx.font = font(px);
}

function border(ctx: CanvasRenderingContext2D, main: string, light: string) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  // Soft corner glows.
  for (const [x, y, c] of [[0, 0, "rgba(255,138,31,0.10)"], [W, H, "rgba(91,94,240,0.08)"]] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 900);
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.strokeStyle = main;
  ctx.lineWidth = 14;
  ctx.strokeRect(50, 50, W - 100, H - 100);
  ctx.strokeStyle = light;
  ctx.lineWidth = 4;
  ctx.strokeRect(80, 80, W - 160, H - 160);
  // Corner diamonds.
  ctx.fillStyle = main;
  for (const [x, y] of [[80, 80], [W - 80, 80], [80, H - 80], [W - 80, H - 80]]) {
    ctx.beginPath();
    ctx.moveTo(x, y - 26);
    ctx.lineTo(x + 26, y);
    ctx.lineTo(x, y + 26);
    ctx.lineTo(x - 26, y);
    ctx.closePath();
    ctx.fill();
  }
}

/** The seal: the score, or "PASSED" with a star when the score is hidden. */
function seal(ctx: CanvasRenderingContext2D, cx: number, cy: number, main: string, light: string, percent: number | null) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = main;
  ctx.beginPath();
  for (let i = 0; i < 48; i++) {
    const r = i % 2 ? 132 : 150;
    const a = (i / 48) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, -115, 0, 115);
  g.addColorStop(0, light);
  g.addColorStop(1, main);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 115, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 99, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (percent === null) {
    ctx.font = `800 72px ${DISPLAY}`;
    ctx.fillText("★", 0, -14);
    ctx.font = `800 24px ${SANS}`;
    ctx.fillText("PASSED", 0, 46);
  } else {
    ctx.font = `800 68px ${DISPLAY}`;
    ctx.fillText(`${percent}%`, 0, -8);
    ctx.font = `800 22px ${SANS}`;
    ctx.fillText("SCORE", 0, 46);
  }
  ctx.restore();
}

/** A value over a line with a small label under it (date, signature, certificate number). */
function signedLine(ctx: CanvasRenderingContext2D, x: number, value: string, valueFont: string, label: string) {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = valueFont;
  ctx.fillText(value, x, 1100, 460);
  ctx.strokeStyle = "rgba(27,30,58,0.25)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 230, 1125);
  ctx.lineTo(x + 230, 1125);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = `700 28px ${SANS}`;
  ctx.fillText(label.toUpperCase(), x, 1170, 460);
}

export async function renderCertificate(c: Certificate): Promise<Blob> {
  const f = c.format;
  const { main, light } = THEME_COLORS[f.theme];
  await Promise.all([
    document.fonts.load(`800 100px "Bricolage Grotesque"`),
    document.fonts.load(`700 40px "Plus Jakarta Sans"`),
    document.fonts.load(`800 40px "Plus Jakarta Sans"`),
  ]).catch(() => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  border(ctx, main, light);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // App name with its tick mark.
  ctx.fillStyle = BRAND;
  ctx.font = `800 44px ${DISPLAY}`;
  ctx.fillText(`✓ ${region.appName}`, W / 2, 210);

  ctx.fillStyle = INK;
  fit(ctx, f.heading, (px) => `800 ${px}px ${DISPLAY}`, 104, 56, W - 360);
  ctx.fillText(f.heading, W / 2, 350);
  ctx.fillStyle = main;
  ctx.fillRect(W / 2 - 180, 385, 360, 6);

  ctx.fillStyle = MUTED;
  fit(ctx, f.presentedTo, (px) => `600 ${px}px ${SANS}`, 40, 26, W - 500);
  ctx.fillText(f.presentedTo, W / 2, 480);

  ctx.fillStyle = INK;
  fit(ctx, c.name, (px) => `italic 700 ${px}px ${SERIF}`, 120, 60, W - 400);
  ctx.fillText(c.name, W / 2, 630);
  ctx.strokeStyle = "rgba(27,30,58,0.25)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 520, 670);
  ctx.lineTo(W / 2 + 520, 670);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  fit(ctx, f.reason, (px) => `600 ${px}px ${SANS}`, 40, 26, W - 500);
  ctx.fillText(f.reason, W / 2, 755);
  const title = f.title || c.quizTitle;
  ctx.fillStyle = INK;
  fit(ctx, title, (px) => `800 ${px}px ${DISPLAY}`, 72, 40, W - 500);
  ctx.fillText(title, W / 2, 840);
  if (f.note) {
    ctx.fillStyle = MUTED;
    fit(ctx, f.note, (px) => `600 ${px}px ${SANS}`, 32, 22, W - 600);
    ctx.fillText(f.note, W / 2, 895);
  }

  seal(ctx, W / 2, 1095, main, light, f.showScore ? c.percent : null);

  const date = new Date(c.issuedAt).toLocaleDateString(region.locale, { day: "numeric", month: "long", year: "numeric" });
  signedLine(ctx, 440, date, `800 40px ${SANS}`, "Date");
  if (f.signName) {
    signedLine(ctx, W - 440, f.signName, `italic 700 48px ${SERIF}`, f.signTitle || "Signature");
    // The code moves under the seal to make room for the signature.
    ctx.fillStyle = MUTED;
    ctx.font = `700 26px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText(`CERTIFICATE NO. ${c.id}`, W / 2, 1300);
  } else {
    signedLine(ctx, W - 440, c.id, `800 40px ${SANS}`, "Certificate no.");
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the certificate"))), "image/png"));
}
