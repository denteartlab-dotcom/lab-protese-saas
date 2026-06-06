import { dateToBrShort, parseBrDate } from "@/lib/datas-br";
import { readStorage, writeStorage } from "@/lib/persisted-storage";

export const ENTREGAS_STORAGE_KEY = "labProteseControleEntregas";
export const ENTREGADORES_STORAGE_KEY = "labProteseEntregadores";
export const ENTREGAS_EVENT = "labProteseControleEntregasAtualizado";

export type SituacaoEntrega = "pendente" | "em_rota" | "entregue";

export type EntregaControle = {
  id: string;
  dataPedido: string;
  destinatario: string;
  entregador: string;
  descricao: string;
  dataFinalizado?: string | null;
  nomeRecebedor?: string;
  situacao: SituacaoEntrega;
  valor: number;
};

export const SITUACOES_ENTREGA: Record<
  SituacaoEntrega,
  { label: string; badge: string }
> = {
  pendente: { label: "Pendente", badge: "bg-amber-100 text-amber-800" },
  em_rota: { label: "Em Rota", badge: "bg-blue-100 text-blue-800" },
  entregue: { label: "Entregue", badge: "bg-emerald-100 text-emerald-800" },
};

export function carregarEntregas(): EntregaControle[] {
  const lista = readStorage<EntregaControle[]>(ENTREGAS_STORAGE_KEY, []);
  if (!Array.isArray(lista)) return [];
  return lista
    .map((item) => normalizarEntrega(item))
    .filter((item): item is EntregaControle => Boolean(item))
    .sort((a, b) => new Date(b.dataPedido).getTime() - new Date(a.dataPedido).getTime());
}

export function salvarEntregas(lista: EntregaControle[]) {
  const normalizada = lista.map((item) => normalizarEntrega(item)).filter(Boolean) as EntregaControle[];
  writeStorage(ENTREGAS_STORAGE_KEY, normalizada);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ENTREGAS_EVENT));
  }
  return normalizada;
}

export function carregarEntregadores(): string[] {
  const salvos = readStorage<string[]>(ENTREGADORES_STORAGE_KEY, []);
  const base = Array.isArray(salvos) ? salvos.filter(Boolean) : [];
  const dasEntregas = carregarEntregas()
    .map((item) => item.entregador.trim())
    .filter(Boolean);
  return Array.from(new Set([...base, ...dasEntregas])).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

export function registrarEntregador(nome: string) {
  const termo = nome.trim();
  if (!termo) return;
  const atuais = carregarEntregadores();
  if (atuais.includes(termo)) return;
  writeStorage(ENTREGADORES_STORAGE_KEY, [...atuais, termo].sort((a, b) => a.localeCompare(b, "pt-BR")));
}

function normalizarEntrega(item: Partial<EntregaControle>): EntregaControle | null {
  const id = String(item.id || "").trim();
  const destinatario = String(item.destinatario || "").trim();
  if (!id || !destinatario) return null;

  const situacao =
    item.situacao === "em_rota" || item.situacao === "entregue" ? item.situacao : "pendente";

  return {
    id,
    dataPedido: item.dataPedido || new Date().toISOString(),
    destinatario,
    entregador: String(item.entregador || "").trim(),
    descricao: String(item.descricao || "").trim(),
    dataFinalizado: item.dataFinalizado || null,
    nomeRecebedor: String(item.nomeRecebedor || "").trim(),
    situacao,
    valor: Number(item.valor) || 0,
  };
}

export function criarEntrega(
  dados: Omit<EntregaControle, "id" | "dataPedido"> & {
    dataPedido?: string;
  }
): EntregaControle {
  const entrega = normalizarEntrega({
    id: `ent-${Date.now()}`,
    dataPedido: dados.dataPedido || new Date().toISOString(),
    ...dados,
  });
  if (!entrega) throw new Error("Dados da entrega inválidos.");
  if (entrega.entregador) registrarEntregador(entrega.entregador);
  const lista = [...carregarEntregas(), entrega];
  salvarEntregas(lista);
  return entrega;
}

export function atualizarEntrega(id: string, dados: Partial<EntregaControle>) {
  const lista = carregarEntregas();
  const atualizada = lista.map((item) => {
    if (item.id !== id) return item;
    const merged = normalizarEntrega({ ...item, ...dados, id: item.id });
    return merged || item;
  });
  const entrega = atualizada.find((item) => item.id === id);
  if (entrega?.entregador) registrarEntregador(entrega.entregador);
  salvarEntregas(atualizada);
}

export function excluirEntrega(id: string) {
  salvarEntregas(carregarEntregas().filter((item) => item.id !== id));
}

export function formatarDataHoraEntrega(dataIso: string) {
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatarDataEntrega(dataIso?: string | null) {
  if (!dataIso) return "—";
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "—";
  return dateToBrShort(data);
}

export function formatarMoedaEntrega(valor: number) {
  return (Number(valor) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function dataBrInicioMesAtual() {
  const hoje = new Date();
  return dateToBrShort(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
}

export function dataBrHoje() {
  return dateToBrShort(new Date());
}

export function filtrarEntregas(
  entregas: EntregaControle[],
  filtros: {
    entregador?: string;
    situacaoCard?: SituacaoEntrega | "todos";
    situacao?: string;
    periodo?: "pedido" | "finalizado";
    dataInicio?: string;
    dataFim?: string;
    busca?: string;
  }
) {
  const termo = (filtros.busca || "").trim().toLowerCase();

  return entregas.filter((entrega) => {
    if (filtros.entregador && entrega.entregador !== filtros.entregador) return false;

    const situacaoFiltro = filtros.situacaoCard && filtros.situacaoCard !== "todos"
      ? filtros.situacaoCard
      : filtros.situacao || "";
    if (situacaoFiltro && entrega.situacao !== situacaoFiltro) return false;

    if (termo) {
      const haystack = [
        entrega.destinatario,
        entrega.descricao,
        entrega.nomeRecebedor || "",
        entrega.entregador,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(termo)) return false;
    }

    if (filtros.dataInicio || filtros.dataFim) {
      const campo =
        filtros.periodo === "finalizado" ? entrega.dataFinalizado : entrega.dataPedido;
      if (!campo) return false;
      const dataLinha = new Date(campo);
      if (Number.isNaN(dataLinha.getTime())) return false;

      if (filtros.dataInicio) {
        const ini = parseBrDate(filtros.dataInicio);
        if (ini) {
          ini.setHours(0, 0, 0, 0);
          if (dataLinha < ini) return false;
        }
      }
      if (filtros.dataFim) {
        const fim = parseBrDate(filtros.dataFim);
        if (fim) {
          fim.setHours(23, 59, 59, 999);
          if (dataLinha > fim) return false;
        }
      }
    }

    return true;
  });
}

export function contarPorSituacao(entregas: EntregaControle[]) {
  return {
    pendente: entregas.filter((item) => item.situacao === "pendente").length,
    em_rota: entregas.filter((item) => item.situacao === "em_rota").length,
    entregue: entregas.filter((item) => item.situacao === "entregue").length,
  };
}
