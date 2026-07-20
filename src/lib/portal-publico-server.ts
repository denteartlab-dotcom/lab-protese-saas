import {
  MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO,
  montarAcompanhamentoPublico,
} from "@/lib/cliente-acompanhamento";
import {
  buscarRegistroExtratoPublicaPorToken,
  PREFIXO_JSON_STORE_EXTRATO_PUBLICA,
  registroExtratoPublicaValido,
} from "@/lib/extrato-publica";
import {
  buscarRegistroFaturaPublicaPorToken,
  PREFIXO_JSON_STORE_FATURA_PUBLICA,
  registroFaturaPublicaValido,
} from "@/lib/fatura-publica";
import {
  brandingPlataformaLogin,
  carregarBrandingLaboratorioPorEmpresaId,
} from "@/lib/lab-branding";
import { runWithTenantContext } from "@/lib/db";
import { resolverEmpresaIdJsonStorePublico } from "@/lib/json-store-tenant";
import { mapOrcamento } from "@/lib/orcamentos-db";
import { linkOrcamentoAtivo } from "@/lib/orcamentos-types";
import type {
  PortalPublicoPagina,
  TipoPortalPublico,
} from "@/lib/portal-publico-types";
import { carregarStoreRecebimentosCliente } from "@/lib/recebimento-cliente";
import { carregarStoreObservacoesCliente } from "@/lib/observacao-cliente-trabalho";
import {
  buscarClientePublicoPorToken,
  buscarOrcamentoPublicoPorToken,
} from "@/lib/tenant-db";
import { carregarStoreUrgenciasCliente } from "@/lib/urgencia-cliente";

export const MENSAGEM_PORTAL_PUBLICO_INDISPONIVEL =
  "Link inválido ou indisponível.";

export class PortalPublicoErro extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "PortalPublicoErro";
  }
}

async function brandingParaEmpresa(empresaId: string | null) {
  if (!empresaId) return brandingPlataformaLogin();
  return carregarBrandingLaboratorioPorEmpresaId(empresaId);
}

async function montarAcompanhamento(token: string): Promise<PortalPublicoPagina> {
  const resultado = await buscarClientePublicoPorToken(token);
  if (!resultado) {
    throw new PortalPublicoErro(MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO, 404, "nao_encontrado");
  }

  const { cliente, trabalhos, labNome, mapaEtapas } = resultado;
  const [storeUrgencias, storeRecebimentos, storeObservacoes, lab] = await runWithTenantContext(
    cliente.empresaId,
    () =>
      Promise.all([
        carregarStoreUrgenciasCliente(cliente.empresaId),
        carregarStoreRecebimentosCliente(cliente.empresaId),
        carregarStoreObservacoesCliente(cliente.empresaId),
        brandingParaEmpresa(cliente.empresaId),
      ])
  );

  const entidade = montarAcompanhamentoPublico(
    {
      id: cliente.id,
      nome: cliente.nome,
      razaoSocial: cliente.razaoSocial,
      observacoes: cliente.observacoes,
    },
    trabalhos,
    labNome,
    mapaEtapas,
    storeUrgencias.eventos,
    storeRecebimentos.eventos,
    storeObservacoes.eventos.filter((evento) => evento.clienteId === cliente.id)
  );

  return {
    tipo: "acompanhamento",
    lab,
    acoes: {
      podeMarcarUrgente: true,
      podeRemoverUrgente: true,
      podeConfirmarRecebido: true,
    },
    entidade,
  };
}

async function montarOrcamento(token: string): Promise<PortalPublicoPagina> {
  const encontrado = await buscarOrcamentoPublicoPorToken(token);
  if (!encontrado) {
    throw new PortalPublicoErro(MENSAGEM_PORTAL_PUBLICO_INDISPONIVEL, 404, "nao_encontrado");
  }

  const orcamento = mapOrcamento(encontrado.orcamento);
  const ativo = linkOrcamentoAtivo(orcamento.status, orcamento.linkAtivo);
  if (!ativo) {
    throw new PortalPublicoErro(
      "Este link de orçamento não está mais disponível.",
      410,
      "link_expirado"
    );
  }

  const lab = await brandingParaEmpresa(encontrado.orcamento.empresaId);

  return {
    tipo: "orcamento",
    lab,
    acoes: {
      podeEnviarOrcamento: orcamento.status === "aguardando_resposta",
    },
    entidade: orcamento,
  };
}

