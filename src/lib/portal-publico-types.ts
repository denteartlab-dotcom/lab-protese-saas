import type { ClienteAcompanhamentoPublico } from "@/lib/cliente-acompanhamento-cliente";
import type { LabBrandingPublico } from "@/lib/lab-branding-types";
import type { Orcamento } from "@/lib/orcamentos-types";

export type TipoPortalPublico = "acompanhamento" | "orcamento" | "fatura" | "extrato";

export const TIPOS_PORTAL_PUBLICO = [
  "acompanhamento",
  "orcamento",
  "fatura",
  "extrato",
] as const satisfies readonly TipoPortalPublico[];

export type PortalPublicoAcoes = {
  podeMarcarUrgente?: boolean;
  podeRemoverUrgente?: boolean;
  podeConfirmarRecebido?: boolean;
  podeEnviarOrcamento?: boolean;
  podeBaixarPdf?: boolean;
  podeImprimir?: boolean;
};

export type PortalPublicoPdf = {
  base64: string;
  nomeArquivo: string;
  contentType: "application/pdf";
};

export type PortalPublicoFaturaEntidade = {
  titulo: string;
  nomeArquivo: string;
  numeroFatura: number;
  clienteNome: string;
};

export type PortalPublicoExtratoEntidade = {
  titulo: string;
  nomeArquivo: string;
  clienteNome: string;
};

export type PortalPublicoPaginaAcompanhamento = {
  tipo: "acompanhamento";
  lab: LabBrandingPublico;
  acoes: PortalPublicoAcoes;
  entidade: ClienteAcompanhamentoPublico;
};

export type PortalPublicoPaginaOrcamento = {
  tipo: "orcamento";
  lab: LabBrandingPublico;
  acoes: PortalPublicoAcoes;
  entidade: Orcamento;
};

export type PortalPublicoPaginaFatura = {
  tipo: "fatura";
  lab: LabBrandingPublico;
  acoes: PortalPublicoAcoes;
  entidade: PortalPublicoFaturaEntidade;
  pdf: PortalPublicoPdf;
};

export type PortalPublicoPaginaExtrato = {
  tipo: "extrato";
  lab: LabBrandingPublico;
  acoes: PortalPublicoAcoes;
  entidade: PortalPublicoExtratoEntidade;
  pdf: PortalPublicoPdf;
};

export type PortalPublicoPagina =
  | PortalPublicoPaginaAcompanhamento
  | PortalPublicoPaginaOrcamento
  | PortalPublicoPaginaFatura
  | PortalPublicoPaginaExtrato;

export function tipoPortalPublicoValido(valor: string): valor is TipoPortalPublico {
  return (TIPOS_PORTAL_PUBLICO as readonly string[]).includes(valor);
}
