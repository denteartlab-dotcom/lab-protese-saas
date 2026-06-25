import {
  formatarDataHoraEntrega,
  type EntregaControle,
} from "@/lib/controle-entregas";
import { aplicarEspelhoServidor } from "@/lib/armazenamento-laboratorio";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import { gerarHistoricoEntregasPdf } from "@/lib/relatorios-impressao-pdf";
import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import { readStorage, writeStorage } from "@/lib/persisted-storage";

export const ENTREGAS_HISTORICO_STORAGE_KEY = "labProteseControleEntregasHistorico";
export const ENTREGAS_HISTORICO_EVENT = "labProteseControleEntregasHistoricoAtualizado";

export type SituacaoHistoricoEntrega = "entregue" | "recebido";

export type EntregaHistorico = {
  id: string;
  numeroOs: string;
  destinatario: string;
  descricao: string;
  entregador: string;
  dataFinalizado: string;
  nomeRecebedor?: string;
  situacao: SituacaoHistoricoEntrega;
  valor: number;
};

function normalizarHistorico(item: Partial<EntregaHistorico>): EntregaHistorico | null {
  const id = String(item.id || "").trim();
  const destinatario = String(item.destinatario || "").trim();
  const dataFinalizado = String(item.dataFinalizado || "").trim();
  if (!id || !destinatario || !dataFinalizado) return null;

  const situacao: SituacaoHistoricoEntrega =
    item.situacao === "recebido" ? "recebido" : "entregue";

  return {
    id,
    numeroOs: String(item.numeroOs || "").trim(),
    destinatario,
    descricao: String(item.descricao || "").trim(),
    entregador: String(item.entregador || "").trim(),
    dataFinalizado,
    nomeRecebedor: String(item.nomeRecebedor || "").trim(),
    situacao,
    valor: Number(item.valor) || 0,
  };
}

export function carregarHistoricoEntregas(): EntregaHistorico[] {
  const lista = readStorage<EntregaHistorico[]>(ENTREGAS_HISTORICO_STORAGE_KEY, []);
  if (!Array.isArray(lista)) return [];
  return lista
    .map((item) => normalizarHistorico(item))
    .filter((item): item is EntregaHistorico => Boolean(item))
    .sort(
      (a, b) =>
        new Date(b.dataFinalizado).getTime() - new Date(a.dataFinalizado).getTime()
    );
}

export function salvarHistoricoEntregas(lista: EntregaHistorico[]) {
  const normalizada = lista
    .map((item) => normalizarHistorico(item))
    .filter((item): item is EntregaHistorico => Boolean(item))
    .sort(
      (a, b) =>
        new Date(b.dataFinalizado).getTime() - new Date(a.dataFinalizado).getTime()
    );
  writeStorage(ENTREGAS_HISTORICO_STORAGE_KEY, normalizada);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ENTREGAS_HISTORICO_EVENT));
  }
  return normalizada;
}

export function entregaParaHistorico(
  entrega: EntregaControle,
  opcoes: { situacao: SituacaoHistoricoEntrega; nomeRecebedor?: string; dataFinalizado?: string }
): EntregaHistorico {
  const agora = opcoes.dataFinalizado || new Date().toISOString();
  return {
    id: `hist-${entrega.id}`,
    numeroOs: String(entrega.numeroOs || "").trim(),
    destinatario: entrega.destinatario,
    descricao: entrega.descricao || "",
    entregador: entrega.entregador || "",
    dataFinalizado: agora,
    nomeRecebedor: opcoes.nomeRecebedor?.trim() || entrega.nomeRecebedor || "",
    situacao: opcoes.situacao,
    valor: Number(entrega.valor) || 0,
  };
}

function mesclarHistorico(
  atual: EntregaHistorico[],
  novos: EntregaHistorico[]
): EntregaHistorico[] {
  const mapa = new Map(atual.map((item) => [item.id, item]));
  for (const item of novos) {
    const existentePorOs =
      item.numeroOs &&
      [...mapa.values()].find((h) => h.numeroOs === item.numeroOs);
    if (existentePorOs && item.situacao === "recebido") {
      mapa.set(existentePorOs.id, {
        ...existentePorOs,
        situacao: "recebido",
        nomeRecebedor: item.nomeRecebedor || existentePorOs.nomeRecebedor,
        dataFinalizado: item.dataFinalizado,
      });
      continue;
    }
    mapa.set(item.id, item);
  }
  return [...mapa.values()].sort(
    (a, b) => new Date(b.dataFinalizado).getTime() - new Date(a.dataFinalizado).getTime()
  );
}

export function registrarHistoricoEntregas(novos: EntregaHistorico[]) {
  if (novos.length === 0) return;
  salvarHistoricoEntregas(mesclarHistorico(carregarHistoricoEntregas(), novos));
}

export function labelSituacaoHistorico(situacao: SituacaoHistoricoEntrega) {
  return situacao === "recebido" ? "Recebido pelo cliente" : "Entregue ao cliente";
}

export function textoHistoricoEntrega(item: EntregaHistorico) {
  const os = item.numeroOs ? `OS ${item.numeroOs}` : "Entrega";
  const quando = formatarDataHoraEntrega(item.dataFinalizado);
  return `${os} — ${labelSituacaoHistorico(item.situacao)} em ${quando}`;
}

export function excluirHistoricoEntrega(id: string) {
  const filtrada = carregarHistoricoEntregas().filter((item) => item.id !== id);
  salvarHistoricoEntregas(filtrada);
  return filtrada;
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
    () =>
      gerarHistoricoEntregasPdf(
        linhas,
        `Emitido em ${emitidoEm} · ${historico.length} registro(s)`
      ),
    "historico-entregas.pdf",
    "Histórico de entregas"
  );
}

/** Persiste histórico no JsonStore do tenant. */
export async function registrarHistoricoEntregasServidor(
  empresaId: string,
  novos: EntregaHistorico[]
) {
  if (novos.length === 0) return;
  const atual =
    (await lerJsonStoreTenant<EntregaHistorico[]>(empresaId, ENTREGAS_HISTORICO_STORAGE_KEY)) ??
    [];
  const normalizada = Array.isArray(atual) ? atual : [];
  const mesclada = mesclarHistorico(
    normalizada
      .map((item) => normalizarHistorico(item))
      .filter((item): item is EntregaHistorico => Boolean(item)),
    novos
  );
  await salvarJsonStoreTenant(empresaId, ENTREGAS_HISTORICO_STORAGE_KEY, mesclada);
}

export async function sincronizarHistoricoEntregasCliente(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch(
      `/api/json-store/${encodeURIComponent(ENTREGAS_HISTORICO_STORAGE_KEY)}`,
      { cache: "no-store", credentials: "same-origin" }
    );
    if (!res.ok) return false;
    const lista = await res.json();
    if (!Array.isArray(lista)) return false;
    aplicarEspelhoServidor(ENTREGAS_HISTORICO_STORAGE_KEY, lista);
    window.dispatchEvent(new Event(ENTREGAS_HISTORICO_EVENT));
    return true;
  } catch {
    return false;
  }
}
