import { parseBrDate } from "@/lib/datas-br";

export type ServicoComPrazo = {
  prazo?: string | null;
  prazoDentista?: string | null;
};

export type CamposPrazoOs = {
  dataLaboratorio: string;
  horaLaboratorio: string;
  dataDentista: string;
  horaDentista: string;
};

const DATA_BR = /^\d{2}\/\d{2}\/\d{4}$/;

export function parseDiasPrazo(value?: string | null) {
  const dias = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(dias) && dias > 0 ? Math.floor(dias) : 0;
}

function formatarDataCalendario(date: Date) {
  const dia = String(date.getDate()).padStart(2, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${date.getFullYear()}`;
}

export function calcularDatasPrazoServico(
  servico: ServicoComPrazo,
  dataBase: Date = new Date()
) {
  const diasLab = parseDiasPrazo(servico.prazo);
  const diasAntesDentista = parseDiasPrazo(servico.prazoDentista);
  const base = new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate());

  let dataLaboratorio = "";
  let dataDentista = "";

  if (diasLab > 0) {
    const laboratorio = new Date(base);
    laboratorio.setDate(laboratorio.getDate() + diasLab);
    dataLaboratorio = formatarDataCalendario(laboratorio);

    if (diasAntesDentista > 0) {
      const dentista = new Date(laboratorio);
      dentista.setDate(dentista.getDate() - diasAntesDentista);
      dataDentista = formatarDataCalendario(dentista);
    }
  }

  return { dataLaboratorio, dataDentista };
}

export function calcularDataVencimentoPorDias(
  dataBase: Date | string | null | undefined,
  prazoDias?: string | null
) {
  const dias = parseDiasPrazo(prazoDias);
  if (dias <= 0) return "";

  let base: Date;
  if (dataBase instanceof Date) {
    base = new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate());
  } else if (typeof dataBase === "string" && dataBase.trim()) {
    base = parseBrDate(dataBase.trim()) || new Date();
    base = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  } else {
    const hoje = new Date();
    base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  }

  const vencimento = new Date(base);
  vencimento.setDate(vencimento.getDate() + dias);
  return formatarDataCalendario(vencimento);
}

export function separarDataHoraPrazo(texto?: string | null) {
  const valor = (texto || "").trim();
  const data = valor.match(/\b(\d{2}\/\d{2}\/\d{4})\b/)?.[1] || "";
  const hora = valor.match(/\b([01]\d|2[0-3]):[0-5]\d\b/)?.[0] || "";
  return { data, hora };
}

function valorLinhaPrazo(instrucoes: string, prefixo: RegExp) {
  const linha = instrucoes
    .split("\n")
    .map((item) => item.trim())
    .find((item) => prefixo.test(item));
  if (!linha) return "";
  return linha.replace(prefixo, "").trim();
}

/** Lê as datas já gravadas nas instruções da OS, sem confundir prazo do dentista com o do laboratório. */
export function prazosSalvosNasInstrucoes(instrucoes?: string | null): CamposPrazoOs {
  const texto = instrucoes || "";
  const lab = separarDataHoraPrazo(valorLinhaPrazo(texto, /^data\s+laborat[oó]rio\s*:/i));
  const dent = separarDataHoraPrazo(valorLinhaPrazo(texto, /^data\s+dentista\s*:/i));
  return {
    dataLaboratorio: lab.data,
    horaLaboratorio: lab.hora,
    dataDentista: dent.data,
    horaDentista: dent.hora,
  };
}

function dataDentistaRelativa(dataLaboratorio: string, diasAntes: number) {
  if (!DATA_BR.test(dataLaboratorio) || diasAntes <= 0) return "";
  const lab = parseBrDate(dataLaboratorio);
  if (!lab) return "";
  const dentista = new Date(lab.getFullYear(), lab.getMonth(), lab.getDate());
  dentista.setDate(dentista.getDate() - diasAntes);
  return formatarDataCalendario(dentista);
}

/**
 * Preenche só o que estiver vazio.
 * Prazo do laboratório = data de entrada + dias do serviço.
 * Prazo do dentista = prazo do laboratório menos os dias anteriores cadastrados na tabela.
 */
export function completarPrazosOsComTabela(params: {
  atuais: CamposPrazoOs;
  servico?: ServicoComPrazo | null;
  dataBase: Date;
  dataPrevistaLaboratorio?: string;
}): CamposPrazoOs {
  const prevista = DATA_BR.test(params.dataPrevistaLaboratorio || "")
    ? params.dataPrevistaLaboratorio || ""
    : "";
  const calculados = params.servico
    ? calcularDatasPrazoServico(params.servico, params.dataBase)
    : { dataLaboratorio: "", dataDentista: "" };
  const dataLaboratorio = params.atuais.dataLaboratorio || prevista || calculados.dataLaboratorio;
  const diasAntes = parseDiasPrazo(params.servico?.prazoDentista);
  const dataDentista =
    params.atuais.dataDentista ||
    (diasAntes > 0 ? dataDentistaRelativa(dataLaboratorio, diasAntes) : "") ||
    calculados.dataDentista;

  return {
    dataLaboratorio,
    horaLaboratorio: params.atuais.horaLaboratorio,
    dataDentista,
    horaDentista: params.atuais.horaDentista,
  };
}

/** Ao trocar o serviço, aplica o prazo da tabela. Serviço sem prazo não apaga uma data já definida. */
export function prazosAoSelecionarServico(
  atuais: { dataLaboratorio: string; dataDentista: string },
  calculados: { dataLaboratorio: string; dataDentista: string }
) {
  if (!calculados.dataLaboratorio && !calculados.dataDentista) {
    return {
      dataLaboratorio: atuais.dataLaboratorio,
      dataDentista: atuais.dataDentista,
    };
  }
  return {
    dataLaboratorio: calculados.dataLaboratorio || atuais.dataLaboratorio,
    dataDentista: calculados.dataLaboratorio
      ? calculados.dataDentista
      : calculados.dataDentista || atuais.dataDentista,
  };
}

export function linhasInstrucaoPrazosOs(campos: {
  dataLaboratorio?: string;
  horaLaboratorio?: string;
  dataDentista?: string;
  horaDentista?: string;
}) {
  const lab = (campos.dataLaboratorio || "").trim();
  const dent = (campos.dataDentista || "").trim();
  const horaLab = (campos.horaLaboratorio || "").trim();
  const horaDent = (campos.horaDentista || "").trim();
  return [
    lab ? `Data laboratório: ${lab}${horaLab ? ` ${horaLab}` : ""}` : "",
    dent ? `Data dentista: ${dent}${horaDent ? ` ${horaDent}` : ""}` : "",
  ].filter(Boolean);
}

/** Primeiro nome que pode ter prazo na tabela (ignora produto e transporte). */
export function nomeServicoParaPrazo(nomes: Array<string | null | undefined>) {
  for (const nome of nomes) {
    const texto = (nome || "").trim();
    if (!texto || /^(produto|transporte|frete)\s*:/i.test(texto)) continue;
    return texto;
  }
  return "";
}

/** Usa o primeiro serviço encontrado na tabela. Prefere quem tem prazo cadastrado. */
export function servicoComPrazoPorNomes<T extends ServicoComPrazo>(
  nomes: Array<string | null | undefined>,
  buscar: (nome: string) => T | undefined
) {
  let semPrazo: T | undefined;
  for (const nome of nomes) {
    const texto = nomeServicoParaPrazo([nome]);
    if (!texto) continue;
    const servico = buscar(texto);
    if (!servico) continue;
    if (parseDiasPrazo(servico.prazo) || parseDiasPrazo(servico.prazoDentista)) return servico;
    if (!semPrazo) semPrazo = servico;
  }
  return semPrazo;
}
