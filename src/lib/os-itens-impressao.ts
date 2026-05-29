import {
  classificarItemOs,
  itemExibeBadgeProduto,
  itemExibeBadgeTransporte,
  itemUsaCamposOdontologicos,
  nomeExibicaoItemOs,
  type ItemOsLinha,
  type SegmentoFaturamento,
} from "@/lib/trabalho-os-segmento";

export type TipoItemImpressaoOs = "servico" | "produto" | "transporte";

export type ItemImpressaoOs = {
  qtd: string;
  descricao: string;
  dente: string;
  cor: string;
  unitario: number;
  desconto: string;
  tipo: TipoItemImpressaoOs;
  /** Linhas extras abaixo do item (ex.: prazos do serviço). */
  notasAbaixo?: string[];
};

function parseMoney(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(normalized) || 0;
}

function descontoImpressao(desconto?: string) {
  const texto = (desconto || "").trim();
  if (!texto || texto === "0" || texto === "0,00" || texto === "R$ 0,00") return "% 0.00";
  if (texto.startsWith("R$")) return texto;
  const numerico = texto.replace("%", "").replace(",", ".").trim();
  const valor = Number(numerico);
  if (Number.isFinite(valor)) {
    return `% ${valor.toFixed(2)}`;
  }
  return texto.includes("%") ? texto : `% ${texto}`;
}

function descricaoImpressao(item: ItemOsLinha): { tipo: TipoItemImpressaoOs; descricao: string } {
  const nome = nomeExibicaoItemOs(item);
  if (itemExibeBadgeTransporte(item)) {
    return { tipo: "transporte", descricao: `${nome} ( Transporte )` };
  }
  if (itemExibeBadgeProduto(item)) {
    return { tipo: "produto", descricao: `${nome} ( Produto )` };
  }
  return { tipo: "servico", descricao: nome || item.servico.trim() };
}

