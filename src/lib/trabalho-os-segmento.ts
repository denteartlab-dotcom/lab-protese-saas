import { parseCurrencyBr } from "@/lib/cliente-financeiro";

export type SegmentoFaturamento = "servico" | "produto" | "transporte";

export type ItemOsLinha = {
  servico: string;
  produtoId?: string;
};

const FRETE_PREFIXO_RE = /^(frete|transporte)\s*:/i;

export function grupoOsIdOf(trabalho: { id: string; grupoOsId?: string | null }) {
  return trabalho.grupoOsId || trabalho.id;
}

/** Todas as linhas da mesma OS (serviço + produto + transporte), incluindo a linha “pai”. */
export function whereGrupoOs(trabalho: { id: string; grupoOsId?: string | null }) {
  const chave = grupoOsIdOf(trabalho);
  return {
    OR: [{ id: chave }, { grupoOsId: chave }],
  };
}

export function classificarItemOs(item: ItemOsLinha): SegmentoFaturamento {
  if (item.produtoId) return "produto";
  const servico = item.servico.trim();
  if (/^produto:/i.test(servico)) return "produto";
  if (FRETE_PREFIXO_RE.test(servico)) return "transporte";
  return "servico";
}

export function nomeExibicaoItemOs(item: ItemOsLinha) {
  return item.servico
    .replace(/^Produto:\s*/i, "")
    .replace(/^(frete|transporte):\s*/i, "")
    .trim();
}

export function valorLiquidoItemOs(item: {
  valor: number;
  desconto?: string;
  descontoTipo?: string;
}) {
  const descontoTexto = item.desconto || "0,00";
  const descontoValor =
    item.descontoTipo === "valor" || descontoTexto.trim().startsWith("R$")
      ? parseCurrencyBr(descontoTexto)
      : item.valor *
        (Math.min(Math.max(Number(descontoTexto.replace(",", ".") || 0), 0), 100) / 100);

  return Math.max(item.valor - descontoValor, 0);
}

export function trechoDescontoLinhaItemOs(
  item: ItemOsLinha & { desconto?: string; descontoTipo?: string }
) {
  if (!itemUsaCamposOdontologicos(item) || !item.desconto) return "";
  const tipo = item.descontoTipo === "valor" ? "valor" : "percentual";
  return ` - desc ${item.desconto} - descTipo ${tipo}`;
}

export function parseDescontoTipoLinhaItem(line: string, desconto: string) {
  const match = line.match(/ - descTipo (percentual|valor)(?: -|$)/i);
  if (match) return match[1].toLowerCase();
  return desconto.startsWith("R$") ? "valor" : "percentual";
}

