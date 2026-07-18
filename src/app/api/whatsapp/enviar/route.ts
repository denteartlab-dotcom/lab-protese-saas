import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { enviarMensagemWhatsapp } from "@/lib/whatsapp-enviar";
import { negarSeSemPermissaoEmAlgum } from "@/lib/require-permissao";

const schema = z.object({
  telefone: z.string().min(8),
  mensagem: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const negado = await negarSeSemPermissaoEmAlgum(ctx, [
    { moduloId: "disparos-whatsapp", acao: "criar" },
    { moduloId: "clientes", acao: "ver" },
    { moduloId: "orcamentos", acao: "ver" },
    { moduloId: "financeiro-aba-conta-bancaria", acao: "ver" },
    { moduloId: "financeiro-tipo-receita", acao: "ver" },
  ]);
  if (negado) return negado;

  try {
    const body = await request.json();
    const data = schema.parse(body);
    const resultado = await enviarMensagemWhatsapp(data.telefone, data.mensagem);
    if (!resultado.ok) {
      return NextResponse.json({ ok: false, error: resultado.error }, { status: 422 });
    }
    return NextResponse.json({ ok: true, modo: resultado.modo });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao enviar WhatsApp" },
      { status: 500 }
    );
  }
}
