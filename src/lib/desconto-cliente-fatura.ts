import { parseCurrencyBr } from "@/lib/cliente-financeiro";
import {
  descontoGeralClienteObservacoes,
  descontoGeralTipoClienteObservacoes,
} from "@/lib/cliente-observacoes";
import { prisma } from "@/lib/db";
import {
  ehDescricaoReceitaOs,
  idsTrabalhosFaturadosNoLancamento,
  numerosOsDoLancamentoFatura,
  trabalhosRelacionadosLancamentoFatura,
} from "@/lib/os-faturamento";
import { valorLiquidoItemOs, classificarItemOs, type SegmentoFaturamento } from "@/lib/trabalho-os-segmento";

function arredondar2(n: number) {
  return Math.round(n * 100) / 100;
}

function descontoEstaZerado(texto: string) {
  const t = texto.trim();
  if (!t || t === "0" || t === "0,00" || t === "R$ 0,00" || t === "% 0.00" || t === "% 0,00") {
    return true;
  }
  const digitos = t.replace(/[^\d]/g, "");
  return !digitos || /^0+$/.test(digitos);
}

/** Compara se o desconto geral efetivo mudou (vazio e 0,00 são iguais). */
export function descontoGeralClienteMudou(
  observacoesAntes: string | null | undefined,
  observacoesDepois: string | null | undefined
) {
  const d1 = descontoGeralClienteObservacoes(observacoesAntes) || "0,00";
  const t1 = descontoGeralTipoClienteObservacoes(observacoesAntes);
  const d2 = descontoGeralClienteObservacoes(observacoesDepois) || "0,00";
  const t2 = descontoGeralTipoClienteObservacoes(observacoesDepois);
  const n1 = descontoEstaZerado(d1) ? `zero|${t1}` : `${d1}|${t1}`;
  const n2 = descontoEstaZerado(d2) ? `zero|${t2}` : `${d2}|${t2}`;
  return n1 !== n2;
}

