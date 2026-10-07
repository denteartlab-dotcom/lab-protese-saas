import { parseBrDate } from "@/lib/datas-br";

export const DIA_PAGAMENTO_COMISSAO_PADRAO = 10;
export const DIA_PAGAMENTO_COMISSAO_MAX = 31;

/** Dia de vencimento da comissão no mês seguinte (1–31, padrão 10). */
export function diaPagamentoComissaoNormalizado(valor?: string | number | null): number {
  const n = typeof valor === "number" ? valor : Number(String(valor || "").replace(/\D/g, ""));
  if (!Number.isFinite(n) || n <= 0) return DIA_PAGAMENTO_COMISSAO_PADRAO;
  return Math.min(DIA_PAGAMENTO_COMISSAO_MAX, Math.max(1, Math.round(n)));
}

export function slugColaboradorComissao(nome: string) {
  const slug = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "colaborador";
}

/** Referência estável da despesa mensal: comissao-colab:{slug}:{yyyy-mm}. */
export function referenciaDespesaComissaoColaborador(nome: string, mesCompetencia: string) {
  return `comissao-colab:${slugColaboradorComissao(nome)}:${mesCompetencia}`;
}

export function ehReferenciaDespesaComissaoColaborador(referencia?: string | null) {
  return /^comissao-colab:[a-z0-9-]+:\d{4}-\d{2}$/.test((referencia || "").trim());
}

export function mesCompetenciaDeData(data: Date) {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function mesCompetenciaDeDataBr(value?: string | null, fallback = new Date()) {
  const parsed = value ? parseBrDate(value) : null;
  return mesCompetenciaDeData(parsed || fallback);
}

/** Vencimento no mês seguinte à competência, no dia cadastrado (até o último dia do mês). */
export function dataVencimentoComissaoMensal(
  mesCompetencia: string,
  diaPagamento = DIA_PAGAMENTO_COMISSAO_PADRAO
): string {
  const match = mesCompetencia.match(/^(\d{4})-(\d{2})$/);
  const agora = new Date();
  const ano = match ? Number(match[1]) : agora.getFullYear();
  const mes = match ? Number(match[2]) : agora.getMonth() + 1;
  const mesPagamento = mes === 12 ? 1 : mes + 1;
  const anoPagamento = mes === 12 ? ano + 1 : ano;
  const ultimoDia = new Date(anoPagamento, mesPagamento, 0).getDate();
  const dia = Math.min(diaPagamentoComissaoNormalizado(diaPagamento), ultimoDia);
  return `${anoPagamento}-${String(mesPagamento).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function nomeMesCompetenciaPt(mesCompetencia: string) {
  const match = mesCompetencia.match(/^(\d{4})-(\d{2})$/);
  if (!match) return mesCompetencia;
  const data = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  const nome = data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export function descricaoDespesaComissaoColaborador(nome: string, mesCompetencia: string) {
  return `Comissão ${nome} — ${nomeMesCompetenciaPt(mesCompetencia)}`;
}
