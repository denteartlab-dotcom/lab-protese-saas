import * as XLSX from "xlsx";
import {
  apenasDigitos,
  deduplicarContatos,
  normalizarTelefoneBr,
  type ContatoImportado,
} from "@/lib/whatsapp-disparos/telefone-br";
import { formatarTelefoneExibicao } from "@/lib/whatsapp-disparos/telefone-br";

type CampoContato = keyof Omit<ContatoImportado, "valido" | "telefoneNormalizado">;

const MAPA_COLUNAS: Record<string, CampoContato> = {
  nome: "nome",
  name: "nome",
  paciente: "nome",
  cliente: "nome",
  telefone: "telefone",
  telefon: "telefone",
  phone: "telefone",
  celular: "telefone",
  whatsapp: "telefone",
  fone: "telefone",
  tel: "telefone",
  cidade: "cidade",
  city: "cidade",
  municipio: "cidade",
};

function normalizarChaveColuna(valor: string) {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function celulaPareceTelefone(valor: unknown): boolean {
  const digits = apenasDigitos(String(valor ?? ""));
  return digits.length >= 10 && digits.length <= 13;
}

function celulaEhCabecalho(valor: unknown): boolean {
  const chave = normalizarChaveColuna(String(valor ?? ""));
  return Boolean(MAPA_COLUNAS[chave]) || chave.startsWith("coluna");
}

function montarContato(nome: string, telefone: string, cidade?: string): ContatoImportado {
  const telefoneNorm = normalizarTelefoneBr(telefone);
  return {
    nome: nome.trim() || "Contato",
    telefone: telefone.trim(),
    telefoneNormalizado: telefoneNorm || "",
    cidade: cidade?.trim() || undefined,
    valido: Boolean(telefoneNorm),
  };
}

function linhaObjetoParaContato(row: Record<string, unknown>): ContatoImportado {
  const campos: Partial<ContatoImportado> = { nome: "", telefone: "" };

  for (const [chave, valor] of Object.entries(row)) {
    const campo = MAPA_COLUNAS[normalizarChaveColuna(chave)];
    if (!campo || valor == null) continue;
    const texto = String(valor).trim();
    if (!texto || celulaEhCabecalho(texto)) continue;
    if (campo === "nome") campos.nome = texto;
    else if (campo === "telefone") campos.telefone = texto;
    else campos[campo] = texto;
  }

  if (!campos.telefone) {
    for (const valor of Object.values(row)) {
      if (celulaPareceTelefone(valor)) {
        campos.telefone = String(valor).trim();
        break;
      }
    }
  }

  if (!campos.nome) {
    for (const valor of Object.values(row)) {
      const texto = String(valor ?? "").trim();
      if (!texto || celulaPareceTelefone(texto)) continue;
      if (campos.cidade && texto === campos.cidade) continue;
      if (celulaEhCabecalho(texto)) continue;
      campos.nome = texto;
      break;
    }
  }

  return montarContato(campos.nome || "", campos.telefone || "", campos.cidade);
}

function detectarCabecalho(aoa: unknown[][]): { linhaIdx: number; colunas: Partial<Record<CampoContato, number>> } | null {
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const row = aoa[i] || [];
    const colunas: Partial<Record<CampoContato, number>> = {};

    for (let j = 0; j < row.length; j++) {
      const campo = MAPA_COLUNAS[normalizarChaveColuna(String(row[j] ?? ""))];
      if (campo) colunas[campo] = j;
    }

    if (colunas.telefone !== undefined) {
      return { linhaIdx: i, colunas };
    }
  }
  return null;
}

function linhaArrayParaContato(row: unknown[], colunas: Partial<Record<CampoContato, number>>): ContatoImportado {
  let nome =
    colunas.nome !== undefined ? String(row[colunas.nome] ?? "").trim() : "";
  let telefone =
    colunas.telefone !== undefined ? String(row[colunas.telefone] ?? "").trim() : "";
  let cidade =
    colunas.cidade !== undefined ? String(row[colunas.cidade] ?? "").trim() : undefined;

  if (!telefone) {
    for (const cell of row) {
      if (celulaPareceTelefone(cell)) {
        telefone = String(cell).trim();
        break;
      }
    }
  }

  if (!nome) {
    for (const cell of row) {
      const texto = String(cell ?? "").trim();
      if (!texto || celulaPareceTelefone(texto)) continue;
      if (cidade && texto === cidade) continue;
      if (celulaEhCabecalho(texto)) continue;
      nome = texto;
      break;
    }
  }

  if (!cidade) {
    for (const cell of row) {
      const texto = String(cell ?? "").trim();
      if (!texto || celulaPareceTelefone(texto) || texto === nome) continue;
      if (celulaEhCabecalho(texto)) continue;
      cidade = texto;
      break;
    }
  }

  if (celulaEhCabecalho(nome) || celulaEhCabecalho(telefone)) {
    return montarContato("", "", "");
  }

  return montarContato(nome, telefone, cidade);
}

function parsearMatriz(aoa: unknown[][]): ContatoImportado[] {
  const cab = detectarCabecalho(aoa);
  const contatos: ContatoImportado[] = [];

  if (cab) {
    for (let i = cab.linhaIdx + 1; i < aoa.length; i++) {
      const row = aoa[i] || [];
      if (!row.some((c) => String(c ?? "").trim())) continue;
      contatos.push(linhaArrayParaContato(row, cab.colunas));
    }
    return contatos;
  }

  for (const row of aoa) {
    if (!row?.some((c) => String(c ?? "").trim())) continue;
    const obj: Record<string, unknown> = {};
    row.forEach((cell, idx) => {
      obj[`col${idx}`] = cell;
    });
    contatos.push(linhaObjetoParaContato(obj));
  }

  return contatos;
}

function parsearCsv(texto: string): ContatoImportado[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return [];

  const sep = linhas[0].includes(";") ? ";" : ",";
  const aoa = linhas.map((linha) => linha.split(sep).map((c) => c.trim()));
  return parsearMatriz(aoa);
}

function parsearExcel(sheet: XLSX.WorkSheet): ContatoImportado[] {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  return parsearMatriz(aoa);
}

export async function parsearArquivoContatosDisparo(file: File | ArrayBuffer, nomeArquivo?: string) {
  let buffer: ArrayBuffer;
  if (file instanceof File) {
    buffer = await file.arrayBuffer();
    nomeArquivo = file.name;
  } else {
    buffer = file;
  }

  const ext = (nomeArquivo || "").toLowerCase();
  let contatos: ContatoImportado[] = [];

  if (ext.endsWith(".csv")) {
    const texto = new TextDecoder("utf-8").decode(buffer);
    contatos = parsearCsv(texto);
  } else {
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    contatos = parsearExcel(sheet);
  }

  contatos = contatos.map((c) => ({
    ...c,
    telefone: c.valido ? formatarTelefoneExibicao(c.telefoneNormalizado) : c.telefone,
  }));

  return deduplicarContatos(contatos);
}

export type ResumoImportacao = ReturnType<typeof deduplicarContatos>;
