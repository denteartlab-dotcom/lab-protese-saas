import * as XLSX from "xlsx";
import {
  deduplicarContatos,
  normalizarTelefoneBr,
  type ContatoImportado,
} from "@/lib/whatsapp-disparos/telefone-br";
import { formatarTelefoneExibicao } from "@/lib/whatsapp-disparos/telefone-br";

const MAPA_COLUNAS: Record<string, keyof Omit<ContatoImportado, "valido" | "telefoneNormalizado">> = {
  nome: "nome",
  name: "nome",
  paciente: "nome",
  cliente: "nome",
  telefone: "telefone",
  phone: "telefone",
  celular: "telefone",
  whatsapp: "telefone",
  fone: "telefone",
  cidade: "cidade",
  city: "cidade",
  empresa: "empresaNome",
  company: "empresaNome",
  laboratorio: "empresaNome",
  dentista: "dentista",
  doctor: "dentista",
  consulta: "consulta",
  valor: "valor",
  vencimento: "vencimento",
  venc: "vencimento",
};

function normalizarChaveColuna(valor: string) {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function linhaParaContato(row: Record<string, unknown>): ContatoImportado {
  const campos: Partial<ContatoImportado> = { nome: "", telefone: "" };

  for (const [chave, valor] of Object.entries(row)) {
    const campo = MAPA_COLUNAS[normalizarChaveColuna(chave)];
    if (!campo || valor == null) continue;
    const texto = String(valor).trim();
    if (!texto) continue;
    if (campo === "nome") campos.nome = texto;
    else if (campo === "telefone") campos.telefone = texto;
    else campos[campo] = texto;
  }

  const telefoneNorm = normalizarTelefoneBr(campos.telefone || "");
  return {
    nome: campos.nome?.trim() || "Contato",
    telefone: campos.telefone || "",
    telefoneNormalizado: telefoneNorm || "",
    cidade: campos.cidade,
    empresaNome: campos.empresaNome,
    dentista: campos.dentista,
    consulta: campos.consulta,
    valor: campos.valor,
    vencimento: campos.vencimento,
    valido: Boolean(telefoneNorm),
  };
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
  let rows: Record<string, unknown>[] = [];

  if (ext.endsWith(".csv")) {
    const texto = new TextDecoder("utf-8").decode(buffer);
    const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
    if (!linhas.length) return deduplicarContatos([]);
    const sep = linhas[0].includes(";") ? ";" : ",";
    const headers = linhas[0].split(sep).map((h) => h.trim());
    rows = linhas.slice(1).map((linha) => {
      const cols = linha.split(sep);
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = cols[i]?.trim();
      });
      return obj;
    });
  } else {
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  }

  const contatos = rows.map(linhaParaContato).map((c) => ({
    ...c,
    telefone: c.valido ? formatarTelefoneExibicao(c.telefoneNormalizado) : c.telefone,
  }));

  return deduplicarContatos(contatos);
}

export type ResumoImportacao = ReturnType<typeof deduplicarContatos>;
