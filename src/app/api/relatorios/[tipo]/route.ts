import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { acaoHttpParaPermissao, negarSeSemPermissao } from "@/lib/require-permissao";

export type RelatorioResposta = {
  colunas: string[];
  linhas: Record<string, unknown>[];
  totais: Record<string, number>;
  meta: { tipo: string; geradoEm: string };
};

type Params = { params: Promise<{ tipo: string }> };

const TIPOS_SUPORTADOS = new Set(["fluxo-de-caixa", "producao"]);

function escaparCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  if (/[";\n\r]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

function respostaComoCsv(payload: RelatorioResposta) {
  const colunas = payload.colunas;
  const cabecalho = colunas.map(escaparCsv).join(";");
  const linhas = payload.linhas.map((linha) =>
    colunas.map((col) => escaparCsv(linha[col])).join(";")
  );
  const csv = "\uFEFF" + [cabecalho, ...linhas].join("\r\n");
  const nomeArquivo = `${payload.meta.tipo}-${payload.meta.geradoEm.slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}

export async function GET(request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { tipo } = await params;
  const moduloRelatorio =
    tipo === "fluxo-de-caixa"
      ? "relatorios-fluxo-de-caixa"
      : tipo === "producao"
        ? "relatorios-producao"
        : `relatorios-${tipo}`;
  const negado = await negarSeSemPermissao(ctx, moduloRelatorio, acaoHttpParaPermissao("GET"));
  if (negado) return negado;

  if (!TIPOS_SUPORTADOS.has(tipo)) {
    return NextResponse.json({ error: "Tipo de relatório não suportado." }, { status: 400 });
  }

  const url = new URL(request.url);
  const de = url.searchParams.get("de");
  const ate = url.searchParams.get("ate");
  const formato = (url.searchParams.get("formato") || "json").toLowerCase();

  if (tipo === "fluxo-de-caixa") {
    const { findLancamentosFinanceiro } = await import("@/lib/lancamentos-cobranca");
    const { valorEfetivoLancamentoFinanceiro } = await import(
      "@/lib/lancamento-valor-caixa"
    );
    const lancamentos = await findLancamentosFinanceiro({
      where: {
        empresaId: ctx.empresaId,
        ...(de && ate
          ? { data: { gte: new Date(de), lte: new Date(ate) } }
          : {}),
      },
      orderBy: { data: "asc" },
    });

    let entradas = 0;
    let saidas = 0;
    const base = lancamentos.map((l) => ({
      id: l.id,
      data: l.data.toISOString(),
      descricao: l.descricao,
      tipo: l.tipo,
      valor: l.valor,
      status: l.status,
      formaPagamento: l.formaPagamento ?? null,
      cliente: l.cliente ? { id: l.cliente.id, nome: l.cliente.nome } : null,
    }));

    const linhas = base.map((l) => {
      const efetivo = valorEfetivoLancamentoFinanceiro(l, base);
      if (l.tipo === "receita" && l.status === "pago") entradas += efetivo;
      if (l.tipo === "despesa" && l.status === "pago") saidas += efetivo;
      return l;
    });

    const resposta: RelatorioResposta = {
      colunas: ["data", "descricao", "tipo", "valor", "status", "formaPagamento"],
      linhas,
      totais: { entradas, saidas, saldo: entradas - saidas },
      meta: { tipo, geradoEm: new Date().toISOString() },
    };
    if (formato === "csv") return respostaComoCsv(resposta);
    return NextResponse.json(resposta);
  }

  const trabalhos = await prisma.trabalho.findMany({
    where: {
      empresaId: ctx.empresaId,
      ...(de && ate ? { createdAt: { gte: new Date(de), lte: new Date(ate) } } : {}),
    },
    include: {
      paciente: { select: { nome: true } },
      cliente: { select: { nome: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const resposta: RelatorioResposta = {
    colunas: ["numeroOs", "servico", "paciente", "cliente", "status", "criadoEm"],
    linhas: trabalhos.map((t) => ({
      id: t.id,
      numeroOs: t.numeroOs,
      servico: t.tipoProtese,
      paciente: t.paciente?.nome ?? "—",
      cliente: t.cliente?.nome ?? "—",
      status: t.status,
      criadoEm: t.createdAt.toISOString(),
    })),
    totais: { registros: trabalhos.length },
    meta: { tipo, geradoEm: new Date().toISOString() },
  };

  if (formato === "csv") return respostaComoCsv(resposta);
  return NextResponse.json(resposta);
}
