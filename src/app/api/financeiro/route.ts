import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { tentarEmitirBoletoParaLancamento } from "@/lib/asaas-boleto";
import { parseParcelaNaDescricao } from "@/lib/fatura-financeiro";
import { descricaoDespesaComParcela } from "@/lib/lancamento-despesa";
import {
  auditarCriacaoDespesasParceladas,
  auditarCriacaoLancamento,
  auditarCriacaoReceitasParceladas,
} from "@/lib/log-auditoria-financeiro";
import {
  findLancamentoFinanceiroPorId,
  findLancamentosFinanceiro,
} from "@/lib/lancamentos-cobranca";
import { sincronizarMovimentacaoRecebimentoServidor } from "@/lib/recebimento-conta-bancaria-servidor";
import { z } from "zod";

const parcelaItemSchema = z.object({
  valor: z.number().nonnegative(),
  data: z.string().optional(),
  status: z.enum(["pendente", "pago", "cancelado"]).optional(),
  formaPagamento: z.string().optional(),
});

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
  parcelaNumero: z.number().int().positive().optional(),
  parcelaTotal: z.number().int().positive().optional(),
  numeroFatura: z.number().int().positive().optional(),
  parcelas: z.array(parcelaItemSchema).min(1).optional(),
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

function dadosCreateLancamento(
  empresaId: string,
  data: z.infer<typeof schema>,
  descricao: string
) {
  return {
    empresaId,
    tipo: data.tipo,
    descricao,
    valor: data.valor,
    data: parseDateOnly(data.data),
    status: data.status ?? "pendente",
    formaPagamento: data.formaPagamento ?? null,
    clienteId: data.clienteId ?? null,
    trabalhoId: data.trabalhoId ?? null,
  };
}

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

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
        empresaId: ctx.empresaId,
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
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const data = schema.parse(body);
    const { emitirBoleto, parcelas: parcelasBody } = data;
    const session = ctx.user;

    if (
      data.tipo === "despesa" &&
      parcelasBody &&
      parcelasBody.length > 1
    ) {
      const baseDescricao = data.descricao.trim();
      const criados = await prisma.$transaction(async (tx) => {
        const lista = [];
        for (let i = 0; i < parcelasBody.length; i++) {
          const p = parcelasBody[i];
          const n = i + 1;
          const total = parcelasBody.length;
          const lancamento = await tx.lancamento.create({
            data: {
              empresaId: ctx.empresaId,
              tipo: "despesa",
              descricao: descricaoDespesaComParcela(
                baseDescricao,
                `${n}/${total}`
              ),
              valor: p.valor,
              data: parseDateOnly(p.data ?? data.data),
              status: p.status ?? data.status ?? "pendente",
              formaPagamento: p.formaPagamento ?? data.formaPagamento ?? null,
              clienteId: data.clienteId ?? null,
              trabalhoId: data.trabalhoId ?? null,
            },
            include: { cliente: true, trabalho: true },
          });
          lista.push(lancamento);
        }
        return lista;
      });
      await auditarCriacaoDespesasParceladas(session, criados);
      return NextResponse.json({ lancamentos: criados }, { status: 201 });
    }

    async function sincronizarReceitasPagas(
      lista: Array<{
        id: string;
        tipo: string;
        descricao: string;
        valor: number;
        status: string;
        data: Date;
      }>
    ) {
      for (const item of lista) {
        if (item.tipo !== "receita" || item.status !== "pago") continue;
        try {
          await sincronizarMovimentacaoRecebimentoServidor(ctx.empresaId, item);
        } catch (syncErr) {
          console.error("[financeiro POST] sync conta bancária", syncErr);
        }
      }
    }

    if (
      data.tipo === "receita" &&
      parcelasBody &&
      parcelasBody.length > 1
    ) {
      const baseDescricao = data.descricao.trim();
      const criados = [];
      for (let i = 0; i < parcelasBody.length; i++) {
        const p = parcelasBody[i];
        const n = i + 1;
        const total = parcelasBody.length;
        const lancamento = await prisma.lancamento.create({
          data: {
            empresaId: ctx.empresaId,
            tipo: "receita",
            descricao: `${baseDescricao} (${n}/${total})`,
            valor: p.valor,
            data: parseDateOnly(p.data ?? data.data),
            status: p.status ?? data.status ?? "pendente",
            formaPagamento: p.formaPagamento ?? data.formaPagamento ?? null,
            clienteId: data.clienteId ?? null,
            trabalhoId: data.trabalhoId ?? null,
          },
          include: { cliente: true, trabalho: true },
        });
        criados.push(lancamento);
      }
      const numeroFatura = await auditarCriacaoReceitasParceladas(session, criados);
      await sincronizarReceitasPagas(criados);
      return NextResponse.json(
        { lancamentos: criados, numeroFatura },
        { status: 201 }
      );
    }

    let descricao = data.descricao;
    const parcelaNumero = data.parcelaNumero;
    const parcelaTotal = data.parcelaTotal;
    if (
      parcelaNumero &&
      parcelaTotal &&
      parcelaTotal > 1 &&
      !parseParcelaNaDescricao(descricao)
    ) {
      descricao = descricaoDespesaComParcela(
        descricao,
        `${parcelaNumero}/${parcelaTotal}`
      );
    }

    const lancamento = await prisma.lancamento.create({
      data: dadosCreateLancamento(ctx.empresaId, data, descricao),
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
        const registro = atualizado || lancamento;
        const audit = await auditarCriacaoLancamento(session, registro, {
          parcelaNumero,
          parcelaTotal,
          numeroFatura: data.numeroFatura,
        });
        await auditarCriacaoLancamento(session, registro, {
          boleto: true,
          parcelaNumero,
          parcelaTotal,
          numeroFatura: audit.numeroFatura ?? data.numeroFatura,
        });
        return NextResponse.json(
          {
            ...registro,
            boletoEmitido: Boolean(cobranca),
            numeroFatura: audit.numeroFatura,
          },
          { status: 201 }
        );
      } catch (err) {
        await prisma.lancamento.delete({ where: { id: lancamento.id } });
        const msg =
          err instanceof Error ? err.message : "Falha ao emitir boleto no Asaas.";
        return NextResponse.json({ error: msg }, { status: 422 });
      }
    }

    let numeroFaturaRetorno = data.numeroFatura;
    try {
      const audit = await auditarCriacaoLancamento(session, lancamento, {
        parcelaNumero,
        parcelaTotal,
        numeroFatura: data.numeroFatura,
      });
      numeroFaturaRetorno = audit.numeroFatura ?? numeroFaturaRetorno;
    } catch (auditErr) {
      console.error("[financeiro POST] auditoria", auditErr);
    }

    if (lancamento.tipo === "receita" && lancamento.status === "pago") {
      try {
        await sincronizarMovimentacaoRecebimentoServidor(ctx.empresaId, lancamento);
      } catch (syncErr) {
        console.error("[financeiro POST] sync conta bancária", syncErr);
      }
    }

    return NextResponse.json(
      { ...lancamento, numeroFatura: numeroFaturaRetorno },
      { status: 201 }
    );
  } catch (err) {
    console.error("[financeiro POST]", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Não foi possível salvar o lançamento." },
      { status: 500 }
    );
  }
}
