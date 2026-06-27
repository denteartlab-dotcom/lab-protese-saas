import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { NOME_RESPONSAVEL_LAB_DEMO } from "@/lib/lab-impressao";

export type DadosNomeLaboratorio = {
  nomeLaboratorio?: string | null;
  tipoPessoa?: string;
  nome?: string;
  nomeFantasia?: string;
  razaoSocial?: string;
  responsavel?: string;
  marca?: string;
};

export function normalizarTipoPessoaLab(valor?: string): "Física" | "Jurídica" {
  if (!valor) return "Jurídica";
  const t = valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (t.includes("fis")) return "Física";
  return "Jurídica";
}

export function nomeLaboratorioValido(valor?: string | null) {
  const texto = (valor || "").trim();
  if (!texto) return "";
  if (texto === NOME_LAB_PADRAO) return "";
  if (texto === NOME_RESPONSAVEL_LAB_DEMO) return "";
  return texto;
}

export function nomeExibicaoLaboratorio(config: DadosNomeLaboratorio): string {
  const principal = nomeLaboratorioValido(config.nomeLaboratorio);
  if (principal) return principal;

  const tipo = normalizarTipoPessoaLab(config.tipoPessoa);
  if (tipo === "Física") {
    return nomeLaboratorioValido(config.nome) || nomeLaboratorioValido(config.razaoSocial);
  }

  return (
    nomeLaboratorioValido(config.nomeFantasia) ||
    nomeLaboratorioValido(config.razaoSocial) ||
    nomeLaboratorioValido(config.responsavel) ||
    nomeLaboratorioValido(config.marca)
  );
}

export function garantirNomeLaboratorioParaImpressao<T extends DadosNomeLaboratorio>(
  config: T,
  fallbackEmpresa?: string | null
): T {
  const nome =
    nomeExibicaoLaboratorio(config) || nomeLaboratorioValido(fallbackEmpresa);
  if (!nome) return config;
  return {
    ...config,
    nomeLaboratorio: nome,
    responsavel: nome,
  };
}
