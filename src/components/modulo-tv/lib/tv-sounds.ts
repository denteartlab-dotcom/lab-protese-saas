"use client";

let audioCtx: AudioContext | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function beep(freq: number, duration: number, gain = 0.08) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start();
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.stop(ctx.currentTime + duration);
}

export type TvSoundType = "nova" | "movida" | "alerta";

export function playTvSound(tipo: TvSoundType) {
  switch (tipo) {
    case "nova":
      beep(880, 0.12, 0.1);
      window.setTimeout(() => beep(1174, 0.1, 0.08), 120);
      break;
    case "movida":
      beep(523, 0.08, 0.06);
      break;
    case "alerta":
      beep(440, 0.15, 0.09);
      window.setTimeout(() => beep(330, 0.15, 0.09), 160);
      break;
  }
}
