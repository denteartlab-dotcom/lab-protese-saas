let audioCtx: AudioContext | null = null;

function obterAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

/** Som curto ao receber mensagem do outro lado do chat. */
export function tocarSomNovaMensagemSuporte() {
  const ctx = obterAudioContext();
  if (!ctx) return;

  try {
    const agora = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(740, agora);
    osc.frequency.exponentialRampToValueAtTime(980, agora + 0.12);
    gain.gain.setValueAtTime(0.0001, agora);
    gain.gain.exponentialRampToValueAtTime(0.12, agora + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, agora + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(agora);
    osc.stop(agora + 0.3);
  } catch {
    /* ignore */
  }
}
