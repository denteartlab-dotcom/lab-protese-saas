/**
 * Smoke test do debounce TV (issue 004).
 * Uso: node scripts/tv-notify-debounce-smoke.mjs
 *
 * Simula 10 agendamentos rápidos na mesma OS e verifica que há no máximo
 * 2 emits por janela (delta + chart).
 */

const DEBOUNCE_MS = 1_500;

function criarSmokeTest() {
  let emitCount = 0;
  const emits = [];

  const filas = new Map();

  function emit(event) {
    emitCount += 1;
    emits.push({ t: Date.now(), event });
  }

  function obterFila(empresaId) {
    let fila = filas.get(empresaId);
    if (!fila) {
      fila = { ids: new Set(), timer: null, flushing: false };
      filas.set(empresaId, fila);
    }
    return fila;
  }

  async function flush(empresaId) {
    const fila = obterFila(empresaId);
    if (fila.flushing) return;
    fila.flushing = true;
    const ids = [...fila.ids];
    fila.ids.clear();
    if (fila.timer) {
      clearTimeout(fila.timer);
      fila.timer = null;
    }

    await new Promise((r) => setTimeout(r, 5));

    if (ids.length === 0) {
      emit("tv:ordens:update");
      emit("tv:chart:update");
    } else {
      emit("tv:ordens:delta");
      emit("tv:chart:update");
    }

    fila.flushing = false;
    if (fila.ids.size > 0) {
      fila.timer = setTimeout(() => void flush(empresaId), DEBOUNCE_MS);
    }
  }

  function agendar(empresaId, trabalhoId) {
    const fila = obterFila(empresaId);
    if (trabalhoId) fila.ids.add(trabalhoId);
    if (fila.timer) clearTimeout(fila.timer);
    fila.timer = setTimeout(() => void flush(empresaId), DEBOUNCE_MS);
  }

  return { agendar, getEmitCount: () => emitCount, getEmits: () => emits };
}

async function main() {
  const { agendar, getEmitCount, getEmits } = criarSmokeTest();
  const empresaId = "empresa-teste";
  const osId = "os-123";

  for (let i = 0; i < 10; i++) {
    agendar(empresaId, osId);
  }

  await new Promise((r) => setTimeout(r, DEBOUNCE_MS + 200));

  const total = getEmitCount();
  const ok = total <= 2;

  console.log(`Emits após 10 updates rápidos: ${total} (esperado ≤ 2)`);
  console.log("Eventos:", getEmits().map((e) => e.event).join(", "));

  if (!ok) {
    console.error("FALHOU: debounce não agrupou emits.");
    process.exit(1);
  }

  console.log("OK: debounce TV agrupou notificações.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
