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

/** Recarrega quando o deploy mudou e o navegador ainda usa JS antigo em cache. */
export async function garantirVersaoAplicacaoAtual(buildId: string): Promise<boolean> {
  if (!buildId || buildId === "dev") return false;

  const anterior = window.localStorage.getItem(BUILD_ID_KEY);
  window.localStorage.setItem(BUILD_ID_KEY, buildId);

  if (anterior && anterior !== buildId) {
    await recuperarNavegadorAplicacao();
    window.location.reload();
    return true;
  }

  return false;
}

export function recuperacaoAutomaticaDisponivel() {
  return !window.sessionStorage.getItem(AUTO_RECOVERY_SESSION_KEY);
}

function marcarRecuperacaoAutomatica() {
  window.sessionStorage.setItem(AUTO_RECOVERY_SESSION_KEY, "1");
}

/** Uma tentativa por aba: limpa cache/localStorage legado e recarrega. */
export async function executarRecuperacaoAutomatica(): Promise<boolean> {
  if (!recuperacaoAutomaticaDisponivel()) return false;
  marcarRecuperacaoAutomatica();
  await recuperarNavegadorAplicacao();
  window.location.reload();
  return true;
}
