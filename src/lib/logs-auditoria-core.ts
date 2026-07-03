import { rotuloPapelUsuario } from "@/lib/auth-client";
import { textoParcelaLog } from "@/lib/fatura-financeiro-util";
import { dateToBrShort } from "@/lib/datas-br";
import { rotuloTipoUsuario } from "@/lib/usuarios-sistema";
import { formatCurrency } from "@/lib/utils";

function normalizarTextoComparacao(texto: string) {
  return texto.trim().normalize("NFC").toLowerCase();
}

const ROTULOS_TIPO_CONTA = new Set(
  [
    "Proprietário",
    "Administrador",
    "Gerente",
    "Financeiro",
    "Produção",
    "Usuário",
    "proprietario",
    "administrador",
    "gerente",
    "financeiro",
    "producao",
    "usuario",
    "admin",
  ].map((s) => normalizarTextoComparacao(s))
);

export function nomePareceTipoConta(name: string, role: string) {
  const n = normalizarTextoComparacao(name);
  if (!n) return false;
  if (ROTULOS_TIPO_CONTA.has(n)) return true;
  const porRole = [rotuloTipoUsuario(role), rotuloPapelUsuario(role)]
    .filter(Boolean)
    .map((s) => normalizarTextoComparacao(s));
  return porRole.includes(n);
}

