import { dateToBrShort, parseBrDate } from "@/lib/datas-br";
import {
  carregarNomesEntregadores,
  garantirEntregadorCadastro,
} from "@/lib/entregadores-cadastro";
import { readStorage, writeStorage } from "@/lib/persisted-storage";

export const ENTREGAS_STORAGE_KEY = "labProteseControleEntregas";
export const ENTREGADORES_STORAGE_KEY = "labProteseEntregadores";
export const ENTREGAS_EVENT = "labProteseControleEntregasAtualizado";

export type SituacaoEntrega = "pendente" | "em_rota" | "entregue";

export type TipoDestinatarioEntrega = "cliente" | "fornecedor" | "prestador";
export type TipoDestinatarioEntregaForm = TipoDestinatarioEntrega | "";

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
  numeroOs?: string;
  tipoDestinatario?: TipoDestinatarioEntrega;
  nomeDestinatario?: string;
  cep?: string;
  rua?: string;
  numeroEndereco?: string;
  cidade?: string;
  uf?: string;
  bairro?: string;
  complemento?: string;
  dataEntrega?: string;
  hora?: string;
  tipoEntregador?: string;
  observacao?: string;
};

export const TIPOS_DESTINATARIO_ENTREGA: {
  value: TipoDestinatarioEntregaForm;
  label: string;
}[] = [
  { value: "", label: "Selecione um Destinatário" },
  { value: "cliente", label: "Cliente" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "prestador", label: "Prestador de Serviço" },
];

export const TIPOS_ENTREGADOR = [
  "Motoboy",
  "Entregador Próprio",
  "Transportadora",
  "Correios",
  "Outro",
];

export const DESCRICOES_ENTREGA_PADRAO = [
  "Entrega de prótese",
  "Coleta de moldagem",
  "Entrega de trabalho",
  "Retirada no laboratório",
  "Entrega de produto",
];

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
  const cadastro = carregarNomesEntregadores();
  const dasEntregas = carregarEntregas()
    .map((item) => item.entregador.trim())
    .filter(Boolean);
  return Array.from(new Set([...cadastro, ...dasEntregas])).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

export function registrarEntregador(nome: string) {
  garantirEntregadorCadastro(nome);
}

function normalizarEntrega(item: Partial<EntregaControle>): EntregaControle | null {
  const id = String(item.id || "").trim();
  const destinatario = String(item.destinatario || "").trim();
  if (!id || !destinatario) return null;

  const situacao =
    item.situacao === "em_rota" || item.situacao === "entregue" ? item.situacao : "pendente";

  const tipoDestinatario = normalizarTipoDestinatario(item.tipoDestinatario);

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
    numeroOs: String(item.numeroOs || "").trim(),
    tipoDestinatario,
    nomeDestinatario: String(item.nomeDestinatario || destinatario).trim(),
    cep: String(item.cep || "").trim(),
    rua: String(item.rua || "").trim(),
    numeroEndereco: String(item.numeroEndereco || "").trim(),
    cidade: String(item.cidade || "").trim(),
    uf: String(item.uf || "").trim(),
    bairro: String(item.bairro || "").trim(),
    complemento: String(item.complemento || "").trim(),
    dataEntrega: item.dataEntrega || item.dataPedido || new Date().toISOString(),
    hora: String(item.hora || extrairHoraEntrega(item.dataPedido)).trim(),
    tipoEntregador: String(item.tipoEntregador || "").trim(),
    observacao: String(item.observacao || "").trim(),
  };
}

