import { entregadorCliente, tipoEntregadorCliente, custoEntregaCliente } from "@/lib/cliente-entrega";
import {
  carregarConfiguracoesGerais,
  CONFIG_GERAIS_STORAGE_KEY,
  normalizarConfiguracoesGerais,
  type ConfiguracoesGerais,
} from "@/lib/configuracoes-gerais";
import {
  carregarEntregas,
  criarEntrega,
  ENTREGAS_EVENT,
  ENTREGAS_STORAGE_KEY,
  type EntregaControle,
} from "@/lib/controle-entregas";
import { aplicarEspelhoServidor } from "@/lib/armazenamento-laboratorio";
import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";

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

function entregaJaExisteParaOs(lista: EntregaControle[], numeroOs: number) {
  const alvo = String(numeroOs);
  return lista.some((item) => String(item.numeroOs || "").trim() === alvo);
}

function montarEntregaDeTrabalho(trabalho: TrabalhoParaControleEntrega) {
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
    situacao: "pendente" as const,
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

function exigeConfigFaturasControleEntregas(
  opcoes?: { ignorarConfig?: boolean; origem?: "status" | "manual" }
) {
  if (opcoes?.origem === "status" || opcoes?.ignorarConfig) return false;
  const config = carregarConfiguracoesGerais();
  return !config.faturasAdicionarControleEntregas;
}

/** Adiciona ao controle de entregas no navegador (espelho + persistência). */
export function adicionarTrabalhoControleEntregasAutomatico(
  trabalho: TrabalhoParaControleEntrega,
  opcoes?: { ignorarConfig?: boolean; origem?: "status" | "manual" }
) {
  if (exigeConfigFaturasControleEntregas(opcoes)) return false;

  const lista = carregarEntregas();
  if (entregaJaExisteParaOs(lista, trabalho.numeroOs)) return false;

  criarEntrega(montarEntregaDeTrabalho(trabalho));
  return true;
}

/** Após mudar situação da OS para Saiu para Entrega (produção). */
export function aplicarControleEntregaAposMudancaStatus(
  statusAnterior: string,
  statusNovo: string,
  trabalho: TrabalhoParaControleEntrega
) {
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

/** Persiste no JsonStore do tenant (API / TV / múltiplas abas). */
export async function adicionarTrabalhoControleEntregasAutomaticoServidor(
  empresaId: string,
  trabalho: TrabalhoParaControleEntrega,
  opcoes?: { origem?: "status" | "manual" }
) {
  if (opcoes?.origem !== "status") {
    const configRaw = await lerJsonStoreTenant(empresaId, CONFIG_GERAIS_STORAGE_KEY);
    const config = normalizarConfiguracoesGerais(
      configRaw as Partial<ConfiguracoesGerais> | null
    );
    if (!config.faturasAdicionarControleEntregas) return false;
  }

  const lista =
    (await lerJsonStoreTenant<EntregaControle[]>(empresaId, ENTREGAS_STORAGE_KEY)) ?? [];
  const normalizada = Array.isArray(lista) ? lista : [];
  if (entregaJaExisteParaOs(normalizada, trabalho.numeroOs)) return false;

  const nova: EntregaControle = {
    id: `ent-${Date.now()}-${trabalho.id.slice(0, 8)}`,
    ...montarEntregaDeTrabalho(trabalho),
  };

  await salvarJsonStoreTenant(empresaId, ENTREGAS_STORAGE_KEY, [...normalizada, nova]);
  return true;
}
