import { useProfile } from "../store/profile";

/** Tiny synthesized sound effects — no audio files to download. */
let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain = 0.12) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.02);
}

/** A tone that slides from one pitch to another (lasers, explosions). */
function sweep(f0: number, f1: number, start: number, dur: number, type: OscillatorType, gain: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const t = ctx.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function play(kind: "tap" | "correct" | "wrong" | "finish" | "combo" | "tick" | "levelup" | "laser" | "boom" | "power" | "hit" | "warp") {
  if (!useProfile.getState().soundOn) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    return;
  }
  switch (kind) {
    case "tap":
      tone(660, 0, 0.06, "triangle", 0.05);
      break;
    case "correct":
      tone(784, 0, 0.12, "triangle");
      tone(1175, 0.09, 0.2, "triangle");
      break;
    case "wrong":
      tone(220, 0, 0.18, "sawtooth", 0.06);
      tone(196, 0.12, 0.22, "sawtooth", 0.05);
      break;
    case "finish":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.25, "triangle", 0.1));
      break;
    case "combo":
      [880, 1109, 1319].forEach((f, i) => tone(f, i * 0.05, 0.12, "square", 0.04));
      break;
    case "tick":
      tone(1200, 0, 0.03, "square", 0.03);
      break;
    case "levelup":
      [659, 784, 988, 1319].forEach((f, i) => tone(f, i * 0.07, 0.18, "triangle", 0.09));
      break;
    case "laser":
      sweep(1800, 260, 0, 0.16, "sawtooth", 0.035);
      break;
    case "boom":
      sweep(220, 38, 0, 0.42, "sawtooth", 0.07);
      sweep(120, 30, 0.02, 0.5, "square", 0.04);
      break;
    case "power":
      [523, 784, 1047, 1568].forEach((f, i) => tone(f, i * 0.05, 0.14, "triangle", 0.08));
      break;
    case "hit":
      sweep(320, 50, 0, 0.5, "square", 0.08);
      break;
    case "warp":
      sweep(120, 1600, 0, 0.9, "sine", 0.06);
      break;
  }
}
