import { descartarLocalStorageLaboratorioLegado } from "@/lib/armazenamento-laboratorio";

const BUILD_ID_KEY = "labProteseBuildId";
const AUTO_RECOVERY_SESSION_KEY = "labProteseAutoRecovery";

/** Limpa caches do navegador e service workers (página /limpar-sessao). */
export async function limparCachesAplicacao(): Promise<void> {
  const passos: Promise<unknown>[] = [];

  if (typeof window !== "undefined" && window.caches?.keys) {
    passos.push(
      window.caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    );
  }

  if (typeof navigator !== "undefined" && navigator.serviceWorker?.getRegistrations) {
    passos.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
    );
  }

  await Promise.all(passos);
}

/** Remove dados legados do laboratório no navegador e caches antigos. */
export async function recuperarNavegadorAplicacao(): Promise<void> {
  descartarLocalStorageLaboratorioLegado();
  await limparCachesAplicacao();
}

/** Atualiza o build id no navegador sem forçar reload automático. */
export async function garantirVersaoAplicacaoAtual(buildId: string): Promise<boolean> {
  if (!buildId || buildId === "dev") return false;

  window.localStorage.setItem(BUILD_ID_KEY, buildId);
  return false;
}

export function recuperacaoAutomaticaDisponivel() {
  return !window.sessionStorage.getItem(AUTO_RECOVERY_SESSION_KEY);
}

function marcarRecuperacaoAutomatica() {
  window.sessionStorage.setItem(AUTO_RECOVERY_SESSION_KEY, "1");
}

/**
 * Uma tentativa por aba: limpa cache/localStorage legado.
 * Não recarrega a página automaticamente (evita "piscar" ao abrir o site).
 */
export async function executarRecuperacaoAutomatica(): Promise<boolean> {
  if (!recuperacaoAutomaticaDisponivel()) return false;
  marcarRecuperacaoAutomatica();
  await recuperarNavegadorAplicacao();
  return false;
}
