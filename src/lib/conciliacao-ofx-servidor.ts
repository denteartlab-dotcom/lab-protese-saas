import { prisma } from "@/lib/db";
import type { ContaBancaria } from "@/lib/conta-bancaria";
import type { LancamentoConciliacao } from "@/lib/conciliacao-ofx-procedimento";
import type { ExtratoMovimentacao } from "@/lib/extrato-bancario";
import {
  listarExtratoBancarioServidor,
  salvarExtratoBancarioServidor,
} from "@/lib/conta-bancaria-servidor";
import { invalidarCachePainelFinanceiro } from "@/lib/financeiro-painel-cache";
import { desempacotarDespesa, empacotarDespesa } from "@/lib/lancamento-despesa";
import {
  removerMovimentacoesRecebimentoServidor,
  sincronizarMovimentacaoRecebimentoServidor,
} from "@/lib/recebimento-conta-bancaria-servidor";
import { empacotarReceitaConta } from "@/lib/receita-conta-bancaria";
import { resumirDescricaoOfx } from "@/lib/extrato-ofx";
import { z } from "zod";

const movimentacaoOfxSchema = z.object({
  id: z.string(),
  data: z.string(),
  descricao: z.string(),
  forma: z.string(),
  valor: z.number(),
  tipo: z.enum(["credito", "debito"]),
  fitid: z.string().optional(),
});

const lancamentoConciliacaoSchema = z.object({
  id: z.string(),
  tipo: z.string(),
  descricao: z.string(),
  valor: z.number(),
  data: z.string(),
  status: z.string(),
});

export const schemaPayloadConciliacaoConta = z.object({
  contaId: z.string().min(1),
  linhas: z.array(movimentacaoOfxSchema).min(1),
  procedimentos: z.record(z.string(), z.string()),
  lancamentos: z.array(lancamentoConciliacaoSchema),
  resumirDescricao: z.boolean().optional(),
});

export type ErroConciliacaoLinha = {
  linhaId: string;
  mensagem: string;
};

export type LinhaConciliacaoOfx = z.infer<typeof movimentacaoOfxSchema>;

export type ResultadoConciliacaoContaJob = {
  processados: number;
  total: number;
  vinculados: number;
  extratoInseridos: number;
  erros: ErroConciliacaoLinha[];
  movimentacoesExtrato: ExtratoMovimentacao[];
};

