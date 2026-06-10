import { baixarExcel } from "@/lib/exportar-excel";

export type FornecedorListagemExport = {
  id?: string;
  nome: string;
  contato: string;
  celular: string;
  whatsapp: string;
  email: string;
  cpf?: string;
  cnpj?: string;
  categoria?: string;
  telefoneResidencial?: string;
  telefoneComercial?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  cidade?: string;
  uf?: string;
  bairro?: string;
  complemento?: string;
  representanteTelefoneComercial?: string;
  representanteWhatsapp?: string;
  representanteEmail?: string;
};

export type FornecedorImportacaoLinha = {
  nome: string;
  contato?: string;
  celular?: string;
  whatsapp?: string;
  email?: string;
  cpf?: string;
  cnpj?: string;
  categoria?: string;
  telefoneResidencial?: string;
  telefoneComercial?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  cidade?: string;
  uf?: string;
  bairro?: string;
  complemento?: string;
  representanteTelefoneComercial?: string;
  representanteWhatsapp?: string;
  representanteEmail?: string;
};

const COLUNAS_EXPORT = [
  "Nome",
  "Contato",
  "Celular",
  "WhatsApp",
  "E-mail",
  "CPF",
  "CNPJ",
  "Categoria",
  "Tel. Residencial",
  "Tel. Comercial",
  "CEP",
  "Rua",
  "Número",
  "Bairro",
  "Cidade",
  "UF",
  "Complemento",
  "Rep. Tel. Comercial",
  "Rep. WhatsApp",
  "Rep. E-mail",
] as const;

function texto(valor?: string | null) {
  return (valor ?? "").trim();
}

function linhaExportFornecedor(f: FornecedorListagemExport) {
  return [
    f.nome,
    f.contato || "",
    f.celular || "",
    f.whatsapp || "",
    f.email || "",
    f.cpf || "",
    f.cnpj || "",
    f.categoria || "",
    f.telefoneResidencial || "",
    f.telefoneComercial || "",
    f.cep || "",
    f.rua || "",
    f.numero || "",
    f.bairro || "",
    f.cidade || "",
    f.uf || "",
    f.complemento || "",
    f.representanteTelefoneComercial || "",
    f.representanteWhatsapp || "",
    f.representanteEmail || "",
  ];
}

export async function exportarFornecedoresExcel(fornecedores: FornecedorListagemExport[]) {
  const data = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  await baixarExcel(
    `fornecedores-${data}`,
    [...COLUNAS_EXPORT],
    fornecedores.map(linhaExportFornecedor),
    {
      nomeAba: "Fornecedores",
      colunasTexto: [1, 2, 3, 5, 6, 10],
    }
  );
}

const COLUNAS_PDF = [
  { titulo: "Nome", larguraMm: 48 },
  { titulo: "Contato", larguraMm: 32 },
  { titulo: "Celular", larguraMm: 28 },
  { titulo: "WhatsApp", larguraMm: 28 },
  { titulo: "E-mail", larguraMm: 54 },
] as const;

