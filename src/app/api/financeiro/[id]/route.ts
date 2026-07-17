import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { acaoHttpParaPermissao, negarSeSemPermissao } from "@/lib/require-permissao";
import {
  auditarAlteracaoLancamento,
  auditarExclusaoLancamento,
} from "@/lib/log-auditoria-financeiro";
import {
  removerMovimentacoesRecebimentoServidor,
  sincronizarMovimentacaoRecebimentoServidor,
} from "@/lib/recebimento-conta-bancaria-servidor";
import { invalidarCachePainelFinanceiro } from "@/lib/financeiro-painel-cache";
import { lancamentoFaturaOsAtivo } from "@/lib/os-faturamento";
import { sincronizarTrabalhosAposAlteracaoLancamento } from "@/lib/os-faturamento-sync-servidor";
import { restaurarFaturaAposExclusaoPagamento } from "@/lib/recebimento-estorno-servidor";
import { excluirFaturaCobrancaOsServidor } from "@/lib/fatura-exclusao-servidor";
import { ehFaturaCobrancaOsParaExclusao } from "@/lib/contas-receber-financeiro";
import { z } from "zod";

const schema = z.object({
  descricao: z.string().optional(),
  valor: z.number().optional(),
  data: z.string().optional(),
  status: z.enum(["pendente", "pago", "cancelado"]).optional(),
  formaPagamento: z.string().optional().nullable(),
  /** Só true ao editar valor da fatura manualmente — nunca em recebimentos/estornos. */
  alterarValorOs: z.boolean().optional(),
});

function parseDateOnly(value?: string) {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }
  return new Date(value);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const data = schema.parse(body);
    const { alterarValorOs, ...camposAtualizacao } = data;
    const existente = await prisma.lancamento.findFirst({
      where: { id, empresaId: ctx.empresaId },
      include: {
        cliente: true,
        trabalho: { select: { id: true, numeroOs: true } },
      },
    });
    if (!existente) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
    const modulo =
      existente.tipo === "despesa" ? "financeiro-tipo-despesa" : "financeiro-tipo-receita";
    const negado = await negarSeSemPermissao(ctx, modulo, acaoHttpParaPermissao("PUT"));
    if (negado) return negado;
    const lancamento = await prisma.lancamento.update({
      where: { id },
      data: {
        ...camposAtualizacao,
        data: parseDateOnly(data.data),
      },
      include: {
        cliente: true,
        trabalho: { select: { id: true, numeroOs: true } },
      },
    });
    try {
      await auditarAlteracaoLancamento(ctx.user, existente, lancamento);
    } catch (auditErr) {
      console.error("[financeiro PUT] auditoria", auditErr);
    }
    if (lancamento.tipo === "receita") {
      try {
        if (lancamento.status === "pago") {
          await sincronizarMovimentacaoRecebimentoServidor(ctx.empresaId, lancamento);
        } else if (existente.status === "pago") {
          await removerMovimentacoesRecebimentoServidor(ctx.empresaId, [id]);
        }
      } catch (syncErr) {
        console.error("[financeiro PUT] sync conta bancária", syncErr);
      }
      if (
        data.alterarValorOs === true &&
        data.valor !== undefined &&
        Math.abs(data.valor - existente.valor) > 0.009 &&
        lancamentoFaturaOsAtivo(lancamento)
      ) {
        try {
          await sincronizarTrabalhosAposAlteracaoLancamento(ctx.empresaId, {
            id: lancamento.id,
            tipo: lancamento.tipo,
            descricao: lancamento.descricao,
            valor: lancamento.valor,
            status: lancamento.status,
            data: lancamento.data,
            clienteId: lancamento.clienteId,
            trabalho: lancamento.trabalho,
          });
        } catch (syncErr) {
          console.warn("[financeiro PUT] sync valor OS", syncErr);
        }
      }
    }
    invalidarCachePainelFinanceiro(ctx.empresaId);
    return NextResponse.json(lancamento);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const existente = await prisma.lancamento.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: {
      cliente: true,
      trabalho: { select: { id: true, numeroOs: true } },
    },
  });
  if (!existente) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  const modulo =
    existente.tipo === "despesa" ? "financeiro-tipo-despesa" : "financeiro-tipo-receita";
  const negado = await negarSeSemPermissao(ctx, modulo, acaoHttpParaPermissao("DELETE"));
  if (negado) return negado;

  const ehFaturaCobrancaOs = ehFaturaCobrancaOsParaExclusao({
    tipo: existente.tipo,
    descricao: existente.descricao,
  });

  if (ehFaturaCobrancaOs) {
    try {
      await excluirFaturaCobrancaOsServidor(ctx.empresaId, {
        id: existente.id,
        tipo: existente.tipo,
        descricao: existente.descricao,
        valor: existente.valor,
        status: existente.status,
        clienteId: existente.clienteId,
        trabalho: existente.trabalho,
      });
    } catch (err) {
      console.error("[financeiro DELETE] exclusão fatura", err);
      return NextResponse.json({ error: "Erro ao excluir fatura" }, { status: 500 });
    }
  } else {
    await prisma.lancamento.delete({ where: { id } });
    try {
      await restaurarFaturaAposExclusaoPagamento(ctx.empresaId, {
        id: existente.id,
        tipo: existente.tipo,
        descricao: existente.descricao,
        valor: existente.valor,
        status: existente.status,
        clienteId: existente.clienteId,
      });
    } catch (syncErr) {
      console.error("[financeiro DELETE] restaurar fatura", syncErr);
    }
    try {
      await removerMovimentacoesRecebimentoServidor(ctx.empresaId, [id]);
    } catch (syncErr) {
      console.error("[financeiro DELETE] sync conta bancária", syncErr);
    }
  }

  try {
    await auditarExclusaoLancamento(ctx.user, existente);
  } catch (auditErr) {
    console.error("[financeiro DELETE] auditoria", auditErr);
  }
  invalidarCachePainelFinanceiro(ctx.empresaId);
  return NextResponse.json({ ok: true });
}
