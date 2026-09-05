import type { NotificacaoApi } from "@/lib/notificacoes-resumo-server";
import { getProdutosEstoqueExtras, PRODUTOS_ESTOQUE_EVENT } from "@/lib/estoque";
import type { MessageKey } from "@/lib/i18n";
import { readStorage, writeStorage } from "@/lib/persisted-storage";

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
  "notif.boleto_vencido": "notif.titulo.boleto_vencido",
  "notif.boleto_vencendo": "notif.titulo.boleto_vencendo",
  "notif.servico_vencendo": "notif.titulo.servico_vencendo",
  "notif.servico_atrasado": "notif.titulo.servico_atrasado",
  "notif.urgente_cliente": "notif.titulo.urgente_cliente",
  "notif.observacao_cliente": "notif.titulo.observacao_cliente",
  "notif.solicitacao_envio_cliente": "notif.titulo.solicitacao_envio_cliente",
  "notif.anotacao_lembrete": "notif.titulo.anotacao_lembrete",
  "notif.armazenamento_quase_cheio": "notif.titulo.armazenamento_quase_cheio",
  "notif.nuvem_pool_esgotada": "notif.titulo.nuvem_pool_esgotada",
};

export function tituloKeyNotificacao(kind: MessageKey): MessageKey {
  return TITULO_POR_KIND[kind] || "notif.titulo.geral";
}

/** Notificações que só marcam como lidas ao clicar (sem navegar para outra tela). */
export function notificacaoSoMarcarLida(n: Pick<NotificacaoUi, "kind">) {
  return n.kind === "notif.estoque_zerado" || n.kind === "notif.estoque_baixo";
}

export function lerNotificacoesLidas(): string[] {
  if (typeof window === "undefined") return [];
  const parsed = readStorage<string[]>(NOTIF_LIDAS_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function salvarNotificacoesLidas(ids: string[]) {
  if (typeof window === "undefined") return;
  writeStorage(NOTIF_LIDAS_KEY, ids);
}

export function lerNotificacoesDescartadas(): string[] {
  if (typeof window === "undefined") return [];
  const parsed = readStorage<string[]>(NOTIF_DESCARTADAS_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function salvarNotificacoesDescartadas(ids: string[]) {
  if (typeof window === "undefined") return;
  writeStorage(NOTIF_DESCARTADAS_KEY, ids);
}

export function notificacaoSistemaAtiva(): boolean {
  if (typeof window === "undefined") return true;
  return readStorage<string>(NOTIF_SISTEMA_KEY, "on") !== "off";
}

export function definirNotificacaoSistema(ativa: boolean) {
  if (typeof window === "undefined") return;
  writeStorage(NOTIF_SISTEMA_KEY, ativa ? "on" : "off");
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
        href: "/app/produtos",
        params: { produto: p.nome },
        criadoEm: new Date().toISOString(),
      });
    } else if (qtd <= ESTOQUE_BAIXO_LIMITE) {
      lista.push({
        id: `estoque-baixo-${p.id}`,
        kind: "notif.estoque_baixo",
        tituloKey: "notif.titulo.estoque_baixo",
        href: "/app/produtos",
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
    boleto_vencido: "notif.boleto_vencido",
    boleto_vencendo: "notif.boleto_vencendo",
    servico_vencendo: "notif.servico_vencendo",
    servico_atrasado: "notif.servico_atrasado",
    urgente_cliente: "notif.urgente_cliente",
    observacao_cliente: "notif.observacao_cliente",
    solicitacao_envio_cliente: "notif.solicitacao_envio_cliente",
    armazenamento_quase_cheio: "notif.armazenamento_quase_cheio",
    nuvem_pool_esgotada: "notif.nuvem_pool_esgotada",
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
