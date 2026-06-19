import { parseEtapasInstrucoes } from "@/lib/etapas-os-impressao";
import {
  classificarItemOs,
  itemExibeBadgeProduto,
  itemExibeBadgeTransporte,
  itemUsaCamposOdontologicos,
  nomeExibicaoItemOs,
  parseDescontoTipoLinhaItem,
  formatarDescontoImpressaoOs,
  segmentoEfetivoTrabalho,
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
  descontoTipo?: string;
  tipo: TipoItemImpressaoOs;
  /** Linhas extras abaixo do item (ex.: prazos do serviço). */
  notasAbaixo?: string[];
};

function descontoImpressao(desconto?: string, descontoTipo?: string) {
  return formatarDescontoImpressaoOs(desconto, descontoTipo);
}

function parseMoney(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(normalized) || 0;
}

/** Ex.: `Trilux - A2` quando há escala e cor na OS. */
export function formatarCorEscalaImpressaoOs(
  escala?: string | null,
  cor?: string | null
): string {
  const escalaTexto = (escala || "").trim();
  const corTexto = (cor || "").trim();
  const escalaValida = escalaTexto && escalaTexto !== "-";
  const corValida = corTexto && corTexto !== "-";

  if (escalaValida && corValida) return `${escalaTexto} - ${corTexto}`;
  if (corValida) return corTexto;
  if (escalaValida) return escalaTexto;
  return "";
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

function parseLinhaItemAdicionado(
  line: string,
  escalaPadrao?: string | null
): ItemImpressaoOs | null {
  const match = line.match(
    /^Item adicionado:\s*(.*?)\s*-\s*dentes\s*(.*?)\s*-\s*cor\s*(.*?)\s*-\s*qtd\s*(.*?)\s*-\s*valor\s*(.*)$/i
  );
  if (!match) return null;

  const servico = match[1]?.trim() || "";
  const produtoId = line.match(/ - produtoId (.*?)(?: - urgente| - repetição| - repeticao| - obs|$)/i)?.[1]?.trim();
  const itemLinha: ItemOsLinha = { servico, produtoId: produtoId || undefined };

  const dente = match[2]?.trim() || "";
  const corLinha = match[3]?.trim() || "";
  const escalaLinha =
    line.match(
      / - categoria (.*?)(?: - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
    )?.[1]?.trim() || "";
  const escalaEfetiva = escalaLinha || escalaPadrao || "";
  const qtd = match[4]?.trim() || "1";
  const valorText =
    line.match(
      / - valor (.*?)(?: - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
    )?.[1] ||
    match[5] ||
    "R$ 0,00";
  const total = parseMoney(valorText);
  const quantidade = Number(String(qtd).replace(",", ".")) || 1;
  const descontoRaw = line
    .match(
      / - desc (.*?)(?: - descTipo| - categoria| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
    )?.[1]
    ?.trim();
  const descontoTipo = parseDescontoTipoLinhaItem(line, descontoRaw || "");

  const { tipo, descricao } = descricaoImpressao(itemLinha);
  const odontologico = itemUsaCamposOdontologicos(itemLinha);

  return {
    qtd,
    descricao,
    dente: odontologico && dente !== "-" ? dente : "",
    cor: odontologico ? formatarCorEscalaImpressaoOs(escalaEfetiva, corLinha) : "",
    unitario: quantidade > 0 ? total / quantidade : total,
    desconto: tipo === "servico" ? descontoImpressao(descontoRaw, descontoTipo) : "",
    descontoTipo: tipo === "servico" ? descontoTipo : undefined,
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

function lineValueInstrucoes(linhas: string[], prefix: string) {
  return linhas.find((line) => line.startsWith(prefix))?.replace(prefix, "").trim() || "";
}

/** Contexto de prazo/etapa a partir das instruções de um único trabalho (serviço). */
export function ctxPrazosDeInstrucoesTrabalho(
  instrucoes: string | null | undefined,
  opts: {
    status: string;
    statusLabel: string;
    dataPrevista?: string;
    dataEntrega?: string;
    dataEntrada?: string;
  }
): ContextoPrazosImpressao {
  const texto = instrucoes || "";
  const linhas = texto
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const etapas = parseEtapasInstrucoes(texto);
  const etapaCorrente =
    etapas.filter((etapa) => etapa.nome.trim()).at(-1) ?? etapas.at(-1);

  return {
    status: opts.status,
    statusLabel: opts.statusLabel,
    etapaAtual: etapaCorrente?.nome.trim() || undefined,
    etapaPrazo: extrairDataPrazoBr(etapaCorrente?.prazo),
    dataPrevista: opts.dataPrevista,
    dataEntrega: opts.dataEntrega,
    dataEntrada: opts.dataEntrada,
    prazoLaboratorio: extrairDataPrazoBr(lineValueInstrucoes(linhas, "Data laboratório:")),
    prazoDentista: extrairDataPrazoBr(lineValueInstrucoes(linhas, "Data dentista:")),
    textoInstrucoes: texto,
  };
}

export type TrabalhoPrazoImpressao = {
  tipoProtese?: string | null;
  instrucoes?: string | null;
  status: string;
  dataPrevista?: Date | string | null;
  dataEntrega?: Date | string | null;
  dataEntrada?: Date | string | null;
  segmentoFaturamento?: string | null;
};

function normalizarNomeServicoImpressao(nome: string) {
  return nome.trim().toLowerCase();
}

function trabalhoServicoParaItem(
  item: ItemImpressaoOs,
  trabalhos: TrabalhoPrazoImpressao[]
): TrabalhoPrazoImpressao | undefined {
  const alvo = normalizarNomeServicoImpressao(item.descricao);
  const servicos = trabalhos.filter((t) => segmentoEfetivoTrabalho(t) === "servico");
  const exato = servicos.find(
    (t) => normalizarNomeServicoImpressao(t.tipoProtese || "") === alvo
  );
  if (exato) return exato;

  const linhaItem = servicos.find((t) => {
    const linhas = (t.instrucoes || "").split("\n");
    return linhas.some((line) => {
      const match = line.match(/^Item adicionado:\s*(.*?)\s*-\s*dentes/i);
      const nome = (match?.[1]?.trim() || t.tipoProtese || "").trim();
      return normalizarNomeServicoImpressao(nomeExibicaoItemOs({ servico: nome })) === alvo;
    });
  });
  return linhaItem;
}

/** Cada linha de serviço na requisição usa a etapa/prazo do trabalho correspondente no grupo. */
export function anexarPrazosServicoPorTrabalho(
  itens: ItemImpressaoOs[],
  trabalhos: TrabalhoPrazoImpressao[],
  statusLabel: (status: string) => string
): ItemImpressaoOs[] {
  return itens.map((item) => {
    if (item.tipo !== "servico") return item;
    const trabalho = trabalhoServicoParaItem(item, trabalhos);
    if (!trabalho) return item;

    const formatarData = (value?: Date | string | null) => {
      if (!value) return "";
      const iso = value instanceof Date ? value.toISOString() : String(value);
      const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return `${match[3]}/${match[2]}/${match[1]}`;
      const br = iso.match(/\d{2}\/\d{2}\/\d{4}/);
      return br ? br[0] : "";
    };

    const ctx = ctxPrazosDeInstrucoesTrabalho(trabalho.instrucoes, {
      status: trabalho.status,
      statusLabel: statusLabel(trabalho.status),
      dataPrevista: formatarData(trabalho.dataPrevista),
      dataEntrega: formatarData(trabalho.dataEntrega),
      dataEntrada: formatarData(trabalho.dataEntrada),
    });
    const linha = linhaPrazoImpressaoOs(ctx);
    return linha ? { ...item, notasAbaixo: [linha] } : { ...item, notasAbaixo: undefined };
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
    escala?: string | null;
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
    .map((line) => parseLinhaItemAdicionado(line, fallback?.escala))
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
          cor: formatarCorEscalaImpressaoOs(fallback.escala, fallback.cor),
          unitario: fallback.valor,
          desconto: "",
          tipo,
        },
      ];
    }
  }

  if (ctxPrazos.etapaAtual || ctxPrazos.etapaPrazo || ctxPrazos.textoInstrucoes) {
    return anexarPrazosServico(resultado, ctxPrazos);
  }
  return resultado;
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
