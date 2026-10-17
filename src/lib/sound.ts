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

export function play(kind: "tap" | "correct" | "wrong" | "finish") {
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
  }
}