function parseLinhaItemAdicionado(line: string): ItemImpressaoOs | null {
  const match = line.match(
    /^Item adicionado:\s*(.*?)\s*-\s*dentes\s*(.*?)\s*-\s*cor\s*(.*?)\s*-\s*qtd\s*(.*?)\s*-\s*valor\s*(.*)$/i
  );
  if (!match) return null;

  const servico = match[1]?.trim() || "";
  const produtoId = line.match(/ - produtoId (.*?)(?: - urgente| - repetição| - repeticao| - obs|$)/i)?.[1]?.trim();
  const itemLinha: ItemOsLinha = { servico, produtoId: produtoId || undefined };

  const dente = match[2]?.trim() || "";
  const cor = match[3]?.trim() || "";
  const qtd = match[4]?.trim() || "1";
  const valorText =
    line.match(
      / - valor (.*?)(?: - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
    )?.[1] ||
    match[5] ||
    "R$ 0,00";
  const total = parseMoney(valorText);
  const quantidade = Number(String(qtd).replace(",", ".")) || 1;
  const descontoRaw = line.match(
    / - desc (.*?)(?: - categoria| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
  )?.[1];

  const { tipo, descricao } = descricaoImpressao(itemLinha);
  const odontologico = itemUsaCamposOdontologicos(itemLinha);

  return {
    qtd,
    descricao,
    dente: odontologico && dente !== "-" ? dente : "",
    cor: odontologico && cor !== "-" ? cor : "",
    unitario: quantidade > 0 ? total / quantidade : total,
    desconto: tipo === "servico" ? descontoImpressao(descontoRaw) : "",
    tipo,
  };
}

const ORDEM_TIPO: Record<TipoItemImpressaoOs, number> = {
  servico: 0,
  produto: 1,
  transporte: 2,
};

export function ordenarItensImpressao(itens: ItemImpressaoOs[]) {
  return [...itens].sort((a, b) => ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo]);
}

export type ContextoPrazosImpressao = {
  /** Status bruto da OS (ex.: producao, finalizado). */
  status?: string;
  /** Rótulo da situação (ex.: Produção) — usado se não houver etapa. */
  statusLabel?: string;
  /** Nome da etapa em andamento (última etapa preenchida na OS). */
  etapaAtual?: string;
  /** Prazo da etapa atual ou do laboratório. */
  etapaPrazo?: string;
  dataPrevista?: string;
  dataEntrega?: string;
  prazoLaboratorio?: string;
  prazoDentista?: string;
  /** Texto completo das instruções (fallback para achar datas). */
  textoInstrucoes?: string;
  /** Data de entrada da OS (último fallback para exibir prazo na requisição). */
  dataEntrada?: string;
};

/** Extrai dd/mm/aaaa de textos como "20/05/2026 14:00". */
export function extrairDataPrazoBr(texto?: string | null) {
  const valor = (texto || "").trim();
  if (!valor) return "";
  const match = valor.match(/\d{2}\/\d{2}\/\d{4}/);
  return match ? match[0] : valor;
}

function statusOsFinalizado(status?: string) {
  const chave = (status || "").trim().toLowerCase();
  return chave === "finalizado" || chave === "entregue";
}

export function primeiraDataNasInstrucoes(texto?: string | null) {
  const match = (texto || "").match(/\d{2}\/\d{2}\/\d{4}/);
  return match?.[0] || "";
}

function resolverDataPrazoImpressao(ctx: ContextoPrazosImpressao) {
  const fontes = [
    ctx.etapaPrazo,
    ctx.prazoLaboratorio,
    ctx.dataPrevista,
    ctx.dataEntrega,
    ctx.prazoDentista,
    ctx.dataEntrada,
    primeiraDataNasInstrucoes(ctx.textoInstrucoes),
  ];
  for (const fonte of fontes) {
    const data = extrairDataPrazoBr(fonte);
    if (data) return data;
  }
  return "";
}

/** Linha exibida abaixo do serviço na requisição: `Prazo: Etapa: data` ou `Prazo: Finalizado: data`. */
export function linhaPrazoImpressaoOs(ctx: ContextoPrazosImpressao) {
  const data = resolverDataPrazoImpressao(ctx);
  if (!data) return null;

  if (statusOsFinalizado(ctx.status)) {
    return `Prazo: Finalizado: ${data}`;
  }

  const rotulo =
    (ctx.etapaAtual || "").trim() ||
    (ctx.statusLabel || "").trim() ||
    "Produção";
  return `Prazo: ${rotulo}: ${data}`;
}

function anexarPrazosServico(itens: ItemImpressaoOs[], ctx: ContextoPrazosImpressao) {
  const linhaPrazo = linhaPrazoImpressaoOs(ctx);
  if (!linhaPrazo) return itens;

  return itens.map((item) => {
    if (item.tipo !== "servico") return item;
    return { ...item, notasAbaixo: [linhaPrazo] };
  });
}

export function filtrarItensImpressaoPorSegmento(
  itens: ItemImpressaoOs[],
  segmento: SegmentoFaturamento
) {
  return itens.filter((item) => item.tipo === segmento);
}

export function extrairItensImpressaoOs(
  instrucoesBlocos: Array<string | null | undefined>,
  fallback?: {
    tipoProtese: string;
    dentes?: string | null;
    cor?: string | null;
    valor: number;
  },
  ctxPrazos: ContextoPrazosImpressao = {},
  /** Quando definido, mantém só linhas deste segmento (serviço/produto/transporte). */
  segmentoFiltro?: SegmentoFaturamento | null
): ItemImpressaoOs[] {
  const linhas = instrucoesBlocos
    .flatMap((texto) => (texto || "").split("\n"))
    .map((l) => l.trim())
    .filter((l) => l.startsWith("Item adicionado:"));

  const itens = linhas
    .map(parseLinhaItemAdicionado)
    .filter((item): item is ItemImpressaoOs => item !== null);

  const unicos = new Map<string, ItemImpressaoOs>();
  for (const item of itens) {
    const chave = `${item.tipo}|${item.descricao}|${item.qtd}|${item.unitario}`;
    unicos.set(chave, item);
  }

  let resultado = ordenarItensImpressao([...unicos.values()]);

  if (segmentoFiltro) {
    resultado = filtrarItensImpressaoPorSegmento(resultado, segmentoFiltro);
  }

  if (resultado.length === 0 && fallback) {
    const itemFallback: ItemOsLinha = { servico: fallback.tipoProtese };
    const { tipo, descricao } = descricaoImpressao(itemFallback);
    if (!segmentoFiltro || tipo === segmentoFiltro) {
      resultado = [
        {
          qtd: "1",
          descricao: classificarItemOs(itemFallback) === "servico" ? descricao : `${descricao}`,
          dente: fallback.dentes || "",
          cor: fallback.cor || "",
          unitario: fallback.valor,
          desconto: "",
          tipo,
        },
      ];
    }
  }

  return anexarPrazosServico(resultado, ctxPrazos);
}

/** Indica se há item com urgente e/ou repetição nas instruções (opcionalmente por segmento). */
export function flagsUrgenteRepeticaoInstrucoes(
  instrucoesBlocos: Array<string | null | undefined>,
  segmentoFiltro?: SegmentoFaturamento | null
) {
  const linhas = instrucoesBlocos
    .flatMap((texto) => (texto || "").split("\n"))
    .map((l) => l.trim())
    .filter((l) => l.startsWith("Item adicionado:"));

  let urgente = false;
  let repeticao = false;

  for (const line of linhas) {
    const item = parseLinhaItemAdicionado(line);
    if (!item) continue;
    if (segmentoFiltro && item.tipo !== segmentoFiltro) continue;
    if (/ - urgente(?: -|$)/i.test(line)) urgente = true;
    if (/ - repetição(?: -|$)| - repeticao(?: -|$)/i.test(line)) repeticao = true;
  }

  return { urgente, repeticao };
}
