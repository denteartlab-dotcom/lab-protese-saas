import type {
  FornecedorImportPayload,
  ResultadoImportacaoFornecedores,
} from "@/lib/fornecedores-import-schema";
import type { FornecedorImportacaoLinha } from "@/lib/fornecedores-lista-export";
import { aguardarJobCliente, ErroJobCliente, type OpcoesPollingJobCliente } from "@/lib/jobs/polling-cliente";

type IniciarImportacaoResposta = {
  jobId?: string;
  error?: string;
};

export function fornecedorImportacaoParaPayload(
  linha: FornecedorImportacaoLinha
): FornecedorImportPayload {
  return {
    nome: linha.nome,
    contato: linha.contato || undefined,
    celular: linha.celular || undefined,
    whatsapp: linha.whatsapp || undefined,
    email: linha.email || undefined,
    cpf: linha.cpf || undefined,
    cnpj: linha.cnpj || undefined,
    categoria: linha.categoria || undefined,
    telefoneResidencial: linha.telefoneResidencial || undefined,
    telefoneComercial: linha.telefoneComercial || undefined,
    cep: linha.cep || undefined,
    rua: linha.rua || undefined,
    numero: linha.numero || undefined,
    cidade: linha.cidade || undefined,
    uf: linha.uf || undefined,
    bairro: linha.bairro || undefined,
    complemento: linha.complemento || undefined,
    representanteTelefoneComercial: linha.representanteTelefoneComercial || undefined,
    representanteWhatsapp: linha.representanteWhatsapp || undefined,
    representanteEmail: linha.representanteEmail || undefined,
  };
}

/** POST /api/fornecedores/import + polling até concluir (issue 012). */
export async function importarFornecedoresComJob(
  fornecedores: FornecedorImportPayload[],
  opcoes?: OpcoesPollingJobCliente
): Promise<ResultadoImportacaoFornecedores> {
  let res: Response;
  try {
    res = await fetch("/api/fornecedores/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      signal: opcoes?.signal,
      body: JSON.stringify({ fornecedores }),
    });
  } catch {
    throw new ErroJobCliente("Erro de conexão ao iniciar a importação.", "rede");
  }

  const data = (await res.json().catch(() => ({}))) as IniciarImportacaoResposta;
  if (!res.ok || !data.jobId) {
    throw new ErroJobCliente(data.error || "Não foi possível iniciar a importação.", "rede");
  }

  const job = await aguardarJobCliente(data.jobId, opcoes);
  const resultado = job.resultado as ResultadoImportacaoFornecedores | undefined;
  if (!resultado || typeof resultado.ok !== "number") {
    throw new ErroJobCliente("Resposta da importação inválida.", "falhou");
  }

  return {
    ...resultado,
    erros: resultado.erros ?? [],
  };
}

export { ErroJobCliente };
