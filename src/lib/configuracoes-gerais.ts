import { persistirArmazenamentoImediato, readStorage, writeStorage } from "@/lib/persisted-storage";

export const CONFIG_GERAIS_STORAGE_KEY = "labProteseConfiguracoesGerais";
export const CONFIG_GERAIS_ATUALIZADA_EVENT = "lab-config-gerais-atualizada";

export type ConfiguracoesGerais = {
  /** Faturas: ao faturar, alterar situação da OS para Entregue. */
  faturasAlterarSituacaoEntregue: boolean;
  /** Faturas: incluir automaticamente no Controle de Entregas. */
  faturasAdicionarControleEntregas: boolean;
  /** Financeiro: emitir NFS-e ao lançar recebimento. */
  financeiroEmitirNfseAoReceber: boolean;
  /** Produção: remover caixa organizadora ao mudar para Prova. */
  producaoExcluirCaixaAoProva: boolean;
  /** Produção: remover caixa organizadora ao mudar para Entregue. */
  producaoExcluirCaixaAoEntregue: boolean;
  /** Produção: permitir editar Data Entrega / Finalizado. */
  producaoPermitirAlterarDataEntrega: boolean;
  /** Produção: só iniciar etapa se a anterior estiver finalizada. */
  producaoEtapaExigeAnteriorFinalizada: boolean;
};

export const CONFIG_GERAIS_PADRAO: ConfiguracoesGerais = {
  faturasAlterarSituacaoEntregue: true,
  faturasAdicionarControleEntregas: false,
  financeiroEmitirNfseAoReceber: false,
  producaoExcluirCaixaAoProva: false,
  producaoExcluirCaixaAoEntregue: false,
  producaoPermitirAlterarDataEntrega: false,
  producaoEtapaExigeAnteriorFinalizada: false,
};

export function normalizarConfiguracoesGerais(
  valor?: Partial<ConfiguracoesGerais> | null
): ConfiguracoesGerais {
  if (!valor || typeof valor !== "object") {
    return { ...CONFIG_GERAIS_PADRAO };
  }
  return {
    faturasAlterarSituacaoEntregue:
      valor.faturasAlterarSituacaoEntregue ??
      CONFIG_GERAIS_PADRAO.faturasAlterarSituacaoEntregue,
    faturasAdicionarControleEntregas: Boolean(valor.faturasAdicionarControleEntregas),
    financeiroEmitirNfseAoReceber: Boolean(valor.financeiroEmitirNfseAoReceber),
    producaoExcluirCaixaAoProva: Boolean(valor.producaoExcluirCaixaAoProva),
    producaoExcluirCaixaAoEntregue: Boolean(valor.producaoExcluirCaixaAoEntregue),
    producaoPermitirAlterarDataEntrega: Boolean(valor.producaoPermitirAlterarDataEntrega),
    producaoEtapaExigeAnteriorFinalizada: Boolean(
      valor.producaoEtapaExigeAnteriorFinalizada
    ),
  };
}

export function carregarConfiguracoesGerais(): ConfiguracoesGerais {
  if (typeof window === "undefined") return { ...CONFIG_GERAIS_PADRAO };
  try {
    const salvo = readStorage<Partial<ConfiguracoesGerais> | null>(
      CONFIG_GERAIS_STORAGE_KEY,
      null
    );
    if (!salvo) return { ...CONFIG_GERAIS_PADRAO };
    return normalizarConfiguracoesGerais(salvo);
  } catch {
    return { ...CONFIG_GERAIS_PADRAO };
  }
}

export function salvarConfiguracoesGerais(config: ConfiguracoesGerais) {
  if (typeof window === "undefined") return;
  const normalizado = normalizarConfiguracoesGerais(config);
  writeStorage(CONFIG_GERAIS_STORAGE_KEY, normalizado);
  void persistirArmazenamentoImediato(CONFIG_GERAIS_STORAGE_KEY, normalizado);
  window.dispatchEvent(new Event(CONFIG_GERAIS_ATUALIZADA_EVENT));
}

export async function sincronizarConfiguracoesGeraisDoServidor(): Promise<ConfiguracoesGerais> {
  const local = carregarConfiguracoesGerais();
  try {
    const res = await fetch(
      `/api/json-store/${encodeURIComponent(CONFIG_GERAIS_STORAGE_KEY)}`,
      { cache: "no-store", credentials: "same-origin" }
    );
    if (!res.ok) return local;
    const remoto = (await res.json()) as Partial<ConfiguracoesGerais> | null;
    if (!remoto || typeof remoto !== "object") return local;
    const mesclado = normalizarConfiguracoesGerais({ ...local, ...remoto });
    salvarConfiguracoesGerais(mesclado);
    return mesclado;
  } catch {
    return local;
  }
}

export async function persistirConfiguracoesGeraisServidor(
  config: ConfiguracoesGerais
): Promise<void> {
  const payload = normalizarConfiguracoesGerais(config);
  const res = await fetch(
    `/api/json-store/${encodeURIComponent(CONFIG_GERAIS_STORAGE_KEY)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.error === "string" ? err.error : "Não foi possível gravar no servidor."
    );
  }
}
