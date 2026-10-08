import { parseCurrencyBr } from "@/lib/cliente-financeiro";

export const TIPOS_CONTRATACAO_COLABORADOR = [
  "Salário",
  "Comissão",
  "Salário + Comissão",
  "Diária",
  "Diária + Comissão",
] as const;

export type TipoContratacaoColaborador = (typeof TIPOS_CONTRATACAO_COLABORADOR)[number];

export function formatValorMonetarioInput(value: string): string {
  const amount = Number(value.replace(/\D/g, "")) / 100;
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseValorNumericoBr(value: string): number {
  return parseCurrencyBr(value);
}

function textoTipoContratacao(tipo: string): string {
  return (tipo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Valores canônicos em português, inclusive rótulos antigos traduzidos. */
export function normalizarTipoContratacaoCadastro(tipo: string): TipoContratacaoColaborador {
  const n = textoTipoContratacao(tipo);
  if (!n) return "Salário";
  if (n === "terceirizado") return "Salário + Comissão";
  const temDiaria = n.includes("diaria") || n.includes("daily");
  const temComissao = n.includes("comiss") || n.includes("commission") || n.includes("comision");
  const temSalario = n.includes("salar") || n.includes("salary");
  if (temDiaria && temComissao) return "Diária + Comissão";
  if (n === "diaria" || n === "daily rate" || n === "daily" || temDiaria) return "Diária";
  if (temSalario && temComissao) return "Salário + Comissão";
  if (n === "comissao" || n === "commission" || n === "comision" || (temComissao && !temSalario && !temDiaria)) {
    return "Comissão";
  }
  if (n === "salario" || n === "salary" || temSalario) return "Salário";
  return "Salário";
}

export function usaSalarioColaborador(tipo: string): boolean {
  const n = normalizarTipoContratacaoCadastro(tipo);
  return n === "Salário" || n === "Salário + Comissão";
}

export function usaComissaoColaborador(tipo: string): boolean {
  const n = normalizarTipoContratacaoCadastro(tipo);
  return n === "Comissão" || n === "Salário + Comissão" || n === "Diária + Comissão";
}

export function usaDiariaColaborador(tipo: string): boolean {
  const n = normalizarTipoContratacaoCadastro(tipo);
  return n === "Diária" || n === "Diária + Comissão";
}

export function calcularComissaoTrabalho(
  valorTrabalho: number,
  valorTexto: string,
  tipo: string
): number {
  if (tipo === "R$") return parseValorNumericoBr(valorTexto);
  return valorTrabalho * (parseValorNumericoBr(valorTexto) / 100);
}

/** Comissão monetária sobre o total de serviços (sem produtos/transporte). */
export function calcularComissaoSobreServicos(
  valorTotalServicos: number,
  valorCadastro: string,
  tipo: string
): number {
  const base = Math.max(0, Number(valorTotalServicos) || 0);
  return calcularComissaoTrabalho(base, valorCadastro || "0", tipo === "R$" ? "R$" : "%");
}

/** Exibe o valor calculado da comissão (sempre em R$). */
export function formatarComissaoCalculadaExibicao(valorCalculado: number): string {
  return Math.max(0, valorCalculado).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatarValorMonetarioBr(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarSalarioExibicao(valorSalario: string): string {
  return formatarValorMonetarioBr(parseValorNumericoBr(valorSalario));
}

type DadosExemploRemuneracao = {
  tipoContratacao: string;
  valorSalario: string;
  valorDiaria?: string;
  valorComissao: string;
  tipoValorComissao: string;
  comissaoRepeticao: string;
  tipoValorComissaoRepeticao: string;
};

function textoComissaoSobreTrabalho(
  valorTexto: string,
  tipo: string,
  valorCalculado: number,
  valorTrabalho: number
): string {
  const trabalhoFmt = formatarValorMonetarioBr(valorTrabalho);
  const comissaoFmt = formatarValorMonetarioBr(valorCalculado);
  if (tipo === "R$") return `${comissaoFmt} por trabalho`;
  return `${valorTexto}% sobre o trabalho (${comissaoFmt} em um trabalho de ${trabalhoFmt})`;
}

export function montarTextoExemploRemuneracao(
  dados: DadosExemploRemuneracao,
  valorTrabalho = 1000
): string {
  const salario = parseValorNumericoBr(dados.valorSalario);
  const comum = calcularComissaoTrabalho(valorTrabalho, dados.valorComissao, dados.tipoValorComissao);
  const rep = calcularComissaoTrabalho(
    valorTrabalho,
    dados.comissaoRepeticao,
    dados.tipoValorComissaoRepeticao
  );
  const trabalhoFmt = formatarValorMonetarioBr(valorTrabalho);
  const comumFmt = textoComissaoSobreTrabalho(
    dados.valorComissao,
    dados.tipoValorComissao,
    comum,
    valorTrabalho
  );
  const repFmt = textoComissaoSobreTrabalho(
    dados.comissaoRepeticao,
    dados.tipoValorComissaoRepeticao,
    rep,
    valorTrabalho
  );

  const tipo = normalizarTipoContratacaoCadastro(dados.tipoContratacao);
  const diaria = parseValorNumericoBr(dados.valorDiaria || "0,00");
  const diariaFmt = formatarValorMonetarioBr(diaria);

  if (tipo === "Salário") {
    return `Remuneração fixa mensal de ${formatarValorMonetarioBr(salario)}. Comissão não se aplica neste tipo de contratação.`;
  }

  if (tipo === "Comissão") {
    return `A comissão será aplicada sobre os trabalhos. No comum, ${comumFmt}; na repetição, ${repFmt}.`;
  }

  if (tipo === "Diária") {
    return `Remuneração por diária de ${diariaFmt}. O valor de cada dia é proporcional às horas trabalhadas em relação à jornada e fica sincronizado com o cadastro de diárias. Comissão não se aplica neste tipo de contratação.`;
  }

  if (tipo === "Diária + Comissão") {
    return `Diária de ${diariaFmt}, proporcional às horas trabalhadas. A comissão será aplicada sobre os trabalhos. Exemplo: em um trabalho de ${trabalhoFmt}, recebe ${comumFmt} no comum e ${repFmt} na repetição.`;
  }

  const salarioFmt = formatarValorMonetarioBr(salario);
  return `Salário mensal fixo de ${salarioFmt}. A comissão será aplicada sobre os trabalhos. Exemplo: em um trabalho de ${trabalhoFmt}, recebe ${comumFmt} no comum e ${repFmt} na repetição.`;
}

/** Comissão aplicável na OS conforme tipo de contratação do cadastro. */
export function comissaoCadastroColaborador(
  dados: {
    tipoContratacao?: string;
    valorComissao?: string;
    comissaoRepeticao?: string;
  },
  comissaoPercentual: string,
  repeticao: boolean
): string {
  const tipo = dados.tipoContratacao || "Salário + Comissão";
  if (!usaComissaoColaborador(tipo)) return "0,00";

  if (repeticao) {
    const rep = dados.comissaoRepeticao;
    if (rep && rep.replace(/[^\d]/g, "") !== "000") {
      return rep;
    }
  }
  return dados.valorComissao || comissaoPercentual || "0,00";
}
