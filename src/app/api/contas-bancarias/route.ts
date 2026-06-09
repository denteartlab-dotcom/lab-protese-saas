import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listarContasBancariasServidor,
  listarExtratoBancarioServidor,
  listarMovimentacoesContaServidor,
  salvarContasBancariasServidor,
  salvarExtratoBancarioServidor,
  salvarMovimentacoesContaServidor,
} from "@/lib/conta-bancaria-servidor";
import type { ContaBancaria } from "@/lib/conta-bancaria";
import type { ExtratoMovimentacao } from "@/lib/extrato-bancario";
import type { MovimentacaoContaBancaria } from "@/lib/conta-bancaria";
import { z } from "zod";

const contaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  saldoInicial: z.number(),
  excluida: z.boolean().optional(),
  acaoPrincipal: z.enum(["movimentar", "baixar", "adicionar_credito"]),
  codBanco: z.string().optional(),
  agencia: z.string().optional(),
  numeroConta: z.string().optional(),
  tipoChavePix: z.string().optional(),
  chavePix: z.string().optional(),
  modoVinculo: z.enum(["manual", "open_finance", "extrato_arquivo"]).optional(),
  openFinance: z
    .object({
      provedor: z.literal("pluggy"),
      itemId: z.string(),
      conectadoEm: z.string(),
      ultimaSync: z.string().optional(),
      status: z.enum(["conectado", "erro", "sincronizando"]),
      mensagemErro: z.string().optional(),
    })
    .optional(),
});

const payloadSchema = z.object({
  contas: z.array(contaSchema).optional(),
  movimentacoes: z
    .array(
      z.object({
        id: z.string(),
        contaId: z.string(),
        tipo: z.enum(["entrada", "saida"]),
        valor: z.number(),
        descricao: z.string(),
        data: z.string(),
      })
    )
    .optional(),
  extrato: z
    .array(
      z.object({
        id: z.string(),
        contaId: z.string(),
        tipo: z.enum(["entrada", "saida"]),
        valor: z.number(),
        descricao: z.string(),
        data: z.string(),
        origem: z.enum(["open_finance", "arquivo", "manual"]),
        idExterno: z.string().optional(),
      })
    )
    .optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const [contas, movimentacoes, extrato] = await Promise.all([
      listarContasBancariasServidor(),
      listarMovimentacoesContaServidor(),
      listarExtratoBancarioServidor(),
    ]);
    return NextResponse.json({ contas, movimentacoes, extrato });
  } catch (err) {
    console.error("[contas-bancarias GET]", err);
    return NextResponse.json(
      { error: "Erro ao carregar contas bancárias." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = payloadSchema.parse(body);

    if (data.contas) {
      await salvarContasBancariasServidor(data.contas as ContaBancaria[]);
    }
    if (data.movimentacoes) {
      await salvarMovimentacoesContaServidor(
        data.movimentacoes as MovimentacaoContaBancaria[]
      );
    }
    if (data.extrato) {
      await salvarExtratoBancarioServidor(data.extrato as ExtratoMovimentacao[]);
    }

    const [contas, movimentacoes, extrato] = await Promise.all([
      listarContasBancariasServidor(),
      listarMovimentacoesContaServidor(),
      listarExtratoBancarioServidor(),
    ]);

    return NextResponse.json({ contas, movimentacoes, extrato });
  } catch (err) {
    console.error("[contas-bancarias PUT]", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Erro ao salvar contas bancárias." },
      { status: 500 }
    );
  }
}
