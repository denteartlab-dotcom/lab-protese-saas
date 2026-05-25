import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { tentarEmitirBoletoParaLancamento } from "@/lib/asaas-boleto";
import {
  findLancamentoFinanceiroPorId,
  findLancamentosFinanceiro,
} from "@/lib/lancamentos-cobranca";
import { z } from "zod";

const schema = z.object({
  tipo: z.enum(["receita", "despesa"]),
  descricao: z.string().min(1),
  valor: z.number().nonnegative(),
  data: z.string().optional(),
  status: z.enum(["pendente", "pago", "cancelado"]).optional(),
  formaPagamento: z.string().optional(),
  clienteId: z.string().optional(),
  trabalhoId: z.string().optional(),
  emitirBoleto: z.boolean().optional(),
});

function parseDateOnly(value?: string) {
  if (!value) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }
  return new Date(value);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo");
  const status = searchParams.get("status");
  const mes = searchParams.get("mes");

  let dateFilter = {};
  if (mes) {
    const [year, month] = mes.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    dateFilter = { data: { gte: start, lte: end } };
  }

  try {
    const lancamentos = await findLancamentosFinanceiro({
      where: {
        ...(tipo ? { tipo } : {}),
        ...(status ? { status } : {}),
        ...dateFilter,
      },
      orderBy: { data: "desc" },
    });

    return NextResponse.json(montarRespostaFinanceiro(lancamentos));
  } catch (err) {
    console.error("[financeiro GET]", err);
    return NextResponse.json(
      { error: "Erro ao carregar financeiro." },
      { status: 500 }
    );
  }
}

function montarRespostaFinanceiro(
  lancamentos: {
    tipo: string;
    valor: number;
    status: string;
  }[]
) {
  const receitas = lancamentos.filter((l) => l.tipo === "receita");
  const despesas = lancamentos.filter((l) => l.tipo === "despesa");
  const totalReceitas = receitas.reduce((s, l) => s + l.valor, 0);
  const totalDespesas = despesas.reduce((s, l) => s + l.valor, 0);
  const receitasPendentes = receitas
    .filter((l) => l.status === "pendente")
    .reduce((s, l) => s + l.valor, 0);

  return {
    lancamentos,
    resumo: {
      totalReceitas,
      totalDespesas,
      saldo: totalReceitas - totalDespesas,
      receitasPendentes,
    },
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const data = schema.parse(body);
    const { emitirBoleto, ...camposLancamento } = data;
    const lancamento = await prisma.lancamento.create({
      data: {
        ...camposLancamento,
        data: parseDateOnly(data.data),
        status: data.status ?? "pendente",
      },
      include: {
        cliente: true,
        trabalho: true,
      },
    });

    const deveEmitirBoleto =
      emitirBoleto !== false &&
      (data.formaPagamento || "").toLowerCase().includes("boleto");

    if (deveEmitirBoleto) {
      try {
        const cobranca = await tentarEmitirBoletoParaLancamento(lancamento.id);
        const atualizado = await findLancamentoFinanceiroPorId(lancamento.id);
        return NextResponse.json(
          { ...atualizado, boletoEmitido: Boolean(cobranca) },
          { status: 201 }
        );
      } catch (err) {
        await prisma.lancamento.delete({ where: { id: lancamento.id } });
        const msg =
          err instanceof Error ? err.message : "Falha ao emitir boleto no Asaas.";
        return NextResponse.json({ error: msg }, { status: 422 });
      }
    }

    return NextResponse.json(lancamento, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
}
