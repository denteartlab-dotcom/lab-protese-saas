import { type EntregaControle } from "@/lib/controle-entregas";
import { parseBrDate } from "@/lib/datas-br";
import {
  aplicarEspelhoServidor,
  chaveComSalvamentoPendente,
  persistirArmazenamentoImediato,
} from "@/lib/armazenamento-laboratorio";
import { readStorage, writeStorage } from "@/lib/persisted-storage";

export const ENTREGAS_HISTORICO_STORAGE_KEY = "labProteseControleEntregasHistorico";
export const ENTREGAS_HISTORICO_EVENT = "labProteseControleEntregasHistoricoAtualizado";

export type SituacaoHistoricoEntrega = "entregue" | "recebido";

export type OsHistoricoEntrega = {
  numeroOs: string;
  descricao: string;
  paciente: string;
};

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
  ordensServico: OsHistoricoEntrega[];
};

function ordensDoPedido(origem: {
  numeroOs?: string;
  descricao?: string;
  ordensServico?: Array<{ numeroOs?: string; descricao?: string; paciente?: string } | null>;
}): OsHistoricoEntrega[] {
  const brutas = Array.isArray(origem.ordensServico) ? origem.ordensServico : [];
  const dasOrdens = brutas
    .map((ordem) => ({
      numeroOs: String(ordem?.numeroOs || "").trim(),
      descricao: String(ordem?.descricao || "").trim(),
      paciente: String(ordem?.paciente || "").trim(),
    }))
    .filter((ordem) => ordem.numeroOs);
  const unicas = new Map<string, OsHistoricoEntrega>();
  for (const ordem of dasOrdens) unicas.set(ordem.numeroOs, ordem);
  const lista = Array.from(unicas.values());
  const descricaoPedido = String(origem.descricao || "").trim();
  if (lista.length === 1 && !lista[0].descricao && descricaoPedido) {
    lista[0] = { ...lista[0], descricao: descricaoPedido };
  }
  if (lista.length > 0) return lista;

  return String(origem.numeroOs || "")
    .split(/[,;]+/)
    .map((parte) => parte.trim())
    .filter(Boolean)
    .map((numeroOs, indice, todas) => ({
      numeroOs,
      descricao: todas.length === 1 ? descricaoPedido : "",
      paciente: "",
    }));
}

export function normalizarHistorico(item: Partial<EntregaHistorico>): EntregaHistorico | null {
  const id = String(item.id || "").trim();
  const destinatario = String(item.destinatario || "").trim();
  const dataFinalizado = String(item.dataFinalizado || "").trim();
  if (!id || !destinatario || !dataFinalizado) return null;

  const situacao: SituacaoHistoricoEntrega =
    item.situacao === "recebido" ? "recebido" : "entregue";
  const ordensServico = ordensDoPedido(item);
  const numeroOs = ordensServico.map((ordem) => ordem.numeroOs).join(", ") || String(item.numeroOs || "").trim();

  return {
    id,
    numeroOs,
    destinatario,
    descricao: String(item.descricao || "").trim(),
    entregador: String(item.entregador || "").trim(),
    dataFinalizado,
    nomeRecebedor: String(item.nomeRecebedor || "").trim(),
    situacao,
    valor: Number(item.valor) || 0,
    ordensServico,
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
  const ordensServico = ordensDoPedido(entrega);
  return {
    id: `hist-${entrega.id}`,
    numeroOs: ordensServico.map((ordem) => ordem.numeroOs).join(", "),
    destinatario: entrega.destinatario,
    descricao: entrega.descricao || "",
    entregador: entrega.entregador || "",
    dataFinalizado: agora,
    nomeRecebedor: opcoes.nomeRecebedor?.trim() || entrega.nomeRecebedor || "",
    situacao: opcoes.situacao,
    valor: Number(entrega.valor) || 0,
    ordensServico,
  };
}

export function mesclarHistorico(
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

export function filtrarHistoricoEntregas(
  lista: EntregaHistorico[],
  filtros: { cliente?: string; dataInicio?: string; dataFim?: string }
) {
  const cliente = (filtros.cliente || "").trim();
  return lista.filter((item) => {
    if (cliente && item.destinatario.trim() !== cliente) return false;
    if (!filtros.dataInicio && !filtros.dataFim) return true;

    const dataLinha = new Date(item.dataFinalizado);
    if (Number.isNaN(dataLinha.getTime())) return false;

    if (filtros.dataInicio) {
      const inicio = parseBrDate(filtros.dataInicio);
      if (inicio) {
        inicio.setHours(0, 0, 0, 0);
        if (dataLinha < inicio) return false;
      }
    }
    if (filtros.dataFim) {
      const fim = parseBrDate(filtros.dataFim);
      if (fim) {
        fim.setHours(23, 59, 59, 999);
        if (dataLinha > fim) return false;
      }
    }
    return true;
  });
}

export function registrarHistoricoEntregas(novos: EntregaHistorico[]) {
  if (novos.length === 0) return;
  salvarHistoricoEntregas(mesclarHistorico(carregarHistoricoEntregas(), novos));
}

export function excluirHistoricoEntrega(id: string) {
  const filtrada = carregarHistoricoEntregas().filter((item) => item.id !== id);
  salvarHistoricoEntregas(filtrada);
  return filtrada;
}

export async function sincronizarHistoricoEntregasCliente(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (chaveComSalvamentoPendente(ENTREGAS_HISTORICO_STORAGE_KEY)) return false;
  try {
    const res = await fetch(
      `/api/json-store/${encodeURIComponent(ENTREGAS_HISTORICO_STORAGE_KEY)}`,
      { cache: "no-store", credentials: "same-origin" }
    );
    if (!res.ok) return false;
    const lista = await res.json();
    if (!Array.isArray(lista)) return false;

    const doServidor = lista
      .map((item) => normalizarHistorico(item as Partial<EntregaHistorico>))
      .filter((item): item is EntregaHistorico => Boolean(item));
    const local = carregarHistoricoEntregas();
    // Une servidor + local para não perder item acabado de concluir (corrida de sync).
    const mesclada = mesclarHistorico(doServidor, local);
    aplicarEspelhoServidor(ENTREGAS_HISTORICO_STORAGE_KEY, mesclada);
    window.dispatchEvent(new Event(ENTREGAS_HISTORICO_EVENT));

    if (mesclada.length > doServidor.length) {
      void persistirArmazenamentoImediato(
        ENTREGAS_HISTORICO_STORAGE_KEY,
        mesclada
      );
    }
    return true;
  } catch {
    return false;
  }
}