function extrairValorBrutoLinhaItem(line: string): number | null {
  if (!/^Item adicionado:/i.test(line)) return null;
  const valorTexto = line.match(
    / - valor (.*?)(?: - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
  )?.[1];
  if (!valorTexto) return null;
  return parseCurrencyBr(valorTexto);
}

function removerDescDaLinhaItem(line: string) {
  return line
    .replace(
      / - desc .*?(?= - descTipo| - categoria| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i,
      ""
    )
    .replace(/ - descTipo (percentual|valor)(?= -|$)/i, "")
    .replace(/\s+$/g, "");
}

/**
 * Regrava `- desc` / `- descTipo` nas linhas de **serviço** da OS conforme o Desconto Geral.
 * Produto e transporte ficam sem desconto (valor bruto).
 * Tipo valor: rateia o R$ só entre as linhas de serviço.
 */
export function reescreverInstrucoesComDescontoCliente(
  instrucoes: string | null | undefined,
  descontoTexto: string,
  tipo: "percentual" | "valor"
): { instrucoes: string; valorLiquido: number; valorBruto: number } {
  const linhas = (instrucoes || "").split("\n");
  const metadados = linhas.map((line) => {
    if (!/^Item adicionado:/i.test(line)) {
      return { bruto: null as number | null, segmento: "servico" as SegmentoFaturamento };
    }
    const match = line.match(
      /^Item adicionado:\s*(.*?)\s*-\s*dentes\s*/i
    );
    const servico = match?.[1]?.trim() || "";
    const produtoId = line.match(/ - produtoId ([^\s-]+)/i)?.[1]?.trim();
    const bruto = extrairValorBrutoLinhaItem(line);
    return {
      bruto,
      segmento: classificarItemOs({ servico, produtoId }),
    };
  });

  const brutoServicos = metadados.reduce<number>(
    (s, m) => (m.segmento === "servico" && m.bruto != null ? s + m.bruto : s),
    0
  );
  const brutoTotal = metadados.reduce<number>((s, m) => s + (m.bruto ?? 0), 0);

  const descontoLimpo = descontoTexto.trim() || (tipo === "valor" ? "R$ 0,00" : "0,00");
  const descontoValorAbs =
    tipo === "valor"
      ? parseCurrencyBr(descontoLimpo)
      : brutoServicos *
        (Math.min(Math.max(Number(String(descontoLimpo).replace(",", ".") || 0), 0), 100) /
          100);

  let valorLiquido = 0;
  const novas = linhas.map((line, idx) => {
    const meta = metadados[idx];
    const bruto = meta.bruto;
    if (bruto == null) return line;

    // Produto / transporte: sem desconto geral
    if (meta.segmento !== "servico") {
      valorLiquido += bruto;
      return removerDescDaLinhaItem(line);
    }

    let descLinha = descontoLimpo;
    let tipoLinha: "percentual" | "valor" = tipo;

    if (tipo === "valor") {
      if (brutoServicos <= 0.009 || descontoEstaZerado(descontoLimpo)) {
        descLinha = "R$ 0,00";
      } else {
        const parte = arredondar2((bruto / brutoServicos) * descontoValorAbs);
        descLinha = `R$ ${parte.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      }
      tipoLinha = "valor";
    } else if (descontoEstaZerado(descontoLimpo)) {
      descLinha = "0,00";
    }

    const liquido = valorLiquidoItemOs({
      valor: bruto,
      desconto: descLinha,
      descontoTipo: tipoLinha,
    });
    valorLiquido += liquido;

    if (descontoEstaZerado(descLinha)) {
      return removerDescDaLinhaItem(line);
    }

    const base = removerDescDaLinhaItem(line);
    return `${base} - desc ${descLinha} - descTipo ${tipoLinha}`;
  });

  if (brutoTotal <= 0.009) {
    return {
      instrucoes: instrucoes || "",
      valorBruto: 0,
      valorLiquido: 0,
    };
  }

  return {
    instrucoes: novas.join("\n"),
    valorBruto: arredondar2(brutoTotal),
    valorLiquido: arredondar2(valorLiquido),
  };
}

function chaveGrupoCobranca(lancamento: {
  id: string;
  descricao: string;
  trabalhoId?: string | null;
}) {
  const ids = idsTrabalhosFaturadosNoLancamento({
    id: lancamento.id,
    status: "pendente",
    descricao: lancamento.descricao,
    trabalho: lancamento.trabalhoId ? { id: lancamento.trabalhoId } : null,
  })
    .slice()
    .sort();
  if (ids.length) return `trab:${ids.join(",")}`;

  const numeros = numerosOsDoLancamentoFatura({
    id: lancamento.id,
    status: "pendente",
    descricao: lancamento.descricao,
    trabalho: lancamento.trabalhoId ? { id: lancamento.trabalhoId } : null,
  })
    .slice()
    .sort((a, b) => a - b);
  if (numeros.length) return `os:${numeros.join(",")}`;

  return `desc:${lancamento.descricao
    .replace(/@@trab:[a-zA-Z0-9_,-]+@@/gi, "")
    .replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/g, "")
    .trim()
    .toLowerCase()}`;
}

export type SyncDescontoClienteResultado = {
  lancamentosAtualizados: number;
  trabalhosAtualizados: number;
};

/**
 * Ao alterar o Desconto Geral do cliente:
 * - atualiza valores/descontos de TODAS as OS do cliente
 * - recalcula faturas (Cobrança OS) já lançadas ainda pendentes
 */
export async function sincronizarFaturasPendentesDescontoCliente(params: {
  empresaId: string;
  clienteId: string;
  observacoes: string | null | undefined;
}): Promise<SyncDescontoClienteResultado> {
  const desconto = descontoGeralClienteObservacoes(params.observacoes) || "0,00";
  const tipo = descontoGeralTipoClienteObservacoes(params.observacoes) as
    | "percentual"
    | "valor";

  const trabalhos = await prisma.trabalho.findMany({
    where: { empresaId: params.empresaId, clienteId: params.clienteId },
    select: {
      id: true,
      numeroOs: true,
      grupoOsId: true,
      instrucoes: true,
      valor: true,
      clienteId: true,
    },
  });

  const valorPorTrabalho = new Map<string, number>();
  let trabalhosAtualizados = 0;

  for (const trabalho of trabalhos) {
    const atualizado = reescreverInstrucoesComDescontoCliente(
      trabalho.instrucoes,
      desconto,
      tipo
    );

    // Sem linhas "Item adicionado:", mantém o valor atual (pode já ser líquido).
    if (atualizado.valorBruto <= 0.009) {
      valorPorTrabalho.set(trabalho.id, Number(trabalho.valor) || 0);
      continue;
    }

    const valorFinal = atualizado.valorLiquido;
    valorPorTrabalho.set(trabalho.id, valorFinal);

    if (
      atualizado.instrucoes !== (trabalho.instrucoes || "") ||
      Math.abs((trabalho.valor || 0) - valorFinal) > 0.009
    ) {
      await prisma.trabalho.update({
        where: { id: trabalho.id },
        data: {
          instrucoes: atualizado.instrucoes,
          valor: valorFinal,
        },
      });
      trabalhosAtualizados += 1;
    }
  }

  const lancamentos = await prisma.lancamento.findMany({
    where: {
      empresaId: params.empresaId,
      clienteId: params.clienteId,
      tipo: "receita",
      status: { in: ["pendente", "pago"] },
    },
    select: {
      id: true,
      valor: true,
      status: true,
      descricao: true,
      trabalhoId: true,
    },
  });

  const cobrancas = lancamentos.filter((l) => ehDescricaoReceitaOs(l.descricao));
  const grupos = new Map<string, typeof cobrancas>();
  for (const l of cobrancas) {
    const chave = chaveGrupoCobranca(l);
    const lista = grupos.get(chave) ?? [];
    lista.push(l);
    grupos.set(chave, lista);
  }

  let lancamentosAtualizados = 0;
  const trabalhosParaLookup = trabalhos.map((t) => ({
    id: t.id,
    numeroOs: t.numeroOs,
    clienteId: t.clienteId,
    grupoOsId: t.grupoOsId,
  }));

  for (const [, grupo] of grupos) {
    const idsTrabalho = new Set<string>();

    for (const l of grupo) {
      const relacionados = trabalhosRelacionadosLancamentoFatura(
        {
          id: l.id,
          status: l.status,
          descricao: l.descricao,
          trabalho: l.trabalhoId ? { id: l.trabalhoId } : null,
          cliente: { id: params.clienteId },
        },
        trabalhosParaLookup,
        params.clienteId
      );
      for (const t of relacionados) idsTrabalho.add(t.id);

      for (const id of idsTrabalhosFaturadosNoLancamento({
        id: l.id,
        status: l.status,
        descricao: l.descricao,
        trabalho: l.trabalhoId ? { id: l.trabalhoId } : null,
      })) {
        idsTrabalho.add(id);
      }
    }

    if (!idsTrabalho.size) continue;

    let novoTotal = 0;
    for (const id of idsTrabalho) {
      novoTotal += valorPorTrabalho.get(id) ?? 0;
    }
    novoTotal = arredondar2(novoTotal);
    if (novoTotal < 0) novoTotal = 0;

    const pagos = grupo.filter((l) => l.status === "pago");
    const pendentes = grupo.filter((l) => l.status === "pendente");
    if (!pendentes.length) continue;

    const totalPago = arredondar2(pagos.reduce((s, l) => s + l.valor, 0));
    const restante = arredondar2(Math.max(0, novoTotal - totalPago));
    const baseAntiga = pendentes.reduce((s, l) => s + l.valor, 0);

    let acumulado = 0;
    for (let i = 0; i < pendentes.length; i++) {
      const l = pendentes[i];
      const ultimo = i === pendentes.length - 1;
      const novoValor = ultimo
        ? arredondar2(restante - acumulado)
        : baseAntiga > 0.009
          ? arredondar2((l.valor / baseAntiga) * restante)
          : arredondar2(restante / pendentes.length);

      acumulado = arredondar2(acumulado + novoValor);

      if (Math.abs(l.valor - novoValor) > 0.009) {
        await prisma.lancamento.update({
          where: { id: l.id },
          data: { valor: Math.max(0, novoValor) },
        });
        lancamentosAtualizados += 1;
      }
    }
  }

  return { lancamentosAtualizados, trabalhosAtualizados };
}
