import { prisma } from "@/lib/db";
import { parseCurrencyBr } from "@/lib/cliente-financeiro";
import { parseParcelaNaDescricao } from "@/lib/fatura-financeiro-util";
import { invalidarCachePainelFinanceiro } from "@/lib/financeiro-painel-cache";
import {
  idsTrabalhosFaturadosNoLancamento,
  lancamentoCreditoUtilizado,
  lancamentoFaturaOsAtivo,
  numerosOsDoLancamentoFatura,
  trabalhoEstaFaturado,
} from "@/lib/os-faturamento";
import { sincronizarMovimentacaoRecebimentoServidor } from "@/lib/recebimento-conta-bancaria-servidor";
import { valorTrabalho } from "@/lib/relatorio-faturas-modelo3-dados";
import {
  parseDescontoTipoLinhaItem,
  valorLiquidoDeLinhaItemAdicionado,
} from "@/lib/trabalho-os-segmento";

type TrabalhoValor = {
  id: string;
  numeroOs: number;
  clienteId: string | null;
  instrucoes: string | null;
  valor: number;
  tipoProtese: string | null;
};

type LancamentoCobranca = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  status: string;
  data: Date;
  clienteId: string | null;
  trabalho: { id: string; numeroOs: number } | null;
};

function descricaoBaseFatura(descricao: string) {
  return descricao.replace(/\(\d+\s*\/\s*\d+\)\s*$/, "").trim();
}

function chaveGrupoFatura(lancamento: { descricao: string; clienteId: string | null }) {
  return `${lancamento.clienteId ?? ""}::${descricaoBaseFatura(lancamento.descricao)}`;
}

async function carregarTrabalhosDaCobranca(
  empresaId: string,
  lancamento: LancamentoCobranca,
  trabalhoAtualizado?: TrabalhoValor
) {
  const ids = idsTrabalhosFaturadosNoLancamento(lancamento);
  let trabalhos: TrabalhoValor[] = [];

  if (ids.length > 0) {
    trabalhos = await prisma.trabalho.findMany({
      where: { empresaId, id: { in: ids } },
      select: {
        id: true,
        numeroOs: true,
        clienteId: true,
        instrucoes: true,
        valor: true,
        tipoProtese: true,
      },
    });
  } else {
    const numeros = numerosOsDoLancamentoFatura(lancamento);
    if (!numeros.length) return [];
    trabalhos = await prisma.trabalho.findMany({
      where: {
        empresaId,
        numeroOs: { in: numeros },
        ...(lancamento.clienteId ? { clienteId: lancamento.clienteId } : {}),
      },
      select: {
        id: true,
        numeroOs: true,
        clienteId: true,
        instrucoes: true,
        valor: true,
        tipoProtese: true,
      },
    });
  }

  return trabalhoAtualizado
    ? trabalhos.map((t) =>
        t.id === trabalhoAtualizado.id ? { ...t, ...trabalhoAtualizado } : t
      )
    : trabalhos;
}

