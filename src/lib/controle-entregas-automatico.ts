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
  ENTREGAS_STORAGE_KEY,
  type EntregaControle,
} from "@/lib/controle-entregas";
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

/** Adiciona ao controle de entregas no navegador (espelho + persistência). */
export function adicionarTrabalhoControleEntregasAutomatico(
  trabalho: TrabalhoParaControleEntrega,
  opcoes?: { ignorarConfig?: boolean }
) {
  if (!opcoes?.ignorarConfig) {
    const config = carregarConfiguracoesGerais();
    if (!config.faturasAdicionarControleEntregas) return false;
  }

  const lista = carregarEntregas();
  if (entregaJaExisteParaOs(lista, trabalho.numeroOs)) return false;

  criarEntrega(montarEntregaDeTrabalho(trabalho));
  return true;
}

/** Persiste no JsonStore do tenant (API / TV / múltiplas abas). */
export async function adicionarTrabalhoControleEntregasAutomaticoServidor(
  empresaId: string,
  trabalho: TrabalhoParaControleEntrega
) {
  const configRaw = await lerJsonStoreTenant(empresaId, CONFIG_GERAIS_STORAGE_KEY);
  const config = normalizarConfiguracoesGerais(
    configRaw as Partial<ConfiguracoesGerais> | null
  );
  if (!config.faturasAdicionarControleEntregas) return false;

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
