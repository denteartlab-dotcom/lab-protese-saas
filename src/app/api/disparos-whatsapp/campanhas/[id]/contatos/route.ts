import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import { listarContatosCampanha } from "@/lib/whatsapp-disparos/campanha-servidor";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(ctx, "disparos-whatsapp", "ver");
  if (negado) return negado;

  const { id } = await params;
  const url = new URL(request.url);
  const limite = Number(url.searchParams.get("limite") || "100");
  const contatos = await listarContatosCampanha(ctx.empresaId, id, limite);

  return NextResponse.json({
    contatos: contatos.map((c) => ({
      id: c.id,
      nome: c.nome,
      telefone: c.telefone,
      status: c.status,
      tentativas: c.tentativas,
      erro: c.erro,
      horario: c.enviadoEm?.toISOString() || c.updatedAt.toISOString(),
    })),
  });
}
