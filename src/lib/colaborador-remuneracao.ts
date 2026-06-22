import { parseCurrencyBr } from "@/lib/cliente-financeiro";

export type TipoContratacaoColaborador = "Salário" | "Comissão" | "Salário + Comissão";

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

export function usaSalarioColaborador(tipo: string): boolean {
  return tipo === "Salário" || tipo === "Salário + Comissão";
}

export function usaComissaoColaborador(tipo: string): boolean {
  return tipo === "Comissão" || tipo === "Salário + Comissão";
}

export function calcularComissaoTrabalho(
  valorTrabalho: number,
  valorTexto: string,
  tipo: string
): number {
  if (tipo === "R$") return parseValorNumericoBr(valorTexto);
  return valorTrabalho * (parseValorNumericoBr(valorTexto) / 100);
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

  if (dados.tipoContratacao === "Salário") {
    return `Remuneração fixa mensal de ${formatarValorMonetarioBr(salario)}. Comissão não se aplica neste tipo de contratação.`;
  }

  if (dados.tipoContratacao === "Comissão") {
    return `A comissão será aplicada sobre os trabalhos. No comum, ${comumFmt}; na repetição, ${repFmt}.`;
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
