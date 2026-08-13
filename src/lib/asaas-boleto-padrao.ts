import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import { dateToBrShort, parseBrDate } from "@/lib/datas-br";

export const JSON_KEY_BOLETO_ASAAS_PADRAO = "labProteseBoletoAsaasPadrao";

export type TipoVencimentoBoletoAsaas = "data_fixa" | "dias_apos" | "dia_mes";

export type PadraoBoletoAsaas = {
  cadastrado: boolean;
  /** False em padrões antigos (só juros/multa) até o usuário salvar o vencimento. */
  vencimentoConfigurado: boolean;
  interest: number;
  fine: number;
  vencimentoTipo: TipoVencimentoBoletoAsaas;
  /** yyyy-mm-dd quando tipo = data_fixa */
  dataFixa: string | null;
  diasApos: number;
  diaMes: number;
};

export const PADRAO_BOLETO_ASAAS_VAZIO: PadraoBoletoAsaas = {
  cadastrado: false,
  vencimentoConfigurado: false,
  interest: 0,
  fine: 0,
  vencimentoTipo: "dias_apos",
  dataFixa: null,
  diasApos: 5,
  diaMes: 10,
};

function clampPercentual(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 100);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function normalizarTipo(
  raw: unknown
): TipoVencimentoBoletoAsaas {
  if (raw === "data_fixa" || raw === "dias_apos" || raw === "dia_mes") return raw;
  return "dias_apos";
}

function isoDateValida(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const texto = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [y, m, d] = texto.split("-").map(Number);
    const dt = new Date(y, m - 1, d, 12);
    if (
      dt.getFullYear() === y &&
      dt.getMonth() === m - 1 &&
      dt.getDate() === d
    ) {
      return texto;
    }
    return null;
  }
  const br = parseBrDate(texto);
  if (!br) return null;
  const y = br.getFullYear();
  const m = String(br.getMonth() + 1).padStart(2, "0");
  const d = String(br.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function normalizarPadraoBoletoAsaas(
  raw: Partial<PadraoBoletoAsaas> | null | undefined
): PadraoBoletoAsaas {
  if (!raw || raw.cadastrado !== true) return { ...PADRAO_BOLETO_ASAAS_VAZIO };
  const vencimentoConfigurado =
    raw.vencimentoTipo === "data_fixa" ||
    raw.vencimentoTipo === "dias_apos" ||
    raw.vencimentoTipo === "dia_mes";
  return {
    cadastrado: true,
    vencimentoConfigurado,
    interest: clampPercentual(raw.interest),
    fine: clampPercentual(raw.fine),
    vencimentoTipo: normalizarTipo(raw.vencimentoTipo),
    dataFixa: isoDateValida(raw.dataFixa),
    diasApos: clampInt(raw.diasApos, 0, 365, 5),
    diaMes: clampInt(raw.diaMes, 1, 31, 10),
  };
}

export type ValoresPadraoBoletoAsaas = {
  interest: number;
  fine: number;
  vencimentoTipo: TipoVencimentoBoletoAsaas;
  dataFixa?: string | null;
  diasApos?: number;
  diaMes?: number;
};

export function validarValoresPadraoBoletoAsaas(valores: ValoresPadraoBoletoAsaas) {
  const tipo = normalizarTipo(valores.vencimentoTipo);
  if (tipo === "data_fixa" && !isoDateValida(valores.dataFixa)) {
    throw new Error("Informe uma data fixa de vencimento válida.");
  }
  if (tipo === "dias_apos") {
    const dias = Number(valores.diasApos);
    if (!Number.isFinite(dias) || dias < 0) {
      throw new Error("Informe quantos dias após a criação o boleto vence.");
    }
  }
  if (tipo === "dia_mes") {
    const dia = Number(valores.diaMes);
    if (!Number.isFinite(dia) || dia < 1 || dia > 31) {
      throw new Error("Informe o dia do mês (1 a 31) para o vencimento.");
    }
  }
}

export async function obterPadraoBoletoAsaas(
  empresaId: string
): Promise<PadraoBoletoAsaas> {
  const raw = await lerJsonStoreTenant<Partial<PadraoBoletoAsaas>>(
    empresaId,
    JSON_KEY_BOLETO_ASAAS_PADRAO
  );
  return normalizarPadraoBoletoAsaas(raw);
}

export async function salvarPadraoBoletoAsaas(
  empresaId: string,
  valores: ValoresPadraoBoletoAsaas
): Promise<PadraoBoletoAsaas> {
  validarValoresPadraoBoletoAsaas(valores);
  const tipo = normalizarTipo(valores.vencimentoTipo);
  const padrao: PadraoBoletoAsaas = {
    cadastrado: true,
    vencimentoConfigurado: true,
    interest: clampPercentual(valores.interest),
    fine: clampPercentual(valores.fine),
    vencimentoTipo: tipo,
    dataFixa: tipo === "data_fixa" ? isoDateValida(valores.dataFixa) : null,
    diasApos: clampInt(valores.diasApos, 0, 365, 5),
    diaMes: clampInt(valores.diaMes, 1, 31, 10),
  };
  await salvarJsonStoreTenant(empresaId, JSON_KEY_BOLETO_ASAAS_PADRAO, padrao);
  return padrao;
}

export async function limparPadraoBoletoAsaas(empresaId: string) {
  await salvarJsonStoreTenant(
    empresaId,
    JSON_KEY_BOLETO_ASAAS_PADRAO,
    PADRAO_BOLETO_ASAAS_VAZIO
  );
  return { ...PADRAO_BOLETO_ASAAS_VAZIO };
}

function meioDia(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function dataNoDiaDoMes(year: number, month: number, dia: number) {
  const ultimo = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dia, ultimo), 12);
}

