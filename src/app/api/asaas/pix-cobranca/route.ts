import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { invalidarCachePainelFinanceiro } from "@/lib/financeiro-painel-cache";
import {
  emitirPixCobrancaRecebimento,
  pixAsaasDisponivel,
  tentarEmitirPixParaLancamento,
} from "@/lib/asaas-pix-cobranca";
import { empacotarReceitaConta } from "@/lib/receita-conta-bancaria";
import { prisma } from "@/lib/db";

const schema = z.object({
  lancamentoIds: z.array(z.string()).optional(),
  lancamentoId: z.string().optional(),
  valor: z.number().positive(),
  clienteId: z.string().min(1),
  descricao: z.string().optional(),
  conta: z.string().optional(),
  dataRecebimento: z.string().optional(),
});

function parseDateOnly(value?: string) {
  if (!value) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const disponivel = await pixAsaasDisponivel(ctx.empresaId);
  return NextResponse.json({ disponivel });
}

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const data = schema.parse(body);

    const disponivel = await pixAsaasDisponivel(ctx.empresaId);
    if (!disponivel) {
      return NextResponse.json(
        {
          error:
            "Pix com QR Code exige integração Asaas ativa (subconta ou chave API em Configurações → Boletos). Use Pix Externo para lançamento manual.",
        },
        { status: 422 }
      );
    }

    const conta = data.conta?.trim() || "Conta Bancária";
    const vencimento = parseDateOnly(data.dataRecebimento);
    const ids = data.lancamentoIds?.length
      ? data.lancamentoIds
      : data.lancamentoId
        ? [data.lancamentoId]
        : [];

    if (ids.length === 1) {
      const lancamento = await prisma.lancamento.findFirst({
        where: { id: ids[0], empresaId: ctx.empresaId, tipo: "receita" },
      });
      if (!lancamento) {
        return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
      }

      await prisma.lancamento.update({
        where: { id: lancamento.id },
        data: {
          formaPagamento: "Pix",
          status: "pendente",
          descricao: empacotarReceitaConta(lancamento.descricao, conta),
        },
      });

      const pix = await tentarEmitirPixParaLancamento(lancamento.id, data.valor);
      if (!pix) {
        return NextResponse.json({ error: "Não foi possível emitir Pix." }, { status: 422 });
      }

      invalidarCachePainelFinanceiro(ctx.empresaId);
      return NextResponse.json({ ok: true, ...pix, lancamentoId: lancamento.id });
    }

    const descricao =
      data.descricao?.trim() ||
      (ids.length > 1
        ? `Recebimento Pix — ${ids.length} fatura(s)`
        : "Adiantamento / Crédito cliente");

    const pix = await emitirPixCobrancaRecebimento({
      empresaId: ctx.empresaId,
      clienteId: data.clienteId,
      valor: data.valor,
      descricao: empacotarReceitaConta(descricao, conta),
      vencimento,
    });

    if (ids.length > 0) {
      await prisma.lancamento.updateMany({
        where: { id: { in: ids }, empresaId: ctx.empresaId },
        data: { formaPagamento: "Pix", status: "pendente" },
      });
    }

    invalidarCachePainelFinanceiro(ctx.empresaId);
    return NextResponse.json({ ok: true, ...pix });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao gerar Pix." },
      { status: 422 }
    );
  }
}
