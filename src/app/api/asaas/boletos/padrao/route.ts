import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import {
  limparPadraoBoletoAsaas,
  obterPadraoBoletoAsaas,
  salvarPadraoBoletoAsaas,
} from "@/lib/asaas-boleto-padrao";

export async function GET() {
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

  const padrao = await obterPadraoBoletoAsaas(ctx.empresaId);
  return NextResponse.json({ padrao });
}

export async function PUT(request: Request) {
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

  try {
    const body = (await request.json()) as {
      interest?: number;
      fine?: number;
      vencimentoTipo?: "data_fixa" | "dias_apos" | "dia_mes";
      dataFixa?: string | null;
      diasApos?: number;
      diaMes?: number;
      limpar?: boolean;
    };
    if (body.limpar === true) {
      const padrao = await limparPadraoBoletoAsaas(ctx.empresaId);
      return NextResponse.json({ padrao });
    }
    const padrao = await salvarPadraoBoletoAsaas(ctx.empresaId, {
      interest: Number(body.interest) || 0,
      fine: Number(body.fine) || 0,
      vencimentoTipo: body.vencimentoTipo || "dias_apos",
      dataFixa: body.dataFixa,
      diasApos: body.diasApos,
      diaMes: body.diaMes,
    });
    return NextResponse.json({ padrao });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Não foi possível salvar a configuração do boleto.",
      },
      { status: 422 }
    );
  }
}
