import { NextResponse } from "next/server";
import { z } from "zod";
import { runWithTenantContext } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import {
  aprovarSolicitacaoEnvioCliente,
  recusarSolicitacaoEnvioCliente,
} from "@/lib/solicitacao-envio-aprovar";
import {
  listarSolicitacoesEnvioCliente,
  obterSolicitacaoEnvioPorId,
  serializarSolicitacaoEnvio,
} from "@/lib/solicitacao-envio-servidor";

export const dynamic = "force-dynamic";

const schemaAcao = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("aprovar"),
    id: z.string().min(1),
  }),
  z.object({
    acao: z.literal("recusar"),
    id: z.string().min(1),
    motivo: z.string().trim().max(500).optional(),
  }),
]);

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(ctx, "producao-os", "ver");
  if (negado) return negado;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const id = searchParams.get("id") || undefined;

  if (id) {
    const item = await runWithTenantContext(ctx.empresaId, () =>
      obterSolicitacaoEnvioPorId(ctx.empresaId, id)
    );
    if (!item) {
      return NextResponse.json({ error: "Não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ solicitacao: serializarSolicitacaoEnvio(item) });
  }

  const lista = await runWithTenantContext(ctx.empresaId, () =>
    listarSolicitacoesEnvioCliente({
      empresaId: ctx.empresaId,
      status,
      limite: 80,
    })
  );

  return NextResponse.json({
    solicitacoes: lista.map(serializarSolicitacaoEnvio),
  });
}

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(ctx, "producao-os", "criar");
  if (negado) return negado;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const parsed = schemaAcao.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  if (parsed.data.acao === "aprovar") {
    const res = await runWithTenantContext(ctx.empresaId, () =>
      aprovarSolicitacaoEnvioCliente({
        empresaId: ctx.empresaId,
        solicitacaoId: parsed.data.id,
        userId: ctx.user.id,
      })
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: res.message },
        { status: res.code === "nao_encontrada" ? 404 : 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      solicitacao: serializarSolicitacaoEnvio(res.solicitacao),
      trabalho: res.trabalho,
    });
  }

  const { id, motivo } = parsed.data;
  const res = await runWithTenantContext(ctx.empresaId, () =>
    recusarSolicitacaoEnvioCliente({
      empresaId: ctx.empresaId,
      solicitacaoId: id,
      userId: ctx.user.id,
      motivo,
    })
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: res.message },
      { status: res.code === "nao_encontrada" ? 404 : 400 }
    );
  }
  return NextResponse.json({
    ok: true,
    solicitacao: serializarSolicitacaoEnvio(res.solicitacao),
  });
}