/** Formato na requisição impressa: `% 5.00` ou `R$ 5,00` (referência Smart Prótese). */
export function formatarDescontoImpressaoOs(desconto?: string, descontoTipo?: string) {
  const texto = (desconto || "").trim();
  if (!texto || texto === "0" || texto === "0,00" || texto === "R$ 0,00") {
    return "% 0.00";
  }
  const tipo =
    descontoTipo === "valor" || texto.startsWith("R$") ? "valor" : "percentual";
  if (tipo === "valor") {
    const valor = parseCurrencyBr(texto);
    return `R$ ${valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  const numerico = texto.replace("%", "").replace(",", ".").trim();
  const pct = Number(numerico);
  if (Number.isFinite(pct)) {
    return `% ${pct.toFixed(2)}`;
  }
  if (texto.startsWith("%")) return texto;
  return `% ${texto}`;
}

export function formatarDescontoItemOs(item: ItemOsLinha & {
  desconto?: string;
  descontoTipo?: string;
}) {
  if (!itemUsaCamposOdontologicos(item)) {
    return "";
  }
  const desconto = (item.desconto || "0,00").trim();
  if (!desconto || desconto === "0" || desconto === "0,00" || desconto === "R$ 0,00") {
    return "";
  }
  return formatarDescontoImpressaoOs(desconto, item.descontoTipo);
}

export function itemUsaCamposOdontologicos(item: ItemOsLinha) {
  return classificarItemOs(item) === "servico";
}

export function itemExibeBadgeProduto(item: ItemOsLinha) {
  return classificarItemOs(item) === "produto";
}

export function itemExibeBadgeTransporte(item: ItemOsLinha) {
  return classificarItemOs(item) === "transporte";
}

export function dividirItensPorSegmento<T extends ItemOsLinha>(itens: T[]) {
  const servico: T[] = [];
  const produto: T[] = [];
  const transporte: T[] = [];
  for (const item of itens) {
    const tipo = classificarItemOs(item);
    if (tipo === "produto") produto.push(item);
    else if (tipo === "transporte") transporte.push(item);
    else servico.push(item);
  }
  return { servico, produto, transporte };
}

export function deveDividirOs<T extends ItemOsLinha>(itens: T[]) {
  const { servico, produto, transporte } = dividirItensPorSegmento(itens);
  if (servico.length > 1) return true;
  const segmentosPreenchidos = [servico, produto, transporte].filter((lista) => lista.length > 0).length;
  return segmentosPreenchidos > 1;
}

export type BlocoSalvarOs<T extends ItemOsLinha = ItemOsLinha> = {
  segmento: SegmentoFaturamento;
  itens: T[];
};

/** Um trabalho por serviço; produto e transporte permanecem em bloco único cada. */
export function planejarBlocosSalvarOs<T extends ItemOsLinha>(itens: T[]): BlocoSalvarOs<T>[] {
  const { servico, produto, transporte } = dividirItensPorSegmento(itens);
  const blocos: BlocoSalvarOs<T>[] = [];
  for (const item of servico) {
    blocos.push({ segmento: "servico", itens: [item] });
  }
  if (produto.length > 0) blocos.push({ segmento: "produto", itens: produto });
  if (transporte.length > 0) blocos.push({ segmento: "transporte", itens: transporte });
  return blocos;
}

export function tituloTrabalhoServicoItem(item: ItemOsLinha) {
  const nome = (item.servico || "").trim();
  return nome || "Serviço";
}

/** Título gravado em Trabalho.tipoProtese por segmento (nunca vazio — exigido pela API). */
export function tituloSegmentoOs(
  itens: ItemOsLinha[],
  segmento: SegmentoFaturamento,
  fallback = ""
) {
  if (segmento === "servico") {
    const primeiro = itens.find((item) => classificarItemOs(item) === "servico");
    const nome = (primeiro?.servico || fallback).trim();
    return nome || "Serviço";
  }

  if (segmento === "transporte") {
    const frete = itens.find((item) => classificarItemOs(item) === "transporte");
    const nome = frete ? nomeExibicaoItemOs(frete) : fallback.trim();
    return nome || "Transporte";
  }

  const produto = itens.find((item) => classificarItemOs(item) === "produto");
  const nome = produto ? nomeExibicaoItemOs(produto) : fallback.trim();
  if (nome) return nome;
  const qtd = itens.filter((item) => classificarItemOs(item) === "produto").length;
  return qtd > 1 ? "Produtos" : "Produto";
}

export function parseItensAdicionadosLinhas(instrucoes?: string | null) {
  return (instrucoes || "")
    .split("\n")
    .filter((line) => line.trim().startsWith("Item adicionado:"));
}

export function itemSomenteFrete(item: ItemOsLinha) {
  return classificarItemOs(item) === "transporte";
}

/** OS antiga: segmento produto com itens só de frete/transporte. */
export function trabalhoSomenteFrete(instrucoes?: string | null) {
  const linhas = parseItensAdicionadosLinhas(instrucoes);
  if (linhas.length === 0) return false;
  return linhas.every((line) => {
    const match = line.match(/^Item adicionado:\s*(.*?)\s*-\s*dentes/i);
    const servico = match?.[1]?.trim() || "";
    return itemSomenteFrete({ servico });
  });
}

export function segmentoEfetivoTrabalho(trabalho: {
  segmentoFaturamento?: string | null;
  instrucoes?: string | null;
}): SegmentoFaturamento {
  const segmento = (trabalho.segmentoFaturamento || "servico") as SegmentoFaturamento;
  if (segmento === "transporte") return "transporte";
  if (segmento === "produto" && trabalhoSomenteFrete(trabalho.instrucoes)) return "transporte";
  return segmento === "produto" ? "produto" : "servico";
}

export type BadgeSegmentoOs = "produto" | "transporte" | null;

export function badgeSegmentoOs(trabalho: {
  segmentoFaturamento?: string | null;
  instrucoes?: string | null;
}): BadgeSegmentoOs {
  const efetivo = segmentoEfetivoTrabalho(trabalho);
  if (efetivo === "produto") return "produto";
  if (efetivo === "transporte") return "transporte";
  return null;
}

export function rotuloSegmentoOs(trabalho: {
  segmentoFaturamento?: string | null;
  instrucoes?: string | null;
}) {
  const badge = badgeSegmentoOs(trabalho);
  if (badge === "transporte") return "Transporte";
  if (badge === "produto") return "Produto";
  return "Serviço";
}

/** Situação exibida na listagem (controle) — Produto/Transporte ou status de produção. */
export function situacaoExibicaoTrabalho(
  trabalho: {
    segmentoFaturamento?: string | null;
    instrucoes?: string | null;
    status: string;
  },
  _primeiroItem?: ItemOsLinha | null
): { kind: "produto" | "transporte" | "status"; status: string } {
  void _primeiroItem;
  const badge = badgeSegmentoOs(trabalho);
  if (badge === "produto") return { kind: "produto", status: trabalho.status };
  if (badge === "transporte") return { kind: "transporte", status: trabalho.status };
  return { kind: "status", status: trabalho.status };
}

export function trabalhoEhProdutoOuTransporte(
  trabalho: {
    segmentoFaturamento?: string | null;
    instrucoes?: string | null;
  },
  _primeiroItem?: ItemOsLinha | null
) {
  void _primeiroItem;
  const efetivo = segmentoEfetivoTrabalho(trabalho);
  return efetivo === "produto" || efetivo === "transporte";
}

/** Itens das instruções que pertencem ao segmento do registro (serviço/produto/transporte). */
export function filtrarItensPorSegmentoTrabalho<
  T extends { servico: string; produtoId?: string },
>(itens: T[], trabalho: { segmentoFaturamento?: string | null; instrucoes?: string | null }) {
  const segmento = segmentoEfetivoTrabalho(trabalho);
  return itens.filter((item) => classificarItemOs(item) === segmento);
}

/** Ficha de OS sem linha de serviço odontológico (só produto/transporte ou ficha vazia). */
export function trabalhoEhFichaSemServico(trabalho: {
  tipoProtese?: string | null;
  instrucoes?: string | null;
  segmentoFaturamento?: string | null;
}) {
  if (segmentoEfetivoTrabalho(trabalho) !== "servico") return false;
  const linhas = parseItensAdicionadosLinhas(trabalho.instrucoes);
  if (linhas.length === 0) {
    const nome = (trabalho.tipoProtese || "").trim();
    return !nome || /^serviço$/i.test(nome) || /^novo serviço$/i.test(nome);
  }
  return linhas.every((line) => {
    const match = line.match(/^Item adicionado:\s*(.*?)\s*-\s*dentes/i);
    const servico = match?.[1]?.trim() || "";
    return classificarItemOs({ servico }) !== "servico";
  });
}

export function editIdPreferidoGrupo(
  grupo: Array<{ id: string; segmentoFaturamento?: string | null }>
) {
  return (
    grupo.find((t) => (t.segmentoFaturamento || "servico") === "servico")?.id ||
    grupo[0]?.id
  );
}

export function filtrarTrabalhoPorSituacaoFaturamento(
  trabalho: { segmentoFaturamento?: string | null; instrucoes?: string | null; status: string },
  situacaoOs: string
) {
  const efetivo = segmentoEfetivoTrabalho(trabalho);
  if (situacaoOs === "produto") return efetivo === "produto";
  if (situacaoOs === "transporte") return efetivo === "transporte";
  return efetivo === "servico" && trabalho.status === situacaoOs;
}

/** Registros de serviço da mesma OS (numeroOs) — vários serviços no mesmo protocolo. */
export function servicosMesmaOs<
  T extends { numeroOs: number; segmentoFaturamento?: string | null; instrucoes?: string | null },
>(trabalhos: T[], numeroOs: number) {
  return trabalhos.filter(
    (trabalho) =>
      trabalho.numeroOs === numeroOs && segmentoEfetivoTrabalho(trabalho) === "servico"
  );
}

/** Segmentos produto da mesma OS (numeroOs), exceto frete legado no segmento produto. */
export function produtosMesmaOs<T extends { numeroOs: number; segmentoFaturamento?: string | null; instrucoes?: string | null }>(
  trabalhos: T[],
  numeroOs: number
) {
  return trabalhos.filter(
    (trabalho) =>
      trabalho.numeroOs === numeroOs && segmentoEfetivoTrabalho(trabalho) === "produto"
  );
}

/** Segmentos transporte da mesma OS (numeroOs), incluindo legado produto+só frete. */
export function transportesMesmaOs<T extends { numeroOs: number; segmentoFaturamento?: string | null; instrucoes?: string | null }>(
  trabalhos: T[],
  numeroOs: number
) {
  return trabalhos.filter(
    (trabalho) =>
      trabalho.numeroOs === numeroOs && segmentoEfetivoTrabalho(trabalho) === "transporte"
  );
}

/** Produto e transporte vinculados ao serviço da mesma OS. */
export function segmentosCobraveisMesmaOs<T extends { numeroOs: number; segmentoFaturamento?: string | null; instrucoes?: string | null }>(
  trabalhos: T[],
  numeroOs: number
) {
  return [...produtosMesmaOs(trabalhos, numeroOs), ...transportesMesmaOs(trabalhos, numeroOs)];
}

export function servicoFinalizadoParaCobranca(status: string) {
  return status === "finalizado" || status === "entregue";
}

/** Situação no Lançar Receita que deve listar produto e transporte da mesma OS. */
export function situacaoReceitaVinculaProdutoTransporte(situacaoOs: string) {
  return servicoFinalizadoParaCobranca(situacaoOs);
}

/**
 * Entregues/finalizados não faturados: quando o serviço da OS está pronto para cobrança,
 * inclui também produto e transporte da mesma OS (ainda não faturados), pois serão cobrados juntos.
 */
export function listarTrabalhosNaoFaturados<
  T extends {
    id: string;
    numeroOs: number;
    status: string;
    segmentoFaturamento?: string | null;
    instrucoes?: string | null;
  },
>(trabalhos: T[], estaFaturado: (trabalho: T) => boolean): T[] {
  const osComServicoPronto = new Set<number>();
  for (const trabalho of trabalhos) {
    if (
      segmentoEfetivoTrabalho(trabalho) === "servico" &&
      servicoFinalizadoParaCobranca(trabalho.status)
    ) {
      osComServicoPronto.add(trabalho.numeroOs);
    }
  }

  const incluidos = new Map<string, T>();
  for (const trabalho of trabalhos) {
    if (!osComServicoPronto.has(trabalho.numeroOs)) continue;
    if (estaFaturado(trabalho)) continue;
    incluidos.set(trabalho.id, trabalho);
  }

  return Array.from(incluidos.values());
}

/** OS com mais de um segmento (serviço, produto e/ou transporte). */
export type RegistroGrupoOs = {
  id: string;
  segmentoFaturamento?: string | null;
  instrucoes?: string | null;
  tipoProtese?: string | null;
};

function nomeServicoItemParaMatch(item: ItemOsLinha) {
  return nomeExibicaoItemOs(item) || item.servico.trim();
}

/** Localiza o trabalho de serviço do grupo que corresponde a um item (vários serviços na mesma OS). */
export function buscarRegistroGrupoItemServico(
  registros: RegistroGrupoOs[],
  item: ItemOsLinha,
  idsUsados: Set<string>
): { reg?: RegistroGrupoOs; migrarSegmento?: SegmentoFaturamento } {
  const disponiveis = registros.filter((r) => !idsUsados.has(r.id));
  const alvo = nomeServicoItemParaMatch(item).toLowerCase();

  for (const reg of disponiveis) {
    if (segmentoEfetivoTrabalho(reg) !== "servico") continue;
    const titulo = (reg.tipoProtese || "").trim().toLowerCase();
    if (titulo && titulo === alvo) return { reg };

    const linhas = parseItensAdicionadosLinhas(reg.instrucoes);
    if (linhas.length === 1) {
      const match = linhas[0].match(/^Item adicionado:\s*(.*?)\s*-\s*dentes/i);
      const nomeLinha = (match?.[1]?.trim() || "").toLowerCase();
      const nomeExib = nomeExibicaoItemOs({ servico: nomeLinha }).toLowerCase();
      if (nomeExib && nomeExib === alvo) return { reg };
    }
  }

  const servicosDisp = disponiveis.filter((r) => segmentoEfetivoTrabalho(r) === "servico");
  if (servicosDisp.length === 1) return { reg: servicosDisp[0] };

  return {};
}

export function buscarRegistroParaBlocoSalvar(
  registros: RegistroGrupoOs[],
  bloco: BlocoSalvarOs,
  idsUsados: Set<string>
): { reg?: RegistroGrupoOs; migrarSegmento?: SegmentoFaturamento } {
  if (bloco.segmento === "servico" && bloco.itens.length === 1) {
    return buscarRegistroGrupoItemServico(registros, bloco.itens[0], idsUsados);
  }
  return buscarRegistroGrupoSegmento(registros, bloco.segmento, idsUsados);
}

/** Localiza o trabalho do grupo para gravar um segmento (inclui legado produto+só frete). */
export function buscarRegistroGrupoSegmento(
  registros: RegistroGrupoOs[],
  segmento: SegmentoFaturamento,
  idsUsados: Set<string>
): { reg?: RegistroGrupoOs; migrarSegmento?: SegmentoFaturamento } {
  const disponiveis = registros.filter((r) => !idsUsados.has(r.id));
  const porEfetivo = disponiveis.find((r) => segmentoEfetivoTrabalho(r) === segmento);
  if (porEfetivo) {
    const raw = (porEfetivo.segmentoFaturamento || "servico") as SegmentoFaturamento;
    const migrar = raw !== segmento ? segmento : undefined;
    return { reg: porEfetivo, migrarSegmento: migrar };
  }

  if (segmento === "transporte") {
    const legadoFrete = disponiveis.find(
      (r) =>
        (r.segmentoFaturamento || "servico") === "produto" &&
        segmentoEfetivoTrabalho(r) === "transporte"
    );
    if (legadoFrete) {
      return { reg: legadoFrete, migrarSegmento: "transporte" };
    }
  }

  if (segmento === "servico") {
    const servico = disponiveis.find((r) => (r.segmentoFaturamento || "servico") === "servico");
    if (servico) return { reg: servico };
  }

  return {};
}

export const ORDEM_SALVAR_SEGMENTOS_OS: SegmentoFaturamento[] = [
  "servico",
  "transporte",
  "produto",
];

export function grupoOsTemMultiplosSegmentos<
  T extends {
    segmentoFaturamento?: string | null;
    instrucoes?: string | null;
  },
>(grupo: T[]) {
  const segmentos = new Set(grupo.map((trabalho) => segmentoEfetivoTrabalho(trabalho)));
  return segmentos.size > 1;
}

export function trabalhosDoMesmoGrupoOsId<
  T extends { id: string; grupoOsId?: string | null },
>(trabalho: T, todos: T[]) {
  const chave = grupoOsIdOf(trabalho);
  return todos.filter((t) => grupoOsIdOf(t) === chave);
}

export function grupoOsTemProdutoOuTransporte<
  T extends {
    segmentoFaturamento?: string | null;
    instrucoes?: string | null;
  },
>(grupo: T[]) {
  return grupo.some((t) => segmentoEfetivoTrabalho(t) !== "servico");
}

export function linhaServicoDoGrupoOs<
  T extends {
    segmentoFaturamento?: string | null;
    instrucoes?: string | null;
  },
>(grupo: T[]) {
  return grupo.find((t) => segmentoEfetivoTrabalho(t) === "servico");
}

/** Todos os registros de serviço do mesmo grupo (vários serviços na mesma OS). */
export function linhasServicoDoGrupoOs<
  T extends {
    segmentoFaturamento?: string | null;
    instrucoes?: string | null;
  },
>(grupo: T[]) {
  return grupo.filter((t) => segmentoEfetivoTrabalho(t) === "servico");
}

type FiltrosControleProducao = {
  filtroProdutos: boolean;
  filtroFichasSemServicos: boolean;
};

/** Visibilidade de uma linha na listagem do Controle de Produção. */
export function deveExibirTrabalhoNoControleProducao<
  T extends {
    tipoProtese?: string | null;
    instrucoes?: string | null;
    segmentoFaturamento?: string | null;
  },
>(
  trabalho: T,
  grupo: T[],
  filtros: FiltrosControleProducao,
  primeiroItem?: ItemOsLinha
) {
  if (trabalhoEhProdutoOuTransporte(trabalho, primeiroItem)) {
    return filtros.filtroProdutos;
  }
  if (trabalhoEhFichaSemServico(trabalho)) {
    if (filtros.filtroFichasSemServicos) return true;
    if (grupoOsTemProdutoOuTransporte(grupo)) return true;
    return false;
  }
  return true;
}

/**
 * Garante a linha de serviço na listagem quando o grupo tem produto/transporte
 * (ex.: produto criado antes do serviço ou ficha de serviço ainda vazia).
 */
export function expandirControleProducaoComServicoDoGrupo<
  T extends {
    id: string;
    grupoOsId?: string | null;
    tipoProtese?: string | null;
    instrucoes?: string | null;
    segmentoFaturamento?: string | null;
  },
>(lista: T[], todosTrabalhos: T[], filtros: FiltrosControleProducao): T[] {
  const porGrupo = new Map<string, T[]>();
  for (const t of todosTrabalhos) {
    const chave = grupoOsIdOf(t);
    const arr = porGrupo.get(chave);
    if (arr) arr.push(t);
    else porGrupo.set(chave, [t]);
  }

  const ids = new Set(lista.map((t) => t.id));
  const extras: T[] = [];

  for (const trabalho of lista) {
    if (segmentoEfetivoTrabalho(trabalho) === "servico") continue;
    const grupo = porGrupo.get(grupoOsIdOf(trabalho)) ?? [];
    for (const servico of linhasServicoDoGrupoOs(grupo)) {
      if (ids.has(servico.id)) continue;
      if (!deveExibirTrabalhoNoControleProducao(servico, grupo, filtros)) continue;
      extras.push(servico);
      ids.add(servico.id);
    }
  }

  if (!extras.length) return lista;
  return [...lista, ...extras];
}

export const ORDEM_SEGMENTO_FATURAMENTO: Record<SegmentoFaturamento, number> = {
  servico: 0,
  produto: 1,
  transporte: 2,
};