function nomeAPartirDoEmail(email: string) {
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (!local) return "";
  return local.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Nome para exibição em logs (evita gravar/exibir tipo de conta como nome). */
export function nomeExibicaoUsuarioLog(user: {
  name: string;
  email: string;
  role: string;
  colaboradorNome?: string | null;
}) {
  const colab = user.colaboradorNome?.trim();
  if (colab && !nomePareceTipoConta(colab, user.role)) return colab;

  const name = user.name.trim();
  if (name && !nomePareceTipoConta(name, user.role)) return name;

  const doEmail = nomeAPartirDoEmail(user.email);
  if (doEmail && !nomePareceTipoConta(doEmail, "")) return doEmail;

  const emailLocal = user.email.split("@")[0]?.trim();
  if (emailLocal && !nomePareceTipoConta(emailLocal, "")) return emailLocal;

  return "Usuário";
}

export const CATEGORIAS_LOG_AUDITORIA = [
  { value: "os", label: "Ordem de Serviço" },
  { value: "financeiro_receitas_parcelas", label: "Financeiro Receitas (parcelas)" },
  { value: "financeiro_receitas_recebimentos", label: "Financeiro Receitas (recebimentos)" },
  { value: "boletos", label: "Boletos" },
  { value: "despesas", label: "Despesas" },
  { value: "despesas_pagamentos_parcelas", label: "Despesas/Pagamentos/Parcelas" },
  { value: "etapas", label: "Etapas" },
  { value: "acertos", label: "Acertos" },
] as const;

export type CategoriaLogAuditoria = (typeof CATEGORIAS_LOG_AUDITORIA)[number]["value"];

export const TIPOS_ALTERACAO_LOG = [
  { value: "todos", label: "Todas" },
  { value: "alteracao", label: "Alteração" },
  { value: "inclusao", label: "Criação" },
  { value: "exclusao", label: "Exclusão" },
] as const;

export type DetalheAlteracaoAuditoria = {
  campo: string;
  antes: string;
  depois: string;
};

export type LogAuditoriaLinha = {
  id: string;
  trabalhoId: string | null;
  numeroOs: number | null;
  servico: string | null;
  etapa: string | null;
  colaborador: string | null;
  clienteNome: string | null;
  referencia: string | null;
  parcelaNumero: number | null;
  parcelaTotal: number | null;
  lancamentoId: string | null;
  numeroFatura: number | null;
  dataAlteracao: string;
  dataAlteracaoFormatada: string;
  usuarioNome: string;
  tipoAlteracao: string;
  tipoAlteracaoLabel: string;
  categoria: string;
  detalhes: DetalheAlteracaoAuditoria[] | null;
};

const CATEGORIAS_LAYOUT_FINANCEIRO = new Set<string>([
  "financeiro_receitas_parcelas",
  "financeiro_receitas_recebimentos",
  "boletos",
  "despesas",
  "despesas_pagamentos_parcelas",
  "acertos",
]);

export function layoutTabelaLogsAuditoria(categoria: string): "etapas" | "financeiro" | "os" {
  if (categoria === "etapas") return "etapas";
  if (CATEGORIAS_LAYOUT_FINANCEIRO.has(categoria)) return "financeiro";
  if (categoria === "os") return "os";
  return "financeiro";
}

export function labelFiltroReferencia(categoria: string) {
  return layoutTabelaLogsAuditoria(categoria) === "financeiro"
    ? "Nº da Fatura"
    : "Nº de OS";
}

/** Código numérico de 7 dígitos para exibição (estilo Smart Prótese). */
export function codigoLogEntidade(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return String((hash % 9_000_000) + 1_000_000);
}

export function formatServicoLogAuditoria(nome: string, trabalhoId: string) {
  const nomeLimpo = nome.trim();
  const codigo = codigoLogEntidade(trabalhoId);
  return nomeLimpo ? `${nomeLimpo} - ${codigo}` : codigo;
}

export function formatClienteLogAuditoria(
  nome: string | null | undefined,
  clienteId: string
) {
  const nomeLimpo = (nome || "").trim() || "—";
  return `${nomeLimpo} - ${codigoLogEntidade(clienteId)}`;
}

export function textoServicoLog(
  linha: Pick<LogAuditoriaLinha, "servico" | "trabalhoId">
) {
  const servico = linha.servico?.trim();
  if (!servico) return "—";
  if (servico.includes(" - ")) return servico;
  if (linha.trabalhoId) return formatServicoLogAuditoria(servico, linha.trabalhoId);
  return servico;
}

export function textoClienteLog(linha: Pick<LogAuditoriaLinha, "clienteNome">) {
  return linha.clienteNome?.trim() || "—";
}

/** Cliente na grade financeira (sem código auxiliar). */
export { textoParcelaLog };

export function textoClienteLogFinanceiro(linha: Pick<LogAuditoriaLinha, "clienteNome">) {
  const nome = linha.clienteNome?.trim() || "—";
  const idx = nome.lastIndexOf(" - ");
  if (idx > 0 && /^\d{7}$/.test(nome.slice(idx + 3))) {
    return nome.slice(0, idx).trim() || "—";
  }
  return nome;
}

export function abreviarEtapa(nome: string | null | undefined) {
  const t = (nome || "").trim();
  if (!t) return "—";
  if (t.length <= 4) return t;
  return t.slice(0, 3);
}

export function labelTipoAlteracaoLog(tipo: string) {
  if (tipo === "inclusao") return "Criação";
  if (tipo === "exclusao") return "Exclusão";
  return "Alteração";
}

export function corTipoAlteracaoLog(tipo: string) {
  if (tipo === "inclusao") return "text-[#27ae60]";
  if (tipo === "exclusao") return "text-[#e74c3c]";
  return "text-[#e67e22]";
}

/** Badge pill: criação verde, alteração laranja, exclusão vermelho claro (referência Smart). */
export function badgeTipoAlteracaoLog(tipo: string) {
  const base =
    "inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-bold leading-none";
  if (tipo === "inclusao") {
    return `${base} bg-[#e8f8ef] text-[#27ae60]`;
  }
  if (tipo === "exclusao") {
    return `${base} bg-[#fdecea] text-[#e74c3c]`;
  }
  return `${base} bg-[#fef5e7] text-[#e67e22]`;
}

export function rotuloOpcaoLog(tipo: string) {
  return tipo === "alteracao" ? "Ver Alterações" : "Ver Detalhes";
}

/** Campo de valor monetário no modal de alterações. */
export function ehCampoValorLog(campo: string) {
  return /^valor(\s|$)/i.test(campo.trim());
}

function parseNumeroMonetarioLog(texto: string): number | null {
  const bruto = texto.trim();
  if (!bruto || bruto === "—" || bruto === "-") return null;

  const semMoeda = bruto.replace(/R\$\s?/gi, "").trim();
  if (!semMoeda) return null;

  if (semMoeda.includes(",")) {
    const n = Number(semMoeda.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  const n = Number(semMoeda.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Exibe valores do log em R$ com 2 decimais quando o campo for Valor. */
export function formatarValorCampoLog(campo: string, valor: string) {
  if (!ehCampoValorLog(campo)) return valor;
  const n = parseNumeroMonetarioLog(valor);
  if (n == null) return valor;
  return formatCurrency(n);
}

export function formatarDataHoraLog(data: Date) {
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function parseDetalhesLog(json: string | null | undefined): DetalheAlteracaoAuditoria[] | null {
  if (!json?.trim()) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (item): item is DetalheAlteracaoAuditoria =>
        typeof item === "object" &&
        item !== null &&
        "campo" in item &&
        "antes" in item &&
        "depois" in item
    );
  } catch {
    return null;
  }
}

export function mapLogAuditoriaRow(row: {
  id: string;
  categoria: string;
  tipoAlteracao: string;
  trabalhoId: string | null;
  numeroOs: number | null;
  servico: string | null;
  etapa: string | null;
  colaborador: string | null;
  clienteNome: string | null;
  referencia: string | null;
  parcelaNumero: number | null;
  parcelaTotal: number | null;
  lancamentoId: string | null;
  usuarioNome: string;
  dataAlteracao: Date;
  detalhesJson: string | null;
}): LogAuditoriaLinha {
  return {
    id: row.id,
    trabalhoId: row.trabalhoId,
    numeroOs: row.numeroOs,
    servico: row.servico,
    etapa: row.etapa,
    colaborador: row.colaborador,
    clienteNome: row.clienteNome,
    referencia: row.referencia,
    parcelaNumero: row.parcelaNumero,
    parcelaTotal: row.parcelaTotal,
    lancamentoId: row.lancamentoId,
    numeroFatura: null,
    dataAlteracao: row.dataAlteracao.toISOString(),
    dataAlteracaoFormatada: formatarDataHoraLog(row.dataAlteracao),
    usuarioNome: row.usuarioNome,
    tipoAlteracao: row.tipoAlteracao,
    tipoAlteracaoLabel: labelTipoAlteracaoLog(row.tipoAlteracao),
    categoria: row.categoria,
    detalhes: parseDetalhesLog(row.detalhesJson),
  };
}

export type FiltrosLogsAuditoria = {
  categoria: string;
  tipoAlteracao: string;
  referencia: string;
  periodo: string;
  dataInicio: string;
  dataFim: string;
};

export function aplicarPeriodoLogsAuditoria(value: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (value === "todos" || value === "outro") {
    return { dataInicio: "", dataFim: "" };
  }
  const inicio = new Date(hoje);
  const fim = new Date(hoje);
  if (value === "semana") {
    const dia = hoje.getDay();
    inicio.setDate(hoje.getDate() - dia);
    fim.setDate(inicio.getDate() + 6);
  } else if (value === "mes") {
    inicio.setDate(1);
    fim.setMonth(hoje.getMonth() + 1, 0);
  } else if (value === "proximos30") {
    fim.setDate(hoje.getDate() + 30);
  }
  return {
    dataInicio: dateToBrShort(inicio),
    dataFim: dateToBrShort(fim),
  };
}
