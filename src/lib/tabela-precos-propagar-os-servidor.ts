import { prisma } from "@/lib/db";
import { sincronizarContasReceberAposAlteracaoTrabalho } from "@/lib/os-faturamento-sync-servidor";
import {
  nomeExibicaoItemOs,
  valorLiquidoDeLinhaItemAdicionado,
} from "@/lib/trabalho-os-segmento";

export type MudancaItemTabelaPrecos = {
  tipo: "servico" | "produto" | "transporte";
  /** Nome como estava nas OS (antes da edição). */
  nomeAnterior: string;
  /** Nome novo na tabela de preços. */
  nomeNovo: string;
  /** Valor unitário novo na tabela. */
  valorNovo: number;
  /** Só para produto — bate pelo id gravado na linha. */
  produtoId?: string | null;
};

export type ResultadoPropagacaoTabelaPrecos = {
  trabalhosAtualizados: number;
  linhasAtualizadas: number;
};

function normalizarNome(valor: string) {
  return nomeExibicaoItemOs({ servico: valor }).trim().toLowerCase();
}

function nomesIguais(a: string, b: string) {
  return normalizarNome(a) === normalizarNome(b);
}

function formatarValorLinha(valor: number) {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function variantesTipoProtese(nome: string, tipo: MudancaItemTabelaPrecos["tipo"]) {
  const base = nome.trim();
  const variantes = new Set<string>([base]);
  if (tipo === "produto") {
    variantes.add(`Produto: ${base}`);
  }
  if (tipo === "transporte") {
    variantes.add(`Transporte: ${base}`);
    variantes.add(`Frete: ${base}`);
  }
  return [...variantes];
}

function extrairServicoLinha(line: string): string | null {
  const match = line.match(/^Item adicionado:\s*(.*?)\s*-\s*dentes/i);
  return match?.[1]?.trim() ?? null;
}

function extrairQtdLinha(line: string): number {
  const match = line.match(/\s-\s*qtd\s+(.*?)\s+-\s*valor\s+/i);
  const qtd = Number(String(match?.[1] || "1").replace(",", "."));
  return Number.isFinite(qtd) && qtd > 0 ? qtd : 1;
}

function extrairProdutoIdLinha(line: string): string | null {
  return (
    line
      .match(
        / - produtoId (.*?)(?: - urgente| - repetição| - repeticao| - obs|$)/i
      )?.[1]
      ?.trim() || null
  );
}

function linhaCorrespondeMudanca(
  line: string,
  mudanca: MudancaItemTabelaPrecos
): boolean {
  if (!line.trim().startsWith("Item adicionado:")) return false;

  if (mudanca.produtoId) {
    const produtoId = extrairProdutoIdLinha(line);
    if (produtoId && produtoId === mudanca.produtoId) return true;
  }

  const servico = extrairServicoLinha(line);
  if (!servico) return false;
  return nomesIguais(servico, mudanca.nomeAnterior);
}

function reescreverNomeLinha(line: string, nomeNovo: string): string {
  const servicoAtual = extrairServicoLinha(line);
  if (!servicoAtual) return line;

  let nomeComPrefixo = nomeNovo.trim();
  if (/^produto:/i.test(servicoAtual)) {
    nomeComPrefixo = `Produto: ${nomeNovo.trim()}`;
  } else if (/^transporte:/i.test(servicoAtual)) {
    nomeComPrefixo = `Transporte: ${nomeNovo.trim()}`;
  } else if (/^frete:/i.test(servicoAtual)) {
    nomeComPrefixo = `Frete: ${nomeNovo.trim()}`;
  }

  return line.replace(
    /^Item adicionado:\s*(.*?)\s*-\s*dentes/i,
    `Item adicionado: ${nomeComPrefixo} - dentes`
  );
}

function reescreverValorLinha(line: string, valorUnitario: number): string {
  const qtd = extrairQtdLinha(line);
  const bruto = Math.round(valorUnitario * qtd * 100) / 100;
  const valorMatch = line.match(
    /( - valor )(.*?)(?= - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
  );
  if (!valorMatch) return line;
  return line.replace(valorMatch[0], ` - valor ${formatarValorLinha(bruto)}`);
}

function novoTipoProtese(
  atual: string,
  mudanca: MudancaItemTabelaPrecos
): string | null {
  if (!nomesIguais(atual, mudanca.nomeAnterior)) return null;

  if (/^produto:/i.test(atual)) return `Produto: ${mudanca.nomeNovo.trim()}`;
  if (/^transporte:/i.test(atual)) return `Transporte: ${mudanca.nomeNovo.trim()}`;
  if (/^frete:/i.test(atual)) return `Frete: ${mudanca.nomeNovo.trim()}`;
  return mudanca.nomeNovo.trim();
}

function totalLiquidoInstrucoes(instrucoes: string): number {
  const linhas = instrucoes.split("\n");
  let total = 0;
  let temItem = false;
  for (const line of linhas) {
    if (!line.trim().startsWith("Item adicionado:")) continue;
    temItem = true;
    total += valorLiquidoDeLinhaItemAdicionado(line) ?? 0;
  }
  return temItem ? Math.round(total * 100) / 100 : NaN;
}

function montarFiltroBusca(empresaId: string, mudanca: MudancaItemTabelaPrecos) {
  const variantes = variantesTipoProtese(mudanca.nomeAnterior, mudanca.tipo);
  const or: Array<Record<string, unknown>> = [];

  for (const variante of variantes) {
    or.push({ tipoProtese: { equals: variante, mode: "insensitive" } });
    or.push({
      instrucoes: {
        contains: `Item adicionado: ${variante}`,
        mode: "insensitive",
      },
    });
  }

  if (mudanca.produtoId) {
    or.push({
      instrucoes: {
        contains: `produtoId ${mudanca.produtoId}`,
        mode: "insensitive",
      },
    });
  }

  return { empresaId, OR: or };
}

async function aplicarMudancaEmTrabalho(
  empresaId: string,
  trabalho: {
    id: string;
    numeroOs: number;
    clienteId: string;
    tipoProtese: string;
    valor: number;
    instrucoes: string | null;
  },
  mudanca: MudancaItemTabelaPrecos
): Promise<boolean> {
  const linhas = (trabalho.instrucoes || "").split("\n");
  let linhasAlteradas = 0;
  const novasLinhas = linhas.map((line) => {
    if (!linhaCorrespondeMudanca(line, mudanca)) return line;
    linhasAlteradas += 1;
    let atualizada = reescreverNomeLinha(line, mudanca.nomeNovo);
    atualizada = reescreverValorLinha(atualizada, mudanca.valorNovo);
    return atualizada;
  });

  const tipoProteseNovo = novoTipoProtese(trabalho.tipoProtese, mudanca);
  const instrucoesNovas = novasLinhas.join("\n");
  const instrucoesMudou =
    linhasAlteradas > 0 && instrucoesNovas !== (trabalho.instrucoes || "");
  const tipoMudou =
    tipoProteseNovo != null && tipoProteseNovo !== trabalho.tipoProtese;
  const tituloBate = nomesIguais(trabalho.tipoProtese, mudanca.nomeAnterior);

  // OS sem linhas "Item adicionado": atualiza título/valor direto.
  if (linhasAlteradas === 0) {
    if (!tituloBate) return false;

    const valorNovo = Math.round(mudanca.valorNovo * 100) / 100;
    if (
      !tipoMudou &&
      Math.abs(valorNovo - Number(trabalho.valor || 0)) <= 0.009
    ) {
      return false;
    }

    try {
      const atualizado = await prisma.trabalho.update({
        where: { id: trabalho.id },
        data: {
          ...(tipoProteseNovo ? { tipoProtese: tipoProteseNovo } : {}),
          valor: valorNovo,
        },
      });
      try {
        await sincronizarContasReceberAposAlteracaoTrabalho(empresaId, {
          id: atualizado.id,
          numeroOs: atualizado.numeroOs,
          clienteId: atualizado.clienteId,
          instrucoes: atualizado.instrucoes,
          valor: atualizado.valor,
          tipoProtese: atualizado.tipoProtese,
        });
      } catch (err) {
        console.warn("[tabela-precos-propagar-os] sync faturamento", err);
      }
      return true;
    } catch (err) {
      console.warn(
        "[tabela-precos-propagar-os] falha ao atualizar trabalho",
        trabalho.id,
        err
      );
      return false;
    }
  }

  if (!instrucoesMudou && !tipoMudou) {
    // Valor unitário igual ao já gravado (após × qtd / desconto) — nada a fazer.
    const totalLinhas = totalLiquidoInstrucoes(instrucoesNovas);
    if (
      Number.isFinite(totalLinhas) &&
      Math.abs(totalLinhas - Number(trabalho.valor || 0)) <= 0.009
    ) {
      return false;
    }
  }

  const totalLinhas = totalLiquidoInstrucoes(instrucoesNovas);
  const valorNovo = Number.isFinite(totalLinhas)
    ? totalLinhas
    : Math.round(mudanca.valorNovo * 100) / 100;

  try {
    const atualizado = await prisma.trabalho.update({
      where: { id: trabalho.id },
      data: {
        ...(tipoProteseNovo ? { tipoProtese: tipoProteseNovo } : {}),
        ...(instrucoesMudou ? { instrucoes: instrucoesNovas } : {}),
        valor: valorNovo,
      },
    });

    try {
      await sincronizarContasReceberAposAlteracaoTrabalho(empresaId, {
        id: atualizado.id,
        numeroOs: atualizado.numeroOs,
        clienteId: atualizado.clienteId,
        instrucoes: atualizado.instrucoes,
        valor: atualizado.valor,
        tipoProtese: atualizado.tipoProtese,
      });
    } catch (err) {
      console.warn("[tabela-precos-propagar-os] sync faturamento", err);
    }
    return true;
  } catch (err) {
    // Unique [empresaId, numeroOs, segmento, tipoProtese] pode colidir em rename raro.
    console.warn(
      "[tabela-precos-propagar-os] falha ao atualizar trabalho",
      trabalho.id,
      err
    );
    return false;
  }
}

/**
 * Propaga rename/reajuste da tabela de preços para OS já cadastradas
 * (nome em tipoProtese / Item adicionado + valor unitário × qtd).
 */
export async function propagarMudancasTabelaPrecosParaOs(
  empresaId: string,
  mudancas: MudancaItemTabelaPrecos[]
): Promise<ResultadoPropagacaoTabelaPrecos> {
  const validas = mudancas.filter(
    (m) => m.nomeAnterior.trim() && m.nomeNovo.trim() && Number.isFinite(m.valorNovo)
  );

  let trabalhosAtualizados = 0;
  let linhasAtualizadas = 0;

  for (const mudanca of validas) {
    const trabalhos = await prisma.trabalho.findMany({
      where: montarFiltroBusca(empresaId, mudanca),
      select: {
        id: true,
        numeroOs: true,
        clienteId: true,
        tipoProtese: true,
        valor: true,
        instrucoes: true,
      },
    });

    for (const trabalho of trabalhos) {
      const linhasAntes = (trabalho.instrucoes || "")
        .split("\n")
        .filter((line) => linhaCorrespondeMudanca(line, mudanca)).length;

      const ok = await aplicarMudancaEmTrabalho(empresaId, trabalho, mudanca);
      if (ok) {
        trabalhosAtualizados += 1;
        linhasAtualizadas += Math.max(linhasAntes, 1);
      }
    }
  }

  return { trabalhosAtualizados, linhasAtualizadas };
}
