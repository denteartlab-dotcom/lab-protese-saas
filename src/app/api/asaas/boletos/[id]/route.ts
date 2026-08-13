import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import {
  atualizarBoletoAsaasEmpresa,
  cancelarBoletoAsaasEmpresa,
  obterBoletoAsaasEmpresa,
} from "@/lib/asaas-boletos-servidor";

type CtxRota = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctxRota: CtxRota) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const negado = await negarSeSemPermissao(
    ctx,
    "financeiro-aba-conta-bancaria",
    "ver"
  );
  if (negado) return negado;

  const { id } = await ctxRota.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    const boleto = await obterBoletoAsaasEmpresa(ctx.empresaId, id.trim());
    return NextResponse.json({ boleto });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao obter boleto." },
      { status: 422 }
    );
  }
}

export async function PUT(request: Request, ctxRota: CtxRota) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const negado = await negarSeSemPermissao(
    ctx,
    "financeiro-aba-conta-bancaria",
    "editar"
  );
  if (negado) return negado;

  const { id } = await ctxRota.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      dueDate?: string;
      interest?: number | null;
      fine?: number | null;
      removerJurosMulta?: boolean;
    };

    const payload =
      body.removerJurosMulta === true
        ? { interest: 0, fine: 0 }
        : {
            dueDate: body.dueDate,
            interest: body.interest,
            fine: body.fine,
          };

    const boleto = await atualizarBoletoAsaasEmpresa(
      ctx.empresaId,
      id.trim(),
      payload
    );
    return NextResponse.json({ boleto });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erro ao atualizar boleto.",
      },
      { status: 422 }
    );
  }
}

export async function DELETE(_request: Request, ctxRota: CtxRota) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const negado = await negarSeSemPermissao(
    ctx,
    "financeiro-aba-conta-bancaria",
    "excluir"
  );
  if (negado) return negado;

  const { id } = await ctxRota.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    await cancelarBoletoAsaasEmpresa(ctx.empresaId, id.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erro ao cancelar boleto.",
      },
      { status: 422 }
    );
  }
}
