import type { MessageKey } from "@/lib/i18n";
import type { NotificacaoUi } from "@/lib/notificacoes-client";

export const ANOTACOES_DASHBOARD_KEY = "labProteseAnotacoesDashboard";
export const ANOTACOES_ATUALIZADO_EVENT = "labProteseAnotacoesAtualizado";

export type AnotacaoDashboard = {
  id: string;
  texto: string;
  criadoEm: string;
};

const MAX_ANOTACOES = 80;

function notifyAnotacoesAtualizadas() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ANOTACOES_ATUALIZADO_EVENT));
}

export function lerAnotacoesDashboard(): AnotacaoDashboard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ANOTACOES_DASHBOARD_KEY);
    const lista = raw ? (JSON.parse(raw) as AnotacaoDashboard[]) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function salvarAnotacoesDashboard(lista: AnotacaoDashboard[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANOTACOES_DASHBOARD_KEY, JSON.stringify(lista.slice(0, MAX_ANOTACOES)));
  notifyAnotacoesAtualizadas();
}

export function adicionarAnotacaoDashboard(texto: string): AnotacaoDashboard | null {
  const limpo = texto.trim();
  if (!limpo) return null;
  const nova: AnotacaoDashboard = {
    id: crypto.randomUUID(),
    texto: limpo,
    criadoEm: new Date().toISOString(),
  };
  const lista = [nova, ...lerAnotacoesDashboard()];
  salvarAnotacoesDashboard(lista);
  return nova;
}

export function idNotificacaoAnotacao(anotacaoId: string) {
  return `anotacao-${anotacaoId}`;
}

export function removerAnotacaoDashboard(id: string) {
  const lista = lerAnotacoesDashboard().filter((a) => a.id !== id);
  salvarAnotacoesDashboard(lista);
  return idNotificacaoAnotacao(id);
}

export function notificacoesAnotacoesLocal(): NotificacaoUi[] {
  return lerAnotacoesDashboard().map((a) => {
    const texto =
      a.texto.length > 120 ? `${a.texto.slice(0, 120)}…` : a.texto;
    const kind: MessageKey = "notif.anotacao_lembrete";
    return {
      id: `anotacao-${a.id}`,
      kind,
      tituloKey: "notif.titulo.anotacao_lembrete",
      href: "/app",
      params: { texto },
      criadoEm: a.criadoEm,
    };
  });
}
