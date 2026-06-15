import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  listarLogsAuditoria,
  registrarLogAuditoria,
  type FiltrosLogsAuditoria,
} from "@/lib/logs-auditoria";

const categoriasValidas = [
  "os",
  "financeiro_receitas_parcelas",
  "financeiro_receitas_recebimentos",
  "boletos",
  "despesas",
  "despesas_pagamentos_parcelas",
  "etapas",
  "acertos",
] as const;

const postSchema = z.object({
  categoria: z.enum(categoriasValidas),
  tipoAlteracao: z.enum(["alteracao", "inclusao", "exclusao"]).default("alteracao"),
  numeroOs: z.number().int().positive().optional().nullable(),
  trabalhoId: z.string().optional().nullable(),
  lancamentoId: z.string().optional().nullable(),
  referencia: z.string().optional().nullable(),
  servico: z.string().optional().nullable(),
  etapa: z.string().optional().nullable(),
  colaborador: z.string().optional().nullable(),
  clienteNome: z.string().optional().nullable(),
  parcelaNumero: z.number().int().positive().optional().nullable(),
  parcelaTotal: z.number().int().positive().optional().nullable(),
  detalhes: z
    .array(
      z.object({
        campo: z.string(),
        antes: z.string(),
        depois: z.string(),
      })
    )
    .optional()
    .nullable(),
});

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filtros: FiltrosLogsAuditoria = {
    categoria: searchParams.get("categoria") || "os",
    tipoAlteracao: searchParams.get("tipoAlteracao") || "todos",
    referencia:
      searchParams.get("referencia") || searchParams.get("numeroOs") || "",
    periodo: searchParams.get("periodo") || "hoje",
    dataInicio: searchParams.get("dataInicio") || "",
    dataFim: searchParams.get("dataFim") || "",
  };

  try {
    const linhas = await listarLogsAuditoria(filtros, ctx.empresaId);
    return NextResponse.json({ linhas });
  } catch (err) {
    console.error("[logs-auditoria GET]", err);
    return NextResponse.json({ error: "Erro ao carregar logs." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = postSchema.parse(body);

    const log = await registrarLogAuditoria({
      empresaId: ctx.empresaId,
      categoria: data.categoria,
      tipoAlteracao: data.tipoAlteracao,
      numeroOs: data.numeroOs,
      trabalhoId: data.trabalhoId,
      lancamentoId: data.lancamentoId,
      referencia: data.referencia,
      servico: data.servico,
      etapa: data.etapa,
      colaborador: data.colaborador,
      clienteNome: data.clienteNome,
      parcelaNumero: data.parcelaNumero,
      parcelaTotal: data.parcelaTotal,
      usuarioId: ctx.user.id,
      usuarioNome: ctx.user.name,
      detalhes: data.detalhes,
    });

    return NextResponse.json({ ok: true, id: log.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }
    console.error("[logs-auditoria POST]", err);
    return NextResponse.json({ error: "Erro ao registrar log." }, { status: 500 });
  }
}
