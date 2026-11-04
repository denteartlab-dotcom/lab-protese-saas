import { type EntregaControle } from "@/lib/controle-entregas";
import { partesEnderecoCliente } from "@/lib/cliente-endereco";
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

export type EnderecoEtiquetaHistorico = {
  nomeDestinatario: string;
  cep: string;
  rua: string;
  numeroEndereco: string;
  cidade: string;
  uf: string;
  bairro: string;
  complemento: string;
};

export type EntregaHistorico = EnderecoEtiquetaHistorico & {
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

function textoEndereco(valor: unknown) {
  return String(valor ?? "").trim();
}

export function enderecoEtiquetaDoRegistro(
  item: Partial<EnderecoEtiquetaHistorico> | null | undefined
): EnderecoEtiquetaHistorico {
  return {
    nomeDestinatario: textoEndereco(item?.nomeDestinatario),
    cep: textoEndereco(item?.cep),
    rua: textoEndereco(item?.rua),
    numeroEndereco: textoEndereco(item?.numeroEndereco),
    cidade: textoEndereco(item?.cidade),
    uf: textoEndereco(item?.uf).toUpperCase().slice(0, 2),
    bairro: textoEndereco(item?.bairro),
    complemento: textoEndereco(item?.complemento),
  };
}

export function historicoTemEnderecoEtiqueta(
  item: Partial<EnderecoEtiquetaHistorico> | null | undefined
) {
  const endereco = enderecoEtiquetaDoRegistro(item);
  return Boolean(
    endereco.rua ||
      endereco.numeroEndereco ||
      endereco.bairro ||
      endereco.complemento ||
      endereco.cidade ||
      endereco.cep
  );
}

/** Mantém o endereço já gravado quando uma sincronização chega sem ele. */
function unirEnderecoEtiqueta(
  preferido: EntregaHistorico,
  reserva: EntregaHistorico
): EntregaHistorico {
  const endereco = historicoTemEnderecoEtiqueta(preferido)
    ? enderecoEtiquetaDoRegistro(preferido)
    : enderecoEtiquetaDoRegistro(reserva);
  return {
    ...preferido,
    ...endereco,
    nomeDestinatario: preferido.nomeDestinatario || reserva.nomeDestinatario,
  };
}

export function enderecoEtiquetaDeCadastro(cadastro: {
  nome?: string | null;
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  bairro?: string | null;
  complemento?: string | null;
  observacoes?: string | null;
}): EnderecoEtiquetaHistorico {
  const partes = partesEnderecoCliente(cadastro.observacoes, cadastro.endereco);
  return enderecoEtiquetaDoRegistro({
    nomeDestinatario: cadastro.nome,
    cep: cadastro.cep,
    rua: textoEndereco(cadastro.rua) || partes.rua,
    numeroEndereco: textoEndereco(cadastro.numero) || partes.numero,
    cidade: cadastro.cidade,
    uf: cadastro.uf,
    bairro: textoEndereco(cadastro.bairro) || partes.bairro,
    complemento: textoEndereco(cadastro.complemento) || partes.complemento,
  });
}

export function aplicarEnderecoNoHistorico(
  item: EntregaHistorico,
  endereco: Partial<EnderecoEtiquetaHistorico>
): EntregaHistorico {
  if (historicoTemEnderecoEtiqueta(item)) return item;
  const preenchido = enderecoEtiquetaDoRegistro({
    ...endereco,
    nomeDestinatario: item.nomeDestinatario || endereco.nomeDestinatario || item.destinatario,
  });
  return { ...item, ...preenchido };
}

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
    ...enderecoEtiquetaDoRegistro({
      ...item,
      nomeDestinatario: item.nomeDestinatario || destinatario,
    }),
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
    ...enderecoEtiquetaDoRegistro({
      nomeDestinatario: entrega.nomeDestinatario || entrega.destinatario,
      cep: entrega.cep,
      rua: entrega.rua,
      numeroEndereco: entrega.numeroEndereco,
      cidade: entrega.cidade,
      uf: entrega.uf,
      bairro: entrega.bairro,
      complemento: entrega.complemento,
    }),
  };
}

/** Remonta a entrega só para reimprimir a etiqueta que saiu naquele pedido. */
export function entregaControleDoHistorico(item: EntregaHistorico): EntregaControle {
  const endereco = enderecoEtiquetaDoRegistro(item);
  return {
    id: item.id,
    dataPedido: item.dataFinalizado,
    destinatario: item.destinatario,
    entregador: item.entregador,
    descricao: item.descricao,
    dataFinalizado: item.dataFinalizado,
    nomeRecebedor: item.nomeRecebedor || "",
    situacao: item.situacao,
    valor: item.valor,
    numeroOs: item.numeroOs,
    ordensServico: item.ordensServico.map((ordem) => ({
      numeroOs: ordem.numeroOs,
      descricao: ordem.descricao,
      paciente: ordem.paciente,
      trabalhoId: "",
    })),
    nomeDestinatario: endereco.nomeDestinatario || item.destinatario,
    cep: endereco.cep,
    rua: endereco.rua,
    numeroEndereco: endereco.numeroEndereco,
    cidade: endereco.cidade,
    uf: endereco.uf,
    bairro: endereco.bairro,
    complemento: endereco.complemento,
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
      const comEndereco = unirEnderecoEtiqueta(item, existentePorOs);
      mapa.set(existentePorOs.id, {
        ...existentePorOs,
        ...enderecoEtiquetaDoRegistro(comEndereco),
        situacao: "recebido",
        nomeRecebedor: item.nomeRecebedor || existentePorOs.nomeRecebedor,
        dataFinalizado: item.dataFinalizado,
      });
      continue;
    }
    const anterior = mapa.get(item.id);
    mapa.set(item.id, anterior ? unirEnderecoEtiqueta(item, anterior) : item);
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
