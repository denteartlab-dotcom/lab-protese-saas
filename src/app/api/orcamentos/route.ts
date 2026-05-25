import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  calcularTotaisItens,
  totalLiquidoOrcamento,
  type ItemOrcamento,
  type StatusOrcamento,
} from "@/lib/orcamentos-types";
import {
  gerarTokenOrcamento,
  mapOrcamento,
  proximoNumeroPedido,
} from "@/lib/orcamentos-db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  ;
  const rows = await prisma.orcamento.findMany({
    orderBy: { numeroPedido: "desc" },
  });

  return NextResponse.json(rows.map(mapOrcamento));
}

type BodyCriar = {
  fornecedorId?: string;
  fornecedorNome?: string;
  status?: StatusOrcamento;
  desconto?: number;
  descontoPercentual?: number;
  observacoes?: string;
  emailEnvio?: string;
  whatsappEnvio?: string;
  labNome?: string;
  labTelefone?: string;
  labEmail?: string;
  itens: ItemOrcamento[];
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = (await request.json()) as BodyCriar;
  if (!Array.isArray(body.itens) || body.itens.length === 0) {
    return NextResponse.json({ error: "Itens obrigatórios" }, { status: 400 });
  }

  const itensLab = body.itens.map((item) => ({
    ...item,
    valorUnitario: 0,
  }));

  const subtotal = calcularTotaisItens(itensLab);
  const desconto = body.desconto ?? 0;
  const descontoPercentual = body.descontoPercentual ?? 0;
  const totalLiquido = totalLiquidoOrcamento(
    subtotal,
    desconto,
    descontoPercentual
  );

  const numeroPedido = await proximoNumeroPedido();
  const token = gerarTokenOrcamento();

  ;
  const row = await prisma.orcamento.create({
    data: {
      numeroPedido,
      token,
      fornecedorId: body.fornecedorId || null,
      fornecedorNome: body.fornecedorNome || "",
      status: body.status || "aguardando_resposta",
      subtotal,
      desconto,
      descontoPercentual,
      totalLiquido,
      observacoes: body.observacoes || null,
      emailEnvio: body.emailEnvio || null,
      whatsappEnvio: body.whatsappEnvio || null,
      labNome: body.labNome || session.name,
      labTelefone: body.labTelefone || null,
      labEmail: body.labEmail || session.email,
      itensJson: JSON.stringify(itensLab),
      linkAtivo: true,
    },
  });

  return NextResponse.json(mapOrcamento(row), { status: 201 });
}