/** Calcula o vencimento do boleto a partir do padrão cadastrado. */
export function resolverVencimentoPadraoBoletoAsaas(
  padrao: PadraoBoletoAsaas,
  referencia = new Date(),
  indiceParcela = 0
): Date | null {
  if (!padrao.cadastrado || !padrao.vencimentoConfigurado) return null;
  const base = meioDia(referencia);
  const parcela = Math.max(0, Math.floor(indiceParcela));

  if (padrao.vencimentoTipo === "data_fixa" && padrao.dataFixa) {
    const [y, m, d] = padrao.dataFixa.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
  }

  if (padrao.vencimentoTipo === "dias_apos") {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + padrao.diasApos);
    if (parcela > 0) {
      const dia = dt.getDate();
      const alvo = new Date(dt.getFullYear(), dt.getMonth() + parcela, 1, 12);
      const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
      alvo.setDate(Math.min(dia, ultimo));
      return alvo;
    }
    return dt;
  }

  if (padrao.vencimentoTipo === "dia_mes") {
    const dia = padrao.diaMes;
    let dt = dataNoDiaDoMes(base.getFullYear(), base.getMonth(), dia);
    if (dt.getTime() < base.getTime()) {
      const proximoMes = base.getMonth() + 1;
      dt = dataNoDiaDoMes(
        proximoMes > 11 ? base.getFullYear() + 1 : base.getFullYear(),
        proximoMes % 12,
        dia
      );
    }
    if (parcela > 0) {
      dt = dataNoDiaDoMes(dt.getFullYear(), dt.getMonth() + parcela, dia);
    }
    return dt;
  }

  return null;
}

/** Vencimento do padrão em dd/mm/aaaa para a UI de lançamento. */
export function vencimentoPadraoBoletoAsaasBr(
  padrao: Partial<PadraoBoletoAsaas> | null | undefined,
  indiceParcela = 0,
  referencia = new Date()
): string | null {
  const normalizado = normalizarPadraoBoletoAsaas(padrao);
  const data = resolverVencimentoPadraoBoletoAsaas(
    normalizado,
    referencia,
    indiceParcela
  );
  return data ? dateToBrShort(data) : null;
}
