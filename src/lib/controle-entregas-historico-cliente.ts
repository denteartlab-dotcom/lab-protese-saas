import { formatarDataHoraEntrega, type EntregaControle } from "@/lib/controle-entregas";
import { readStorage } from "@/lib/persisted-storage";
import { abrirPdfBlobGerandoNoVisualizadorUnificado } from "@/lib/pdf-viewer-unificado";
import {
  aplicarEnderecoNoHistorico,
  carregarHistoricoEntregas,
  enderecoEtiquetaDeCadastro,
  entregaControleDoHistorico,
  ENTREGAS_HISTORICO_EVENT,
  ENTREGAS_HISTORICO_STORAGE_KEY,
  excluirHistoricoEntrega,
  historicoTemEnderecoEtiqueta,
  mesclarHistorico,
  normalizarHistorico,
  sincronizarHistoricoEntregasCliente,
  type EntregaHistorico,
  type SituacaoHistoricoEntrega,
} from "@/lib/controle-entregas-historico-core";

export {
  ENTREGAS_HISTORICO_EVENT,
  ENTREGAS_HISTORICO_STORAGE_KEY,
  aplicarEnderecoNoHistorico,
  carregarHistoricoEntregas,
  enderecoEtiquetaDeCadastro,
  entregaControleDoHistorico,
  filtrarHistoricoEntregas,
  historicoTemEnderecoEtiqueta,
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

const FORNECEDORES_STORAGE_KEY = "labProteseFornecedores";

type CadastroComEndereco = {
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
};

function mesmoNome(a: string, b: string) {
  return a.trim().toLocaleLowerCase("pt-BR") === b.trim().toLocaleLowerCase("pt-BR");
}

function cadastroPeloNome(lista: CadastroComEndereco[], nome: string) {
  return lista.find((item) => item.nome && mesmoNome(item.nome, nome));
}

async function buscarEnderecoCadastroPorNome(nome: string) {
  const alvo = nome.trim();
  if (!alvo || typeof window === "undefined") return null;

  try {
    const res = await fetch("/api/clientes", { cache: "no-store", credentials: "same-origin" });
    if (res.ok) {
      const data = (await res.json()) as CadastroComEndereco[];
      const cliente = Array.isArray(data) ? cadastroPeloNome(data, alvo) : undefined;
      if (cliente) return enderecoEtiquetaDeCadastro(cliente);
    }
  } catch {
    /* segue para o cadastro local de fornecedor */
  }

  const fornecedores = readStorage<CadastroComEndereco[]>(FORNECEDORES_STORAGE_KEY, []);
  const fornecedor = Array.isArray(fornecedores) ? cadastroPeloNome(fornecedores, alvo) : undefined;
  return fornecedor ? enderecoEtiquetaDeCadastro(fornecedor) : null;
}

/** Entrega do histórico pronta para a mesma impressão de etiqueta da lista. */
export async function entregaParaReimprimirEtiqueta(
  item: EntregaHistorico
): Promise<EntregaControle> {
  let atual = item;
  if (!historicoTemEnderecoEtiqueta(item)) {
    const endereco = await buscarEnderecoCadastroPorNome(item.destinatario);
    if (endereco) atual = aplicarEnderecoNoHistorico(item, endereco);
  }
  return entregaControleDoHistorico(atual);
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

  await abrirPdfBlobGerandoNoVisualizadorUnificado(
    async () => {
      const { gerarHistoricoEntregasPdf } = await import("@/lib/relatorios-impressao-pdf");
      return gerarHistoricoEntregasPdf(
        linhas,
        `Emitido em ${emitidoEm} · ${historico.length} registro(s)`
      );
    },
    "Histórico de entregas",
    "historico-entregas.pdf"
  );
}
