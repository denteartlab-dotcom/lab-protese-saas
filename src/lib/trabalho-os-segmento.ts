export type SegmentoFaturamento = "servico" | "produto" | "transporte";

export type ItemOsLinha = {
  servico: string;
  produtoId?: string;
};

const FRETE_PREFIXO_RE = /^(frete|transporte)\s*:/i;

export function grupoOsIdOf(trabalho: { id: string; grupoOsId?: string | null }) {
  return trabalho.grupoOsId || trabalho.id;
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
  if (item.descontoTipo === "valor" || desconto.startsWith("R$")) {
    return desconto.startsWith("R$") ? desconto : `R$ ${desconto}`;
  }
  return desconto.includes("%") ? desconto : `${desconto}%`;
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
  const segmentosPreenchidos = [servico, produto, transporte].filter((lista) => lista.length > 0).length;
  return segmentosPreenchidos > 1;
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
  primeiroItem?: ItemOsLinha | null
): { kind: "produto" | "transporte" | "status"; status: string } {
  const badge = badgeSegmentoOs(trabalho);
  if (badge === "produto") return { kind: "produto", status: trabalho.status };
  if (badge === "transporte") return { kind: "transporte", status: trabalho.status };
  if (primeiroItem) {
    if (itemExibeBadgeTransporte(primeiroItem)) return { kind: "transporte", status: trabalho.status };
    if (itemExibeBadgeProduto(primeiroItem)) return { kind: "produto", status: trabalho.status };
  }
  return { kind: "status", status: trabalho.status };
}

export function trabalhoEhProdutoOuTransporte(
  trabalho: {
    segmentoFaturamento?: string | null;
    instrucoes?: string | null;
    status: string;
  },
  primeiroItem?: ItemOsLinha | null
) {
  const exibicao = situacaoExibicaoTrabalho(trabalho, primeiroItem);
  return exibicao.kind === "produto" || exibicao.kind === "transporte";
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

/** OS com mais de um segmento (serviço, produto e/ou transporte). */
export type RegistroGrupoOs = {
  id: string;
  segmentoFaturamento?: string | null;
  instrucoes?: string | null;
};

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

export const ORDEM_SEGMENTO_FATURAMENTO: Record<SegmentoFaturamento, number> = {
  servico: 0,
  produto: 1,
  transporte: 2,
};
