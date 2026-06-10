import { configValueFromObservacoes } from "@/lib/cliente-financeiro";
import { telefoneWhatsappCliente } from "@/lib/cliente-observacoes";
import { baixarExcel } from "@/lib/exportar-excel";

export type ClienteListagemExport = {
  id?: string;
  nome: string;
  razaoSocial?: string | null;
  cnpjCpf?: string | null;
  cro?: string | null;
  telefone?: string | null;
  celular?: string | null;
  email?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  observacoes?: string | null;
};

export type ClienteImportacaoLinha = {
  nome: string;
  razaoSocial?: string;
  cnpjCpf?: string;
  cro?: string;
  telefone?: string;
  celular?: string;
  whatsapp?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  contato?: string;
};

const COLUNAS_EXPORT = [
  "Nome",
  "Contato",
  "Celular",
  "WhatsApp",
  "E-mail",
  "Razão Social",
  "CPF/CNPJ",
  "CRO",
  "Endereço",
  "Cidade",
  "UF",
  "CEP",
] as const;

function texto(valor?: string | null) {
  return (valor ?? "").trim();
}

function splitCpfCnpj(doc?: string | null) {
  const limpo = texto(doc);
  if (!limpo) return { cpf: "", cnpj: "" };
  const digits = limpo.replace(/\D/g, "");
  if (digits.length > 11) return { cpf: "", cnpj: limpo };
  return { cpf: limpo, cnpj: "" };
}

function linhaExportCliente(c: ClienteListagemExport) {
  const wa = telefoneWhatsappCliente(c);
  return [
    c.nome,
    c.telefone || "",
    c.celular || "",
    wa,
    c.email || "",
    c.razaoSocial || "",
    c.cnpjCpf || "",
    c.cro || "",
    c.endereco || "",
    c.cidade || "",
    c.uf || "",
    c.cep || "",
  ];
}

export function exportarClientesExcel(clientes: ClienteListagemExport[]) {
  const data = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  baixarExcel(
    `clientes-${data}`,
    [...COLUNAS_EXPORT],
    clientes.map(linhaExportCliente)
  );
}

export async function gerarListaClientesPdf(clientes: ClienteListagemExport[]) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const hoje = new Date().toLocaleDateString("pt-BR");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Lista de Clientes Cadastrados", 105, 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text(hoje, 105, 24, { align: "center" });

  let y = 38;

  for (const cliente of clientes) {
    if (y > 275) {
      doc.addPage();
      y = 18;
    }

    const { cpf, cnpj } = splitCpfCnpj(cliente.cnpjCpf);
    const telComercial = texto(cliente.telefone);
    const telResidencial = configValueFromObservacoes(
      cliente.observacoes,
      "Telefone Contato:"
    );
    const celular = texto(cliente.celular);
    const whatsapp = telefoneWhatsappCliente(cliente);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text("Cliente:", 22, y);
    doc.setFont("helvetica", "normal");
    doc.text(cliente.nome || "", 35, y);
    doc.setFont("helvetica", "bold");
    doc.text("Razão Social:", 73, y);
    doc.setFont("helvetica", "normal");
    doc.text(texto(cliente.razaoSocial), 92, y);
    doc.setFont("helvetica", "bold");
    doc.text("CPF:", 130, y);
    doc.setFont("helvetica", "normal");
    doc.text(cpf, 138, y);
    doc.setFont("helvetica", "bold");
    doc.text("CNPJ:", 154, y);
    doc.setFont("helvetica", "normal");
    doc.text(cnpj, 163, y);
    doc.setFont("helvetica", "bold");
    doc.text("E-mail:", 178, y);
    doc.setFont("helvetica", "normal");
    doc.text(texto(cliente.email), 188, y);

    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Tel Comercial:", 22, y);
    doc.setFont("helvetica", "normal");
    doc.text(telComercial, 42, y);
    doc.setFont("helvetica", "bold");
    doc.text("Tel Residencial:", 73, y);
    doc.setFont("helvetica", "normal");
    doc.text(telResidencial, 95, y);
    doc.setFont("helvetica", "bold");
    doc.text("Celular:", 130, y);
    doc.setFont("helvetica", "normal");
    doc.text(celular, 142, y);
    doc.setFont("helvetica", "bold");
    doc.text("Whatsapp:", 154, y);
    doc.setFont("helvetica", "normal");
    doc.text(whatsapp, 168, y);

    y += 7;
  }

  return doc.output("blob");
}

