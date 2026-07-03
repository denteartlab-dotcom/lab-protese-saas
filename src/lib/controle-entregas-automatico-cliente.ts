import { entregadorCliente, tipoEntregadorCliente, custoEntregaCliente } from "@/lib/cliente-entrega";
import {
  carregarConfiguracoesGerais,
} from "@/lib/configuracoes-gerais";
import {
  carregarEntregas,
  criarEntrega,
  ENTREGAS_EVENT,
  ENTREGAS_STORAGE_KEY,
  salvarEntregas,
  type EntregaControle,
  type SituacaoEntrega,
} from "@/lib/controle-entregas";
import { aplicarEspelhoServidor } from "@/lib/armazenamento-laboratorio";
import {
  concluirEntregasControlePorNumeroOs,
  STATUS_ENTREGUE_CLIENTE,
} from "@/lib/entrega-trabalho-sync-cliente";
import { sincronizarHistoricoEntregasCliente } from "@/lib/controle-entregas-historico-core";

export type TrabalhoParaControleEntrega = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  valor?: number | null;
  cliente?: {
    nome?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    uf?: string | null;
    cep?: string | null;
    bairro?: string | null;
    complemento?: string | null;
    observacoes?: string | null;
  } | null;
};

export function entregaJaExisteParaOs(lista: EntregaControle[], numeroOs: number) {
  const alvo = String(numeroOs);
  return lista.some((item) => String(item.numeroOs || "").trim() === alvo);
}

export function situacaoInicialEntregaAutomatica(origem?: "status" | "manual"): SituacaoEntrega {
  return origem === "status" ? "em_rota" : "pendente";
}

export function montarEntregaDeTrabalho(
  trabalho: TrabalhoParaControleEntrega,
  situacao: SituacaoEntrega = "pendente"
) {
  const cliente = trabalho.cliente;
  const obs = cliente?.observacoes;
  const entregador = entregadorCliente(obs);
  const tipoEntregador = tipoEntregadorCliente(obs);
  const custoObs = custoEntregaCliente(obs);
  const valor = custoObs > 0 ? custoObs : Number(trabalho.valor) || 0;
  const nome = cliente?.nome?.trim() || "Cliente";
  const agora = new Date().toISOString();

  return {
    dataPedido: agora,
    destinatario: nome,
    entregador,
    descricao: trabalho.tipoProtese?.trim() || "Entrega de prótese",
    situacao,
    valor,
    numeroOs: String(trabalho.numeroOs),
    tipoDestinatario: "cliente" as const,
    nomeDestinatario: nome,
    cep: cliente?.cep?.trim() || "",
    rua: cliente?.endereco?.trim() || "",
    cidade: cliente?.cidade?.trim() || "",
    uf: cliente?.uf?.trim() || "",
    bairro: cliente?.bairro?.trim() || "",
    complemento: cliente?.complemento?.trim() || "",
    dataEntrega: agora,
    hora: new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    tipoEntregador,
    observacao: "",
  };
}

export function deveAdicionarControleEntregasPorStatus(
  statusAnterior: string,
  statusNovo: string
) {
  return statusNovo === "saiu_entrega" && statusAnterior !== "saiu_entrega";
}

export function deveRemoverControleEntregasPorStatus(
  statusAnterior: string,
  statusNovo: string
) {
  return statusAnterior === "saiu_entrega" && statusNovo === "producao";
}

export function filtrarEntregasPorNumeroOs(lista: EntregaControle[], numeroOs: number) {
  const alvo = String(numeroOs);
  return lista.filter((item) => String(item.numeroOs || "").trim() !== alvo);
}

/** Remove do controle de entregas as rotas vinculadas à OS (ex.: voltou para Produção). */
export function removerTrabalhoControleEntregasAutomatico(numeroOs: number) {
  const lista = carregarEntregas();
  const filtrada = filtrarEntregasPorNumeroOs(lista, numeroOs);
  if (filtrada.length === lista.length) return false;
  salvarEntregas(filtrada);
  return true;
}

function controleEntregasAutomaticoDesabilitado(
  opcoes?: { ignorarConfig?: boolean }
) {
  if (opcoes?.ignorarConfig) return false;
  return !carregarConfiguracoesGerais().faturasAdicionarControleEntregas;
}

/** Adiciona ao controle de entregas no navegador (espelho + persistência). */
export function adicionarTrabalhoControleEntregasAutomatico(
  trabalho: TrabalhoParaControleEntrega,
  opcoes?: { ignorarConfig?: boolean; origem?: "status" | "manual" }
) {
  if (controleEntregasAutomaticoDesabilitado(opcoes)) return false;

  const lista = carregarEntregas();
  if (entregaJaExisteParaOs(lista, trabalho.numeroOs)) return false;

  criarEntrega(
    montarEntregaDeTrabalho(trabalho, situacaoInicialEntregaAutomatica(opcoes?.origem))
  );
  return true;
}

function deveArquivarControleEntregasPorStatus(statusNovo: string) {
  const chave = statusNovo.trim().toLowerCase();
  return (
    chave === STATUS_ENTREGUE_CLIENTE ||
    chave === "recebido_cliente" ||
    chave === "entregue"
  );
}

function situacaoArquivoPorStatus(statusNovo: string): "entregue" | "recebido" {
  return statusNovo.trim().toLowerCase() === "recebido_cliente" ? "recebido" : "entregue";
}

/** Após mudar situação da OS (adiciona ou remove do controle de entregas). */
export function aplicarControleEntregaAposMudancaStatus(
  statusAnterior: string,
  statusNovo: string,
  trabalho: TrabalhoParaControleEntrega
) {
  if (deveRemoverControleEntregasPorStatus(statusAnterior, statusNovo)) {
    return removerTrabalhoControleEntregasAutomatico(trabalho.numeroOs);
  }
  if (deveArquivarControleEntregasPorStatus(statusNovo)) {
    const mudou = concluirEntregasControlePorNumeroOs(trabalho.numeroOs, {
      situacao: situacaoArquivoPorStatus(statusNovo),
    });
    void sincronizarEntregasControleCliente();
    void sincronizarHistoricoEntregasCliente();
    return mudou;
  }
  if (!deveAdicionarControleEntregasPorStatus(statusAnterior, statusNovo)) return false;
  return adicionarTrabalhoControleEntregasAutomatico(trabalho, { origem: "status" });
}

/** Atualiza o espelho local com entregas gravadas no servidor (outra aba / API). */
export async function sincronizarEntregasControleCliente(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch(
      `/api/json-store/${encodeURIComponent(ENTREGAS_STORAGE_KEY)}`,
      { cache: "no-store", credentials: "same-origin" }
    );
    if (!res.ok) return false;
    const lista = await res.json();
    if (!Array.isArray(lista)) return false;
    aplicarEspelhoServidor(ENTREGAS_STORAGE_KEY, lista);
    window.dispatchEvent(new Event(ENTREGAS_EVENT));
    return true;
  } catch {
    return false;
  }
}
