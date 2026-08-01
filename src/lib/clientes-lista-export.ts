import { configValueFromObservacoes } from "@/lib/cliente-financeiro";
import { telefoneWhatsappCliente } from "@/lib/cliente-observacoes";
import { baixarExcel } from "@/lib/exportar-excel";
import { formatDateImpressao } from "@/lib/i18n/print-i18n";
import { iniciarImpressaoRelatorio, pl } from "@/lib/i18n/print-relatorio-helpers";

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

export async function exportarClientesExcel(clientes: ClienteListagemExport[]) {
  const data = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  await baixarExcel(
    `clientes-${data}`,
    [...COLUNAS_EXPORT],
    clientes.map(linhaExportCliente),
    {
      nomeAba: "Clientes",
      colunasTexto: [1, 2, 3, 6, 11],
    }
  );
}

export async function gerarListaClientesPdf(clientes: ClienteListagemExport[]) {
  iniciarImpressaoRelatorio();
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const hoje = formatDateImpressao(new Date().toISOString().slice(0, 10));

  const margem = 12;
  const larguraUtil = 210 - margem * 2;
  const col2 = larguraUtil / 2;
  const alturaLinha = 4.2;
  const alturaBloco = alturaLinha * 4 + 3.5;

  function truncar(textoValor: string, maxWidth: number) {
    const t = (textoValor || "").trim();
    if (!t) return "";
    if (doc.getTextWidth(t) <= maxWidth) return t;
    let s = t;
    while (s.length > 1 && doc.getTextWidth(`${s}…`) > maxWidth) {
      s = s.slice(0, -1);
    }
    return `${s}…`;
  }

  /** Label + valor na mesma linha, sem invadir a coluna seguinte. */
  function campo(label: string, valor: string, x: number, y: number, largura: number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    const labelW = Math.min(doc.getTextWidth(label) + 1.2, largura * 0.55);
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    const maxValor = Math.max(3, largura - labelW);
    doc.text(truncar(valor, maxValor), x + labelW, y);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(pl("print.clientes.lista.titulo"), 105, 14, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text(hoje, 105, 19, { align: "center" });

  let y = 26;

  for (const cliente of clientes) {
    if (y + alturaBloco > 287) {
      doc.addPage();
      y = 16;
    }

    const { cpf, cnpj } = splitCpfCnpj(cliente.cnpjCpf);
    const telComercial = texto(cliente.telefone);
    const telResidencial = configValueFromObservacoes(
      cliente.observacoes,
      "Telefone Contato:"
    );
    const celular = texto(cliente.celular);
    const whatsapp = telefoneWhatsappCliente(cliente);

    // Linha 1: Cliente | CPF | CNPJ
    campo(pl("print.clientes.lista.cliente"), cliente.nome || "", margem, y, larguraUtil * 0.52);
    campo(pl("print.clientes.lista.cpf"), cpf, margem + larguraUtil * 0.52, y, larguraUtil * 0.23);
    campo(pl("print.clientes.lista.cnpj"), cnpj, margem + larguraUtil * 0.75, y, larguraUtil * 0.25);
    y += alturaLinha;

    // Linha 2: Razão Social | E-mail
    campo(
      pl("print.clientes.lista.razaoSocial"),
      texto(cliente.razaoSocial),
      margem,
      y,
      col2
    );
    campo(
      pl("print.clientes.lista.email"),
      texto(cliente.email),
      margem + col2,
      y,
      col2
    );
    y += alturaLinha;

    // Linha 3: Tel Comercial | Tel Residencial
    campo(pl("print.clientes.lista.telComercial"), telComercial, margem, y, col2);
    campo(pl("print.clientes.lista.telResidencial"), telResidencial, margem + col2, y, col2);
    y += alturaLinha;

    // Linha 4: Celular | WhatsApp
    campo(pl("print.clientes.lista.celular"), celular, margem, y, col2);
    campo(pl("print.clientes.lista.whatsapp"), whatsapp, margem + col2, y, col2);
    y += alturaLinha + 3.5;
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