function normalizarChaveColuna(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MAPA_COLUNAS: Record<string, keyof ClienteImportacaoLinha> = {
  nome: "nome",
  cliente: "nome",
  "razao social": "razaoSocial",
  cpf: "cnpjCpf",
  cnpj: "cnpjCpf",
  "cpf cnpj": "cnpjCpf",
  "cpf/cnpj": "cnpjCpf",
  cro: "cro",
  contato: "contato",
  "tel comercial": "telefone",
  telefone: "telefone",
  "telefone comercial": "telefone",
  celular: "celular",
  whatsapp: "whatsapp",
  "e mail": "email",
  email: "email",
  endereco: "endereco",
  cidade: "cidade",
  uf: "uf",
  cep: "cep",
};

function mapearLinhaImportacao(
  headers: string[],
  valores: unknown[]
): ClienteImportacaoLinha | null {
  const linha: Partial<ClienteImportacaoLinha> = {};
  headers.forEach((header, index) => {
    const chave = MAPA_COLUNAS[normalizarChaveColuna(header)];
    if (!chave) return;
    const valor = String(valores[index] ?? "").trim();
    if (!valor) return;
    linha[chave] = valor;
  });

  const nome = texto(linha.nome);
  if (!nome) return null;

  const telefone = texto(linha.telefone) || texto(linha.contato);
  const whatsapp = texto(linha.whatsapp);
  const celular = texto(linha.celular) || whatsapp;

  return {
    nome,
    razaoSocial: texto(linha.razaoSocial),
    cnpjCpf: texto(linha.cnpjCpf),
    cro: texto(linha.cro),
    telefone,
    celular,
    whatsapp,
    email: texto(linha.email),
    endereco: texto(linha.endereco),
    cidade: texto(linha.cidade),
    uf: texto(linha.uf),
    cep: texto(linha.cep),
    contato: texto(linha.contato),
  };
}

function linhasDeHtmlTable(html: string): ClienteImportacaoLinha[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];

  const rows = [...table.querySelectorAll("tr")];
  if (rows.length < 2) return [];

  const headers = [...rows[0].querySelectorAll("th,td")].map((c) => c.textContent || "");
  const saida: ClienteImportacaoLinha[] = [];

  for (const row of rows.slice(1)) {
    const valores = [...row.querySelectorAll("td,th")].map((c) => c.textContent || "");
    const item = mapearLinhaImportacao(headers, valores);
    if (item) saida.push(item);
  }

  return saida;
}

export async function parsearArquivoClientesExcel(
  arquivo: File
): Promise<ClienteImportacaoLinha[]> {
  const nome = arquivo.name.toLowerCase();

  if (nome.endsWith(".csv")) {
    const textoArquivo = await arquivo.text();
    const linhas = textoArquivo
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (linhas.length < 2) return [];

    const separador = linhas[0].includes(";") ? ";" : ",";
    const headers = linhas[0].split(separador).map((h) => h.replace(/^"|"$/g, "").trim());
    const saida: ClienteImportacaoLinha[] = [];

    for (const linha of linhas.slice(1)) {
      const valores = linha.split(separador).map((v) => v.replace(/^"|"$/g, "").trim());
      const item = mapearLinhaImportacao(headers, valores);
      if (item) saida.push(item);
    }
    return saida;
  }

  if (nome.endsWith(".xls") && !nome.endsWith(".xlsx")) {
    const html = await arquivo.text();
    return linhasDeHtmlTable(html);
  }

  const buffer = await arquivo.arrayBuffer();
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  if (matriz.length < 2) return [];

  const headers = (matriz[0] || []).map((c) => String(c ?? ""));
  const saida: ClienteImportacaoLinha[] = [];

  for (const row of matriz.slice(1)) {
    const item = mapearLinhaImportacao(headers, row);
    if (item) saida.push(item);
  }

  return saida;
}

export function clienteImportacaoParaPayload(linha: ClienteImportacaoLinha) {
  const observacoes = [
    linha.contato ? `Contato: ${linha.contato}` : "",
    linha.whatsapp && linha.whatsapp !== linha.celular
      ? `WhatsApp Contato: ${linha.whatsapp}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    nome: linha.nome,
    razaoSocial: linha.razaoSocial || undefined,
    cnpjCpf: linha.cnpjCpf || undefined,
    cro: linha.cro || undefined,
    telefone: linha.telefone || undefined,
    celular: linha.whatsapp || linha.celular || undefined,
    email: linha.email || undefined,
    endereco: linha.endereco || undefined,
    cidade: linha.cidade || undefined,
    uf: linha.uf || undefined,
    cep: linha.cep || undefined,
    observacoes: observacoes || undefined,
  };
}
