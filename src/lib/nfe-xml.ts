import { dateToBrShort } from "@/lib/datas-br";

export type ItemNfeImportado = {
  produto: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
};

export type DadosNfeImportados = {
  numero: string;
  serie: string;
  referencia: string;
  dataEmissao: string;
  emitenteNome: string;
  emitenteCnpj: string;
  valorTotal: number;
  itens: ItemNfeImportado[];
};

function tagLocal(tag: string) {
  const part = tag.split(":");
  return part[part.length - 1] || tag;
}

function filhosPorTag(pai: Element, nome: string): Element[] {
  const alvo = tagLocal(nome);
  return Array.from(pai.children).filter((el) => tagLocal(el.tagName) === alvo);
}

function primeiroFilho(pai: Element | null, nome: string): Element | null {
  if (!pai) return null;
  return filhosPorTag(pai, nome)[0] ?? null;
}

function textoFilho(pai: Element | null, nome: string): string {
  return primeiroFilho(pai, nome)?.textContent?.trim() || "";
}

function numeroTexto(valor: string) {
  const n = Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyBr(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseDataEmissao(ide: Element | null): string {
  const dh = textoFilho(ide, "dhEmi");
  if (dh) {
    const d = new Date(dh);
    if (!Number.isNaN(d.getTime())) return dateToBrShort(d);
  }
  const dEmi = textoFilho(ide, "dEmi");
  if (/^\d{4}-\d{2}-\d{2}/.test(dEmi)) {
    const [ano, mes, dia] = dEmi.slice(0, 10).split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return dateToBrShort(new Date());
}

function extrairItens(infNfe: Element): ItemNfeImportado[] {
  const itens: ItemNfeImportado[] = [];
  for (const det of filhosPorTag(infNfe, "det")) {
    const prod = primeiroFilho(det, "prod");
    if (!prod) continue;
    const nome = textoFilho(prod, "xProd") || textoFilho(prod, "cProd");
    const qtd = numeroTexto(textoFilho(prod, "qCom") || "1") || 1;
    const vUn = numeroTexto(textoFilho(prod, "vUnCom"));
    const vProd = numeroTexto(textoFilho(prod, "vProd"));
    const unit = vUn > 0 ? vUn : qtd > 0 ? vProd / qtd : vProd;
    itens.push({
      produto: nome,
      descricao: nome,
      quantidade: qtd,
      valorUnitario: unit,
    });
  }
  return itens;
}

function encontrarInfNfe(doc: Document): Element | null {
  const porId = doc.querySelector("infNFe");
  if (porId) return porId;

  const todos = doc.getElementsByTagName("*");
  for (let i = 0; i < todos.length; i++) {
    const el = todos[i];
    if (tagLocal(el.tagName) === "infNFe") return el;
  }
  return null;
}

/** Lê XML de NF-e (modelo 55) e extrai dados para lançamento de despesa. */
export function parseNfeXml(xmlText: string): DadosNfeImportados {
  const texto = xmlText.trim();
  if (!texto) {
    throw new Error("Arquivo XML vazio.");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(texto, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("XML inválido ou corrompido.");
  }

  const infNfe = encontrarInfNfe(doc);
  if (!infNfe) {
    throw new Error("Não foi possível localizar a NF-e no XML.");
  }

  const ide = primeiroFilho(infNfe, "ide");
  const emit = primeiroFilho(infNfe, "emit");
  const total = primeiroFilho(infNfe, "total");
  const icmsTot = primeiroFilho(total, "ICMSTot");

  const numero = textoFilho(ide, "nNF");
  const serie = textoFilho(ide, "serie");
  const emitenteNome =
    textoFilho(emit, "xNome") || textoFilho(emit, "xFant") || "";
  const emitenteCnpj =
    textoFilho(emit, "CNPJ") || textoFilho(emit, "CPF") || "";

  let valorTotal = numeroTexto(textoFilho(icmsTot, "vNF"));
  if (valorTotal <= 0) {
    valorTotal = numeroTexto(textoFilho(icmsTot, "vProd"));
  }

  const itens = extrairItens(infNfe);
  if (valorTotal <= 0 && itens.length > 0) {
    valorTotal = itens.reduce(
      (s, item) => s + item.valorUnitario * item.quantidade,
      0
    );
  }
  if (valorTotal <= 0) {
    throw new Error("Não foi possível identificar o valor total da nota.");
  }

  const referencia = [numero, serie].filter(Boolean).join("/") || numero || "NF-e";

  return {
    numero,
    serie,
    referencia: numero ? `NF ${referencia}` : "NF-e",
    dataEmissao: parseDataEmissao(ide),
    emitenteNome,
    emitenteCnpj,
    valorTotal,
    itens:
      itens.length > 0
        ? itens
        : [
            {
              produto: emitenteNome || "Nota fiscal",
              descricao: `Importado NF ${referencia}`,
              quantidade: 1,
              valorUnitario: valorTotal,
            },
          ],
  };
}

export function formatQuantidadeNfe(qtd: number) {
  if (Number.isInteger(qtd)) return String(qtd);
  return String(qtd).replace(".", ",");
}

export { formatMoneyBr as formatMoneyBrNfe };

export type FornecedorMatch = { id: string; nome: string; cnpj?: string };

export function lerFornecedoresComCnpj(): FornecedorMatch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("labProteseFornecedores");
    if (!raw) return [];
    const lista = JSON.parse(raw) as Array<{
      id: string;
      nome?: string;
      razaoSocial?: string;
      cnpj?: string;
    }>;
    if (!Array.isArray(lista)) return [];
    return lista.map((f) => ({
      id: f.id,
      nome: (f.nome || f.razaoSocial || "Fornecedor").trim(),
      cnpj: f.cnpj,
    }));
  } catch {
    return [];
  }
}

function normalizarNome(nome: string) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Encontra fornecedor cadastrado por CNPJ ou nome (emitente da NF-e). */
export function encontrarFornecedorPorNfe(
  emitenteNome: string,
  emitenteCnpj: string,
  entidades: FornecedorMatch[]
): string {
  const cnpjNota = emitenteCnpj.replace(/\D/g, "");
  if (cnpjNota) {
    const porCnpj = entidades.find(
      (f) => (f.cnpj || "").replace(/\D/g, "") === cnpjNota
    );
    if (porCnpj) return porCnpj.id;
  }

  const nomeNota = normalizarNome(emitenteNome);
  if (!nomeNota) return "";

  const exato = entidades.find((f) => normalizarNome(f.nome) === nomeNota);
  if (exato) return exato.id;

  const parcial = entidades.find((f) => {
    const n = normalizarNome(f.nome);
    return n.includes(nomeNota) || nomeNota.includes(n);
  });
  return parcial?.id || "";
}