export async function gerarListaFornecedoresPdf(
  fornecedores: FornecedorListagemExport[]
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 10;
  const pageH = pdf.internal.pageSize.getHeight();
  const rowH = 6.5;
  const headerH = 7;
  const colX: number[] = [margin];
  for (let i = 0; i < COLUNAS_PDF.length - 1; i++) {
    colX.push(colX[i] + COLUNAS_PDF[i].larguraMm);
  }

  let y = margin;

  function novaPaginaSeNecessario(altura: number) {
    if (y + altura > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  }

  const hoje = new Date().toLocaleDateString("pt-BR");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Lista de Fornecedores Cadastrados", 105, y + 4, { align: "center" });
  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(hoje, 105, y, { align: "center" });
  y += 8;

  novaPaginaSeNecessario(headerH);
  pdf.setFillColor(241, 245, 249);
  pdf.setDrawColor(226, 232, 240);
  pdf.rect(margin, y, colX[colX.length - 1] + COLUNAS_PDF[COLUNAS_PDF.length - 1].larguraMm - margin, headerH, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  COLUNAS_PDF.forEach((col, i) => {
    pdf.text(col.titulo, colX[i] + 1.5, y + 4.5);
  });
  y += headerH;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);

  for (const fornecedor of fornecedores) {
    novaPaginaSeNecessario(rowH);
    const valores = [
      fornecedor.nome,
      fornecedor.contato || "",
      fornecedor.celular || "",
      fornecedor.whatsapp || "",
      fornecedor.email || "",
    ];
    pdf.setDrawColor(241, 245, 249);
    pdf.line(margin, y + rowH, margin + 190, y + rowH);
    valores.forEach((valor, i) => {
      const textoCelula = pdf.splitTextToSize(valor, COLUNAS_PDF[i].larguraMm - 3)[0] || "";
      pdf.text(textoCelula, colX[i] + 1.5, y + 4.2);
    });
    y += rowH;
  }

  return pdf.output("blob");
}

function normalizarChaveColuna(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MAPA_COLUNAS: Record<string, keyof FornecedorImportacaoLinha> = {
  nome: "nome",
  fornecedor: "nome",
  contato: "contato",
  celular: "celular",
  whatsapp: "whatsapp",
  "e mail": "email",
  email: "email",
  cpf: "cpf",
  cnpj: "cnpj",
  categoria: "categoria",
  "tel residencial": "telefoneResidencial",
  "telefone residencial": "telefoneResidencial",
  "tel comercial": "telefoneComercial",
  "telefone comercial": "telefoneComercial",
  cep: "cep",
  rua: "rua",
  endereco: "rua",
  numero: "numero",
  bairro: "bairro",
  cidade: "cidade",
  uf: "uf",
  complemento: "complemento",
  "rep tel comercial": "representanteTelefoneComercial",
  "representante tel comercial": "representanteTelefoneComercial",
  "rep whatsapp": "representanteWhatsapp",
  "representante whatsapp": "representanteWhatsapp",
  "rep e mail": "representanteEmail",
  "rep email": "representanteEmail",
  "representante e mail": "representanteEmail",
  "representante email": "representanteEmail",
};

function mapearLinhaImportacao(
  headers: string[],
  valores: unknown[]
): FornecedorImportacaoLinha | null {
  const linha: Partial<FornecedorImportacaoLinha> = {};
  headers.forEach((header, index) => {
    const chave = MAPA_COLUNAS[normalizarChaveColuna(header)];
    if (!chave) return;
    const valor = String(valores[index] ?? "").trim();
    if (!valor) return;
    linha[chave] = valor;
  });

  const nome = texto(linha.nome);
  if (!nome) return null;

  const whatsapp = texto(linha.whatsapp);
  const celular = texto(linha.celular) || whatsapp;

  return {
    nome,
    contato: texto(linha.contato),
    celular,
    whatsapp,
    email: texto(linha.email),
    cpf: texto(linha.cpf),
    cnpj: texto(linha.cnpj),
    categoria: texto(linha.categoria),
    telefoneResidencial: texto(linha.telefoneResidencial),
    telefoneComercial: texto(linha.telefoneComercial),
    cep: texto(linha.cep),
    rua: texto(linha.rua),
    numero: texto(linha.numero),
    cidade: texto(linha.cidade),
    uf: texto(linha.uf),
    bairro: texto(linha.bairro),
    complemento: texto(linha.complemento),
    representanteTelefoneComercial: texto(linha.representanteTelefoneComercial),
    representanteWhatsapp: texto(linha.representanteWhatsapp),
    representanteEmail: texto(linha.representanteEmail),
  };
}

function linhasDeHtmlTable(html: string): FornecedorImportacaoLinha[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];

  const rows = [...table.querySelectorAll("tr")];
  if (rows.length < 2) return [];

  const headers = [...rows[0].querySelectorAll("th,td")].map((c) => c.textContent || "");
  const saida: FornecedorImportacaoLinha[] = [];

  for (const row of rows.slice(1)) {
    const valores = [...row.querySelectorAll("td,th")].map((c) => c.textContent || "");
    const item = mapearLinhaImportacao(headers, valores);
    if (item) saida.push(item);
  }

  return saida;
}

export async function parsearArquivoFornecedoresExcel(
  arquivo: File
): Promise<FornecedorImportacaoLinha[]> {
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
    const saida: FornecedorImportacaoLinha[] = [];

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
  const saida: FornecedorImportacaoLinha[] = [];

  for (const row of matriz.slice(1)) {
    const item = mapearLinhaImportacao(headers, row);
    if (item) saida.push(item);
  }

  return saida;
}

export function fornecedorImportacaoParaFornecedor(
  linha: FornecedorImportacaoLinha,
  id?: string
): FornecedorListagemExport & { id: string } {
  return {
    id: id || crypto.randomUUID(),
    nome: linha.nome,
    contato: linha.contato || "",
    celular: linha.celular || "",
    whatsapp: linha.whatsapp || linha.celular || "",
    email: linha.email || "",
    cpf: linha.cpf || undefined,
    cnpj: linha.cnpj || undefined,
    categoria: linha.categoria || undefined,
    telefoneResidencial: linha.telefoneResidencial || undefined,
    telefoneComercial: linha.telefoneComercial || undefined,
    cep: linha.cep || undefined,
    rua: linha.rua || undefined,
    numero: linha.numero || undefined,
    cidade: linha.cidade || undefined,
    uf: linha.uf || undefined,
    bairro: linha.bairro || undefined,
    complemento: linha.complemento || undefined,
    representanteTelefoneComercial: linha.representanteTelefoneComercial || undefined,
    representanteWhatsapp: linha.representanteWhatsapp || undefined,
    representanteEmail: linha.representanteEmail || undefined,
  };
}
