import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import { baileysPairingCode, baileysStatus } from "@/lib/whatsapp-disparos/baileys-service";
import { sincronizarConexaoWhatsappSocket } from "@/lib/whatsapp-disparos/conexao-monitor";

export async function POST(req: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(ctx, "disparos-whatsapp", "editar");
  if (negado) return negado;

  const body = (await req.json().catch(() => ({}))) as { telefone?: string };
  const telefone = String(body.telefone || "").trim();
  if (!telefone) {
    return NextResponse.json({ error: "Informe o telefone com DDI (ex: 5533999123456)." }, { status: 400 });
  }

  const atual = await baileysStatus();
  if (atual?.connected) {
    return NextResponse.json({ ok: true, conectado: true, mensagem: "WhatsApp já conectado." });
  }

  try {
    const result = await baileysPairingCode(telefone);
    void sincronizarConexaoWhatsappSocket();

    if (result.connected) {
      return NextResponse.json({ ok: true, conectado: true });
    }

    if (!result.pairingCode && !result.pairingCodeFormatado) {
      return NextResponse.json(
        { error: "Código não gerado. Aguarde 10s e tente novamente." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      codigo: result.pairingCodeFormatado || result.pairingCode,
      instrucoes:
        "No celular: WhatsApp → Aparelhos conectados → Conectar dispositivo → Vincular com número de telefone → digite o código.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao gerar código de pareamento." },
      { status: 503 }
    );
  }
}
