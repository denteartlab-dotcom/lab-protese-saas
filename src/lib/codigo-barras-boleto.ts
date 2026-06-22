import { dateToBrShort } from "@/lib/datas-br";
import { limparEntradaLeitorCodigo } from "@/lib/codigo-barras-os";

export type DadosLeituraBoleto = {
  bruto: string;
  codigoBarras: string;
  linhaDigitavel: string;
  linhaFormatada: string;
  valor: number | null;
  vencimento: Date | null;
  vencimentoBr: string | null;
  ehPix: boolean;
};

export function limparCodigoBoleto(raw: string) {
  return limparEntradaLeitorCodigo(raw).replace(/\D/g, "");
}

export function ehPixCopiaCola(raw: string) {
  const t = raw.trim();
  return t.startsWith("000201") || /br\.gov\.bcb\.pix/i.test(t);
}

/** Converte linha digitável (47 dígitos) em código de barras (44). */
export function linhaDigitavelParaCodigoBarras(linha47: string) {
  if (linha47.length !== 47) return null;
  return (
    linha47.slice(0, 4) +
    linha47.charAt(32) +
    linha47.slice(33, 47) +
    linha47.slice(4, 9) +
    linha47.slice(10, 20) +
    linha47.slice(21, 31)
  );
}

export function codigoBarrasParaLinhaDigitavel(codigo44: string) {
  if (codigo44.length !== 44) return null;
  return (
    codigo44.slice(0, 4) +
    codigo44.slice(19, 24) +
    codigo44.slice(24, 34) +
    codigo44.slice(34, 44) +
    codigo44.charAt(4) +
    codigo44.slice(5, 19)
  );
}

export function formatarLinhaDigitavelBoleto(linha47: string) {
  if (linha47.length !== 47) return linha47;
  return `${linha47.slice(0, 5)}.${linha47.slice(5, 10)} ${linha47.slice(10, 15)}.${linha47.slice(15, 21)} ${linha47.slice(21, 26)}.${linha47.slice(26, 32)} ${linha47.slice(32, 33)} ${linha47.slice(33, 47)}`;
}

export function fatorVencimentoParaData(fator: number): Date | null {
  if (!Number.isFinite(fator) || fator <= 0) return null;
  if (fator >= 1000) {
    const base = new Date(2025, 1, 22);
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + (fator - 1000));
    return base;
  }
  const base = new Date(1997, 9, 7);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + fator);
  return base;
}

function extrairValorEFatorCodigoBarras(codigo44: string) {
  const fator = Number.parseInt(codigo44.slice(5, 9), 10);
  const valorCentavos = Number.parseInt(codigo44.slice(9, 19), 10);
  const valor = Number.isFinite(valorCentavos) ? valorCentavos / 100 : null;
  return {
    fator: Number.isFinite(fator) ? fator : 0,
    valor,
    vencimento: fatorVencimentoParaData(fator),
  };
}

export function parseLeituraBoleto(raw: string): DadosLeituraBoleto | null {
  const bruto = limparEntradaLeitorCodigo(raw);
  if (!bruto) return null;

  if (ehPixCopiaCola(bruto)) {
    return {
      bruto,
      codigoBarras: "",
      linhaDigitavel: "",
      linhaFormatada: bruto,
      valor: null,
      vencimento: null,
      vencimentoBr: null,
      ehPix: true,
    };
  }

  const digitos = limparCodigoBoleto(bruto);
  if (digitos.length !== 44 && digitos.length !== 47) return null;

  const codigoBarras =
    digitos.length === 44
      ? digitos
      : linhaDigitavelParaCodigoBarras(digitos) ?? "";
  if (codigoBarras.length !== 44) return null;

  const linhaDigitavel =
    digitos.length === 47 ? digitos : codigoBarrasParaLinhaDigitavel(codigoBarras) ?? "";
  const { valor, vencimento } = extrairValorEFatorCodigoBarras(codigoBarras);

  return {
    bruto,
    codigoBarras,
    linhaDigitavel,
    linhaFormatada: formatarLinhaDigitavelBoleto(linhaDigitavel),
    valor,
    vencimento,
    vencimentoBr: vencimento ? dateToBrShort(vencimento) : null,
    ehPix: false,
  };
}

function parseMoneyBr(valor: string) {
  const n = Number(valor.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function indiceParcelaParaLeituraBoleto<
  T extends {
    codigoBarrasPix: string;
    valor: string;
    vencimento: string;
    pago: boolean;
  },
>(parcelas: T[], dados: Pick<DadosLeituraBoleto, "valor" | "vencimentoBr">): number {
  if (parcelas.length === 0) return -1;

  if (dados.valor != null && dados.vencimentoBr) {
    const porValorVenc = parcelas.findIndex(
      (p) =>
        !p.pago &&
        !p.codigoBarrasPix.trim() &&
        p.vencimento === dados.vencimentoBr &&
        Math.abs(parseMoneyBr(p.valor) - dados.valor!) < 0.02
    );
    if (porValorVenc >= 0) return porValorVenc;
  }

  if (dados.vencimentoBr) {
    const porVenc = parcelas.findIndex(
      (p) => !p.pago && !p.codigoBarrasPix.trim() && p.vencimento === dados.vencimentoBr
    );
    if (porVenc >= 0) return porVenc;
  }

  if (dados.valor != null) {
    const porValor = parcelas.findIndex(
      (p) =>
        !p.pago &&
        !p.codigoBarrasPix.trim() &&
        Math.abs(parseMoneyBr(p.valor) - dados.valor!) < 0.02
    );
    if (porValor >= 0) return porValor;
  }

  const vazio = parcelas.findIndex((p) => !p.pago && !p.codigoBarrasPix.trim());
  if (vazio >= 0) return vazio;

  return parcelas.findIndex((p) => !p.pago);
}

export function mensagemLeituraBoleto(
  dados: DadosLeituraBoleto,
  indiceParcela: number,
  totalParcelas: number
) {
  if (dados.ehPix) {
    return indiceParcela >= 0
      ? `Pix copiado registrado na parcela ${indiceParcela + 1}/${totalParcelas}.`
      : "Pix copiado registrado.";
  }
  const partes = [`Boleto registrado na parcela ${indiceParcela + 1}/${totalParcelas}`];
  if (dados.valor != null) {
    partes.push(
      `valor ${dados.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
    );
  }
  if (dados.vencimentoBr) partes.push(`vencimento ${dados.vencimentoBr}`);
  return `${partes.join(" · ")}.`;
}