function formatarValorLinhaItem(valor: number) {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function substituirValorLiquidoLinhaItem(line: string, novoLiquido: number) {
  const valorMatch = line.match(
    /( - valor )(.*?)(?= - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
  );
  if (!valorMatch) return line;

  const descontoRaw = line
    .match(
      / - desc (.*?)(?: - descTipo| - categoria| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
    )?.[1]
    ?.trim();
  const descontoTipo = parseDescontoTipoLinhaItem(line, descontoRaw || "");

  let novoBruto = novoLiquido;
  if (descontoRaw && descontoRaw !== "0" && descontoRaw !== "0,00" && descontoRaw !== "R$ 0,00") {
    if (descontoTipo === "valor" || descontoRaw.startsWith("R$")) {
      novoBruto = novoLiquido + parseCurrencyBr(descontoRaw);
    } else {
      const pct = Math.min(Math.max(Number(descontoRaw.replace(",", ".") || 0), 0), 100);
      novoBruto = pct >= 100 ? novoLiquido : novoLiquido / (1 - pct / 100);
    }
  }

  return line.replace(valorMatch[0], ` - valor ${formatarValorLinhaItem(novoBruto)}`);
}

function aplicarValorAoTrabalho(trabalho: TrabalhoValor, novoValor: number) {
  const valorArred = Math.round(novoValor * 100) / 100;
  const linhas = (trabalho.instrucoes || "").split("\n");
  const indicesItens: number[] = [];
  linhas.forEach((line, i) => {
    if (line.trim().startsWith("Item adicionado:")) indicesItens.push(i);
  });

  if (indicesItens.length === 0) {
    return { valor: valorArred };
  }

  const liquidoAtual = indicesItens.reduce(
    (sum, i) => sum + (valorLiquidoDeLinhaItemAdicionado(linhas[i]) ?? 0),
    0
  );

  const novasLinhas = [...linhas];
  if (indicesItens.length === 1) {
    novasLinhas[indicesItens[0]] = substituirValorLiquidoLinhaItem(
      linhas[indicesItens[0]],
      valorArred
    );
    return { instrucoes: novasLinhas.join("\n") };
  }

  let restante = valorArred;
  for (let idx = 0; idx < indicesItens.length; idx++) {
    const i = indicesItens[idx];
    let novoLiq: number;
    if (idx === indicesItens.length - 1) {
      novoLiq = Math.round(restante * 100) / 100;
    } else {
      const liq = valorLiquidoDeLinhaItemAdicionado(linhas[i]) ?? 0;
      const proporcao =
        liquidoAtual > 0 ? liq / liquidoAtual : 1 / indicesItens.length;
      novoLiq = Math.round(valorArred * proporcao * 100) / 100;
      restante = Math.round((restante - novoLiq) * 100) / 100;
    }
    novasLinhas[i] = substituirValorLiquidoLinhaItem(linhas[i], novoLiq);
  }

  return { instrucoes: novasLinhas.join("\n") };
}

function distribuirValorEntreTrabalhos(trabalhos: TrabalhoValor[], novoTotal: number) {
  if (!trabalhos.length) return [];
  if (trabalhos.length === 1) {
    return [{ trabalho: trabalhos[0], valor: Math.round(novoTotal * 100) / 100 }];
  }

  const pesos = trabalhos.map((t) => valorTrabalho(t));
  const somaPesos = pesos.reduce((sum, v) => sum + v, 0);
  let restante = novoTotal;
  const resultado: Array<{ trabalho: TrabalhoValor; valor: number }> = [];

  for (let i = 0; i < trabalhos.length; i++) {
    let valor: number;
    if (i === trabalhos.length - 1) {
      valor = Math.round(restante * 100) / 100;
    } else {
      const proporcao =
        somaPesos > 0 ? pesos[i] / somaPesos : 1 / trabalhos.length;
      valor = Math.round(novoTotal * proporcao * 100) / 100;
      restante = Math.round((restante - valor) * 100) / 100;
    }
    resultado.push({ trabalho: trabalhos[i], valor });
  }

  return resultado;
}

function totalTrabalhos(trabalhos: TrabalhoValor[]) {
  return Math.round(trabalhos.reduce((sum, t) => sum + valorTrabalho(t), 0) * 100) / 100;
}

async function atualizarValorLancamento(empresaId: string, id: string, valor: number) {
  const atualizado = await prisma.lancamento.update({
    where: { id },
    data: { valor },
  });
  if (atualizado.status === "pago" && atualizado.tipo === "receita") {
    try {
      await sincronizarMovimentacaoRecebimentoServidor(empresaId, atualizado);
    } catch (err) {
      console.warn("[os-faturamento-sync] sync conta bancária", err);
    }
  }
  return atualizado;
}

async function redistribuirValorParcelas(
  empresaId: string,
  parcelas: LancamentoCobranca[],
  novoTotal: number
) {
  const totalAtual = parcelas.reduce((sum, l) => sum + l.valor, 0);
  if (Math.abs(novoTotal - totalAtual) <= 0.009) return;

  const ordenadas = parcelas.slice().sort((a, b) => {
    const pa = parseParcelaNaDescricao(a.descricao)?.numero ?? 1;
    const pb = parseParcelaNaDescricao(b.descricao)?.numero ?? 1;
    return pa - pb;
  });

  if (ordenadas.length === 1) {
    await atualizarValorLancamento(empresaId, ordenadas[0].id, novoTotal);
    return;
  }

  let restante = novoTotal;
  for (let i = 0; i < ordenadas.length; i++) {
    let novoValor: number;
    if (i === ordenadas.length - 1) {
      novoValor = Math.round(restante * 100) / 100;
    } else {
      const proporcao =
        totalAtual > 0 ? ordenadas[i].valor / totalAtual : 1 / ordenadas.length;
      novoValor = Math.round(novoTotal * proporcao * 100) / 100;
      restante = Math.round((restante - novoValor) * 100) / 100;
    }
    await atualizarValorLancamento(empresaId, ordenadas[i].id, novoValor);
  }
}

/**
 * Recalcula Contas a Receber quando o valor de uma OS já faturada é alterado na produção.
 */
export async function sincronizarContasReceberAposAlteracaoTrabalho(
  empresaId: string,
  trabalhoAtualizado: TrabalhoValor
) {
  const lancamentos = await prisma.lancamento.findMany({
    where: { empresaId, tipo: "receita" },
    select: {
      id: true,
      tipo: true,
      descricao: true,
      valor: true,
      status: true,
      data: true,
      clienteId: true,
      trabalho: { select: { id: true, numeroOs: true } },
    },
  });

  const cobrancasAtivas = lancamentos.filter(
    (l) => lancamentoFaturaOsAtivo(l) && !lancamentoCreditoUtilizado(l)
  );

  const lancamentosAfetados = cobrancasAtivas.filter((l) =>
    trabalhoEstaFaturado(
      { id: trabalhoAtualizado.id, numeroOs: trabalhoAtualizado.numeroOs },
      [l]
    )
  );

  if (!lancamentosAfetados.length) return;

  const gruposProcessados = new Set<string>();

  for (const referencia of lancamentosAfetados) {
    const chave = chaveGrupoFatura(referencia);
    if (gruposProcessados.has(chave)) continue;
    gruposProcessados.add(chave);

    const parcelasGrupo = cobrancasAtivas.filter(
      (l) => chaveGrupoFatura(l) === chave
    );
    if (!parcelasGrupo.length) continue;

    const trabalhos = await carregarTrabalhosDaCobranca(
      empresaId,
      referencia,
      trabalhoAtualizado
    );
    if (!trabalhos.length) continue;

    const novoTotal = totalTrabalhos(trabalhos);
    await redistribuirValorParcelas(empresaId, parcelasGrupo, novoTotal);
  }

  invalidarCachePainelFinanceiro(empresaId);
}

/**
 * Atualiza valor das OS vinculadas quando uma fatura "Cobrança OS" é editada em Contas a Receber.
 */
export async function sincronizarTrabalhosAposAlteracaoLancamento(
  empresaId: string,
  lancamento: LancamentoCobranca
) {
  if (lancamento.tipo !== "receita") return;
  if (!lancamentoFaturaOsAtivo(lancamento) || lancamentoCreditoUtilizado(lancamento)) {
    return;
  }

  const lancamentos = await prisma.lancamento.findMany({
    where: { empresaId, tipo: "receita" },
    select: {
      id: true,
      tipo: true,
      descricao: true,
      valor: true,
      status: true,
      data: true,
      clienteId: true,
      trabalho: { select: { id: true, numeroOs: true } },
    },
  });

  const cobrancasAtivas = lancamentos.filter(
    (l) => lancamentoFaturaOsAtivo(l) && !lancamentoCreditoUtilizado(l)
  );

  const chave = chaveGrupoFatura(lancamento);
  const parcelasGrupo = cobrancasAtivas.filter((l) => chaveGrupoFatura(l) === chave);
  if (!parcelasGrupo.length) return;

  const referencia = parcelasGrupo.find((l) => l.id === lancamento.id) ?? parcelasGrupo[0];
  const trabalhos = await carregarTrabalhosDaCobranca(empresaId, referencia);
  if (!trabalhos.length) return;

  const novoTotalGrupo = Math.round(
    parcelasGrupo.reduce((sum, l) => sum + l.valor, 0) * 100
  ) / 100;
  const totalAtualTrabalhos = totalTrabalhos(trabalhos);
  if (Math.abs(novoTotalGrupo - totalAtualTrabalhos) <= 0.009) return;

  const distribuicao = distribuirValorEntreTrabalhos(trabalhos, novoTotalGrupo);
  await Promise.all(
    distribuicao.map(({ trabalho, valor }) => {
      const patch = aplicarValorAoTrabalho(trabalho, valor);
      return prisma.trabalho.update({
        where: { id: trabalho.id },
        data: patch,
      });
    })
  );

  invalidarCachePainelFinanceiro(empresaId);
}
