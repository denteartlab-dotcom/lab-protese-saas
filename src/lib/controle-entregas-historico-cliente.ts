import { formatarDataHoraEntrega } from "@/lib/controle-entregas";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import {
  carregarHistoricoEntregas,
  ENTREGAS_HISTORICO_EVENT,
  ENTREGAS_HISTORICO_STORAGE_KEY,
  excluirHistoricoEntrega,
  mesclarHistorico,
  normalizarHistorico,
  sincronizarHistoricoEntregasCliente,
  type EntregaHistorico,
  type SituacaoHistoricoEntrega,
} from "@/lib/controle-entregas-historico-core";

export {
  ENTREGAS_HISTORICO_EVENT,
  ENTREGAS_HISTORICO_STORAGE_KEY,
  carregarHistoricoEntregas,
  entregaParaHistorico,
  excluirHistoricoEntrega,
  mesclarHistorico,
  normalizarHistorico,
  registrarHistoricoEntregas,
  salvarHistoricoEntregas,
  sincronizarHistoricoEntregasCliente,
  type EntregaHistorico,
  type SituacaoHistoricoEntrega,
} from "@/lib/controle-entregas-historico-core";

export function labelSituacaoHistorico(situacao: SituacaoHistoricoEntrega) {
  return situacao === "recebido" ? "Recebido pelo cliente" : "Entregue ao cliente";
}

export function textoHistoricoEntrega(item: EntregaHistorico) {
  const os = item.numeroOs ? `OS ${item.numeroOs}` : "Entrega";
  const quando = formatarDataHoraEntrega(item.dataFinalizado);
  return `${os} — ${labelSituacaoHistorico(item.situacao)} em ${quando}`;
}

export async function persistirHistoricoEntregasServidor(lista: EntregaHistorico[]) {
  const payload = lista
    .map((item) => normalizarHistorico(item))
    .filter((item): item is EntregaHistorico => Boolean(item));
  const res = await fetch(
    `/api/json-store/${encodeURIComponent(ENTREGAS_HISTORICO_STORAGE_KEY)}`,
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
      typeof err?.error === "string" ? err.error : "Não foi possível gravar o histórico."
    );
  }
}

export async function excluirHistoricoEntregaPersistido(id: string) {
  const filtrada = excluirHistoricoEntrega(id);
  await persistirHistoricoEntregasServidor(filtrada);
  return filtrada;
}

export async function imprimirHistoricoEntregas(historico: EntregaHistorico[]) {
  const emitidoEm = new Date().toLocaleString("pt-BR");
  const linhas = historico.map((item) => ({
    numeroOs: item.numeroOs || "—",
    destinatario: item.destinatario,
    descricao: item.descricao || "—",
    entregador: item.entregador || "—",
    entregueEm: formatarDataHoraEntrega(item.dataFinalizado),
    situacao: labelSituacaoHistorico(item.situacao),
    recebedor: item.nomeRecebedor || "—",
    valor: item.valor,
  }));

  await abrirPdfGerando(
    async () => {
      const { gerarHistoricoEntregasPdf } = await import("@/lib/relatorios-impressao-pdf");
      return gerarHistoricoEntregasPdf(
        linhas,
        `Emitido em ${emitidoEm} · ${historico.length} registro(s)`
      );
    },
    "historico-entregas.pdf",
    "Histórico de entregas"
  );
}
