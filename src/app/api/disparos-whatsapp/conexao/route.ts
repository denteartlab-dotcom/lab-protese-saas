import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { baileysStatus, baileysReconectar } from "@/lib/whatsapp-disparos/baileys-service";
import {
  aguardarQrBaileys,
  sincronizarConexaoWhatsappSocket,
} from "@/lib/whatsapp-disparos/conexao-monitor";
import {
  metricasDisparosWhatsapp,
  obterSessaoWhatsapp,
  sincronizarSessaoWhatsapp,
} from "@/lib/whatsapp-disparos/campanha-servidor";
import { formatarTelefoneExibicao } from "@/lib/whatsapp-disparos/telefone-br";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [status, metricas, sessao] = await Promise.all([
    baileysStatus(),
    metricasDisparosWhatsapp(ctx.empresaId),
    obterSessaoWhatsapp(ctx.empresaId),
  ]);

  const baileysOnline = status !== null;
  const conectado = Boolean(status?.connected);
  const numero = status?.connected
    ? formatarTelefoneExibicao(String((status as { phone?: string }).phone || sessao?.numeroConectado || ""))
    : null;

  if (conectado) {
    await sincronizarSessaoWhatsapp(ctx.empresaId, {
      conectado: true,
      numero: (status as { phone?: string }).phone || sessao?.numeroConectado,
    });
  }

  return NextResponse.json({
    conexao: {
      conectado,
      baileysOnline,
      numero,
      ultimaConexao: sessao?.ultimaConexaoEm?.toISOString() || null,
      qr: status?.qr || null,
      status: !baileysOnline
        ? "servico_offline"
        : conectado
          ? "conectado"
          : status?.qr
            ? "aguardando_qr"
            : "desconectado",
    },
    metricas,
  });
}

export async function POST() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  await baileysReconectar({ limparAuth: true });
  const status = await aguardarQrBaileys(55);
  void sincronizarConexaoWhatsappSocket();

  if (!status) {
    return NextResponse.json(
      {
        error:
          "Serviço WhatsApp offline. Na VPS: pm2 restart lab-protese-whatsapp. Confira WHATSAPP_HTTP_URL no .env.",
      },
      { status: 503 }
    );
  }

  if (!status.connected && !status.qr) {
    return NextResponse.json(
      {
        error:
          "QR não foi gerado. Veja os logs: pm2 logs lab-protese-whatsapp --lines 50",
        baileysOnline: true,
        conectado: false,
        qr: null,
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    ok: true,
    qr: status.qr || null,
    conectado: Boolean(status.connected),
    baileysOnline: true,
  });
}