async function montarFatura(token: string): Promise<PortalPublicoPagina> {
  const registro = await buscarRegistroFaturaPublicaPorToken(token);
  if (!registro) {
    throw new PortalPublicoErro(MENSAGEM_PORTAL_PUBLICO_INDISPONIVEL, 404, "nao_encontrado");
  }
  if (!registroFaturaPublicaValido(registro)) {
    throw new PortalPublicoErro("Link expirado.", 410, "link_expirado");
  }
  if (!registro.base64) {
    throw new PortalPublicoErro(
      "Fatura publicada sem PDF. Gere um novo link pelo laboratório.",
      404,
      "pdf_ausente"
    );
  }

  const empresaId = await resolverEmpresaIdJsonStorePublico(
    token,
    PREFIXO_JSON_STORE_FATURA_PUBLICA
  );
  const lab = await brandingParaEmpresa(empresaId);

  return {
    tipo: "fatura",
    lab,
    acoes: { podeBaixarPdf: true, podeImprimir: true },
    entidade: {
      titulo: registro.titulo,
      nomeArquivo: registro.nomeArquivo,
      numeroFatura: registro.numeroFatura,
      clienteNome: registro.clienteNome,
    },
    pdf: {
      base64: registro.base64,
      nomeArquivo: registro.nomeArquivo || "fatura.pdf",
      contentType: "application/pdf",
    },
  };
}

async function montarExtrato(token: string): Promise<PortalPublicoPagina> {
  const registro = await buscarRegistroExtratoPublicaPorToken(token);
  if (!registro) {
    throw new PortalPublicoErro(MENSAGEM_PORTAL_PUBLICO_INDISPONIVEL, 404, "nao_encontrado");
  }
  if (!registroExtratoPublicaValido(registro)) {
    throw new PortalPublicoErro("Link expirado.", 410, "link_expirado");
  }
  if (!registro.base64) {
    throw new PortalPublicoErro(
      "Extrato publicado sem PDF. Gere um novo link pelo laboratório.",
      404,
      "pdf_ausente"
    );
  }

  const empresaId = await resolverEmpresaIdJsonStorePublico(
    token,
    PREFIXO_JSON_STORE_EXTRATO_PUBLICA
  );
  const lab = await brandingParaEmpresa(empresaId);

  return {
    tipo: "extrato",
    lab,
    acoes: { podeBaixarPdf: true, podeImprimir: true },
    entidade: {
      titulo: registro.titulo,
      nomeArquivo: registro.nomeArquivo,
      clienteNome: registro.clienteNome,
    },
    pdf: {
      base64: registro.base64,
      nomeArquivo: registro.nomeArquivo || "extrato.pdf",
      contentType: "application/pdf",
    },
  };
}

export async function montarPortalPublico(
  tipo: TipoPortalPublico,
  token: string
): Promise<PortalPublicoPagina> {
  const limpo = token.trim();
  if (!limpo) {
    throw new PortalPublicoErro(MENSAGEM_PORTAL_PUBLICO_INDISPONIVEL, 404, "token_invalido");
  }

  switch (tipo) {
    case "acompanhamento":
      return montarAcompanhamento(limpo);
    case "orcamento":
      return montarOrcamento(limpo);
    case "fatura":
      return montarFatura(limpo);
    case "extrato":
      return montarExtrato(limpo);
    default: {
      const _exhaustive: never = tipo;
      throw new PortalPublicoErro(MENSAGEM_PORTAL_PUBLICO_INDISPONIVEL, 400, "tipo_invalido");
    }
  }
}