function extrairHoraEntrega(dataIso?: string) {
  if (!dataIso) return "";
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function normalizarTipoDestinatario(raw?: string | null): TipoDestinatarioEntrega {
  if (raw === "cliente" || raw === "fornecedor" || raw === "prestador") return raw;
  if (raw === "colaborador") return "prestador";
  if (raw === "outro") return "cliente";
  return "prestador";
}

export function labelNomeDestinatario(tipo: TipoDestinatarioEntregaForm) {
  if (tipo === "cliente") return "Nome do Cliente";
  if (tipo === "fornecedor") return "Nome do Fornecedor";
  if (tipo === "prestador") return "Nome do Prestador de Serviço";
  return "Nome do Destinatário";
}

export function formatarCepEntrega(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function montarDataPedidoEntrega(dataBr: string, hora: string) {
  const data = parseBrDate(dataBr);
  if (!data) return new Date().toISOString();
  const [h, m] = (hora || "00:00").split(":").map((parte) => Number(parte) || 0);
  data.setHours(h, m, 0, 0);
  return data.toISOString();
}

export type FormRotaEntrega = {
  numeroOs: string;
  tipoDestinatario: TipoDestinatarioEntregaForm;
  nomeDestinatario: string;
  cep: string;
  rua: string;
  numeroEndereco: string;
  cidade: string;
  uf: string;
  bairro: string;
  complemento: string;
  entregador: string;
  dataEntrega: string;
  hora: string;
  valor: string;
  tipoEntregador: string;
  descricao: string;
  observacao: string;
  situacao: SituacaoEntrega;
};

export function formRotaEntregaPadrao(): FormRotaEntrega {
  const agora = new Date();
  return {
    numeroOs: "",
    tipoDestinatario: "",
    nomeDestinatario: "",
    cep: "",
    rua: "",
    numeroEndereco: "",
    cidade: "",
    uf: "",
    bairro: "",
    complemento: "",
    entregador: "",
    dataEntrega: dataBrHoje(),
    hora: agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }),
    valor: "R$ 0,00",
    tipoEntregador: "",
    descricao: "",
    observacao: "",
    situacao: "pendente",
  };
}

export function entregaParaFormRota(entrega: EntregaControle): FormRotaEntrega {
  const data = entrega.dataEntrega || entrega.dataPedido;
  const dataObj = new Date(data);
  return {
    numeroOs: entrega.numeroOs || "",
    tipoDestinatario: entrega.tipoDestinatario || "prestador",
    nomeDestinatario: entrega.nomeDestinatario || entrega.destinatario,
    cep: entrega.cep || "",
    rua: entrega.rua || "",
    numeroEndereco: entrega.numeroEndereco || "",
    cidade: entrega.cidade || "",
    uf: entrega.uf || "",
    bairro: entrega.bairro || "",
    complemento: entrega.complemento || "",
    entregador: entrega.entregador || "",
    dataEntrega: Number.isNaN(dataObj.getTime()) ? dataBrHoje() : dateToBrShort(dataObj),
    hora: entrega.hora || extrairHoraEntrega(entrega.dataPedido),
    valor: formatarMoedaEntrega(entrega.valor),
    tipoEntregador: entrega.tipoEntregador || "",
    descricao: entrega.descricao || "",
    observacao: entrega.observacao || "",
    situacao: entrega.situacao,
  };
}

export function formRotaParaEntrega(
  form: FormRotaEntrega,
  parseValor: (value: string) => number
): Omit<EntregaControle, "id"> & { dataPedido?: string } {
  const nome = form.nomeDestinatario.trim();
  const dataPedido = montarDataPedidoEntrega(form.dataEntrega, form.hora);
  return {
    dataPedido,
    destinatario: nome,
    entregador: form.entregador.trim(),
    descricao: form.descricao.trim(),
    nomeRecebedor: "",
    situacao: form.situacao,
    valor: parseValor(form.valor),
    dataFinalizado: form.situacao === "entregue" ? new Date().toISOString() : null,
    numeroOs: form.numeroOs.trim(),
    tipoDestinatario: normalizarTipoDestinatario(form.tipoDestinatario),
    nomeDestinatario: nome,
    cep: form.cep.trim(),
    rua: form.rua.trim(),
    numeroEndereco: form.numeroEndereco.trim(),
    cidade: form.cidade.trim(),
    uf: form.uf.trim(),
    bairro: form.bairro.trim(),
    complemento: form.complemento.trim(),
    dataEntrega: dataPedido,
    hora: form.hora.trim(),
    tipoEntregador: form.tipoEntregador.trim(),
    observacao: form.observacao.trim(),
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
