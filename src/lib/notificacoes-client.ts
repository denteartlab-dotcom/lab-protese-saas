import type { NotificacaoApi } from "@/app/api/notificacoes/route";
import { getProdutosEstoqueExtras, PRODUTOS_ESTOQUE_EVENT } from "@/lib/estoque";
import type { MessageKey } from "@/lib/i18n";
import { hrefProdutoEstoque } from "@/lib/notificacao-links";

export type NotificacaoUi = {
  id: string;
  kind: MessageKey;
  tituloKey: MessageKey;
  href: string;
  params: Record<string, string | number>;
  criadoEm: string;
};

export const NOTIF_LIDAS_KEY = "labProteseNotificacoesLidas";
export const NOTIF_DESCARTADAS_KEY = "labProteseNotificacoesDescartadas";
export const NOTIF_SISTEMA_KEY = "labProteseNotifSistema";

const TITULO_POR_KIND: Partial<Record<MessageKey, MessageKey>> = {
  "notif.estoque_zerado": "notif.titulo.estoque_zerado",
  "notif.estoque_baixo": "notif.titulo.estoque_baixo",
  "notif.nota_vencida": "notif.titulo.nota_vencida",
  "notif.saldo_limite": "notif.titulo.saldo_limite",
  "notif.orcamento_aguardando": "notif.titulo.orcamento_aguardando",
  "notif.orcamento_recebido": "notif.titulo.orcamento_recebido",
  "notif.os_sem_nota": "notif.titulo.os_sem_nota",
  "notif.despesa_vencendo": "notif.titulo.despesa_vencendo",
  "notif.cobranca_dia": "notif.titulo.cobranca_dia",
  "notif.servico_vencendo": "notif.titulo.servico_vencendo",
  "notif.servico_atrasado": "notif.titulo.servico_atrasado",
  "notif.anotacao_lembrete": "notif.titulo.anotacao_lembrete",
};

export function tituloKeyNotificacao(kind: MessageKey): MessageKey {
  return TITULO_POR_KIND[kind] || "notif.titulo.geral";
}

export function lerNotificacoesLidas(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTIF_LIDAS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function salvarNotificacoesLidas(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIF_LIDAS_KEY, JSON.stringify(ids));
}

export function lerNotificacoesDescartadas(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTIF_DESCARTADAS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function salvarNotificacoesDescartadas(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIF_DESCARTADAS_KEY, JSON.stringify(ids));
}

export function notificacaoSistemaAtiva(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(NOTIF_SISTEMA_KEY) !== "off";
}

export function definirNotificacaoSistema(ativa: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIF_SISTEMA_KEY, ativa ? "on" : "off");
}

const ESTOQUE_BAIXO_LIMITE = 5;

export function notificacoesEstoqueLocal(
  produtos: Array<{ id: string; nome: string }>
): NotificacaoUi[] {
  const extras = getProdutosEstoqueExtras();
  const lista: NotificacaoUi[] = [];
  for (const p of produtos) {
    const qtd = Number(extras[p.id]?.estoque ?? 0);
    if (qtd <= 0) {
      lista.push({
        id: `estoque-zero-${p.id}`,
        kind: "notif.estoque_zerado",
        tituloKey: "notif.titulo.estoque_zerado",
        href: hrefProdutoEstoque(p.id),
        params: { produto: p.nome },
        criadoEm: new Date().toISOString(),
      });
    } else if (qtd <= ESTOQUE_BAIXO_LIMITE) {
      lista.push({
        id: `estoque-baixo-${p.id}`,
        kind: "notif.estoque_baixo",
        tituloKey: "notif.titulo.estoque_baixo",
        href: hrefProdutoEstoque(p.id),
        params: { produto: p.nome, qtd },
        criadoEm: new Date().toISOString(),
      });
    }
  }
  return lista;
}

export function mapApiNotificacao(n: NotificacaoApi): NotificacaoUi {
  const kindMap: Record<NotificacaoApi["kind"], MessageKey> = {
    nota_vencida: "notif.nota_vencida",
    saldo_limite: "notif.saldo_limite",
    orcamento_aguardando: "notif.orcamento_aguardando",
    orcamento_recebido: "notif.orcamento_recebido",
    os_sem_nota: "notif.os_sem_nota",
    despesa_vencendo: "notif.despesa_vencendo",
    cobranca_dia: "notif.cobranca_dia",
    servico_vencendo: "notif.servico_vencendo",
    servico_atrasado: "notif.servico_atrasado",
  };
  const kind = kindMap[n.kind];
  return {
    id: n.id,
    kind,
    tituloKey: tituloKeyNotificacao(kind),
    href: n.href,
    params: n.params,
    criadoEm: n.criadoEm,
  };
}

export { notificacoesAnotacoesLocal, ANOTACOES_ATUALIZADO_EVENT } from "@/lib/anotacoes-dashboard";
export { PRODUTOS_ESTOQUE_EVENT };