function isoParaDataApi(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateOnly(value?: string) {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formaPagamentoDaLinha(forma: string) {
  if (forma === "PIX") return "PIX";
  if (forma === "TED") return "TED";
  if (forma === "DOC") return "DOC";
  if (forma === "Boleto") return "Boleto";
  return forma && forma !== "Crédito" && forma !== "Débito" ? forma : "Transferência";
}

function mesclarExtratoServidor(
  atuais: ExtratoMovimentacao[],
  novos: ExtratoMovimentacao[]
) {
  const map = new Map<string, ExtratoMovimentacao>();
  for (const item of atuais) {
    map.set(item.idExterno ?? item.id, item);
  }
  for (const item of novos) {
    map.set(item.idExterno ?? item.id, item);
  }
  return Array.from(map.values());
}

async function vincularLancamentoConciliacaoServidor(
  empresaId: string,
  procId: string,
  conta: ContaBancaria,
  linha: LinhaConciliacaoOfx,
  lanc: LancamentoConciliacao | undefined
) {
  const existente = await prisma.lancamento.findFirst({
    where: { id: procId, empresaId },
    include: {
      cliente: true,
      trabalho: { select: { numeroOs: true } },
    },
  });
  if (!existente) {
    throw new Error("Lançamento não encontrado.");
  }

  const tipoLanc = lanc?.tipo ?? (linha.tipo === "credito" ? "receita" : "despesa");
  const dataIso = isoParaDataApi(linha.data);
  const updateData: {
    status: string;
    data?: Date;
    formaPagamento: string;
    descricao?: string;
  } = {
    status: "pago",
    formaPagamento: formaPagamentoDaLinha(linha.forma),
  };

  if (dataIso) updateData.data = parseDateOnly(dataIso);

  if (tipoLanc === "despesa" && lanc) {
    const pack = desempacotarDespesa(lanc.descricao);
    updateData.descricao = empacotarDespesa(pack.texto, {
      ...pack.meta,
      conta: conta.nome,
    });
  } else if (tipoLanc === "receita" && lanc) {
    updateData.descricao = empacotarReceitaConta(lanc.descricao, conta.nome);
  }

  const lancamento = await prisma.lancamento.update({
    where: { id: procId },
    data: updateData,
    include: {
      cliente: true,
      trabalho: { select: { numeroOs: true } },
    },
  });

  if (lancamento.tipo === "receita") {
    if (lancamento.status === "pago") {
      await sincronizarMovimentacaoRecebimentoServidor(empresaId, lancamento);
    } else if (existente.status === "pago") {
      await removerMovimentacoesRecebimentoServidor(empresaId, [procId]);
    }
  }
}

export async function executarConciliacaoContaServidor(
  empresaId: string,
  input: z.infer<typeof schemaPayloadConciliacaoConta>,
  opcoes?: { onProgresso?: (progresso: number) => void | Promise<void> }
): Promise<ResultadoConciliacaoContaJob> {
  const contaRow = await prisma.contaBancaria.findFirst({
    where: { id: input.contaId, empresaId },
  });
  if (!contaRow) {
    throw new Error("Conta bancária não encontrada.");
  }

  const conta: ContaBancaria = {
    id: contaRow.id,
    nome: contaRow.nome,
    saldoInicial: contaRow.saldoInicial,
    excluida: contaRow.excluida,
    acaoPrincipal: contaRow.acaoPrincipal as ContaBancaria["acaoPrincipal"],
    codBanco: contaRow.codBanco || undefined,
    agencia: contaRow.agencia || undefined,
    numeroConta: contaRow.numeroConta || undefined,
    tipoChavePix: (contaRow.tipoChavePix || "") as ContaBancaria["tipoChavePix"],
    chavePix: contaRow.chavePix || undefined,
    modoVinculo: (contaRow.modoVinculo || "manual") as ContaBancaria["modoVinculo"],
  };

  const { linhas, procedimentos, lancamentos, resumirDescricao = true } = input;
  const mapaLanc = new Map(lancamentos.map((l) => [l.id, l]));
  const movimentacoesNovas: ExtratoMovimentacao[] = [];
  const erros: ErroConciliacaoLinha[] = [];
  let vinculados = 0;
  const total = linhas.length;

  for (let i = 0; i < linhas.length; i += 1) {
    const linha = linhas[i];
    const procId = procedimentos[linha.id]?.trim();
    const descricaoLinha = resumirDescricao
      ? resumirDescricaoOfx(linha.descricao)
      : linha.descricao;

    try {
      if (procId) {
        await vincularLancamentoConciliacaoServidor(
          empresaId,
          procId,
          conta,
          linha,
          mapaLanc.get(procId)
        );
        vinculados += 1;
      } else {
        movimentacoesNovas.push({
          id: `conc-${linha.id}-${Date.now()}-${i}`,
          contaId: conta.id,
          tipo: linha.tipo === "credito" ? "entrada" : "saida",
          valor: linha.valor,
          descricao: descricaoLinha,
          data: linha.data,
          origem: "arquivo",
          idExterno: linha.fitid || linha.id,
        });
      }
    } catch (err) {
      erros.push({
        linhaId: linha.id,
        mensagem: err instanceof Error ? err.message : "Falha ao processar linha.",
      });
    }

    if (opcoes?.onProgresso && total > 0) {
      await opcoes.onProgresso(Math.min(99, Math.round(((i + 1) / total) * 100)));
    }
  }

  if (movimentacoesNovas.length > 0) {
    const extratoAtual = await listarExtratoBancarioServidor(empresaId);
    const extratoMesclado = mesclarExtratoServidor(extratoAtual, movimentacoesNovas);
    await salvarExtratoBancarioServidor(empresaId, extratoMesclado);
  }

  invalidarCachePainelFinanceiro(empresaId);

  return {
    processados: total - erros.length,
    total,
    vinculados,
    extratoInseridos: movimentacoesNovas.length,
    erros,
    movimentacoesExtrato: movimentacoesNovas,
  };
}
