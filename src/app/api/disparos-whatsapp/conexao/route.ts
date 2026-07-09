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

type BaileysStatusExtra = {
  phone?: string | null;
  qr?: string | null;
  connected?: boolean;
  hasSocket?: boolean;
  iniciando?: boolean;
  credenciaisRegistradas?: boolean;
  pareamentoEmAndamento?: boolean;
  pairingBlocked?: boolean;
  pairingBlockedUntil?: string | null;
  pairingBlockedReason?: string | null;
};

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [status, metricas, sessao] = await Promise.all([
    baileysStatus(),
    metricasDisparosWhatsapp(ctx.empresaId),
    obterSessaoWhatsapp(ctx.empresaId),
  ]);

  const extra = (status || {}) as BaileysStatusExtra;
  const baileysOnline = status !== null;
  const conectado = Boolean(status?.connected);
  const pareamento = Boolean(extra.pareamentoEmAndamento || (extra.credenciaisRegistradas && !conectado));
  const bloqueado = Boolean(extra.pairingBlocked);
  const numero = status?.connected
    ? formatarTelefoneExibicao(String(extra.phone || sessao?.numeroConectado || ""))
    : null;

  if (conectado) {
    await sincronizarSessaoWhatsapp(ctx.empresaId, {
      conectado: true,
      numero: extra.phone || sessao?.numeroConectado,
    });
  }

  return NextResponse.json({
    conexao: {
      conectado,
      baileysOnline,
      numero,
      ultimaConexao: sessao?.ultimaConexaoEm?.toISOString() || null,
      qr: conectado || bloqueado ? null : status?.qr || null,
      pareamentoEmAndamento: pareamento,
      pairingBlocked: bloqueado,
      pairingBlockedUntil: extra.pairingBlockedUntil || null,
      status: !baileysOnline
        ? "servico_offline"
        : conectado
          ? "conectado"
          : bloqueado
            ? "bloqueado_whatsapp"
          : pareamento
            ? "pareamento"
            : status?.qr
              ? "aguardando_qr"
              : "desconectado",
    },
    metricas,
  });
}

export async function POST(req: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { reset?: boolean };
  const atual = (await baileysStatus()) as BaileysStatusExtra | null;

  if (atual?.pairingBlocked) {
    return NextResponse.json(
      {
        error:
          "WhatsApp bloqueou novos dispositivos temporariamente. Aguarde 24h, remova aparelhos antigos no celular e tente de novo.",
        pairingBlocked: true,
        pairingBlockedUntil: atual.pairingBlockedUntil || null,
        baileysOnline: true,
        conectado: false,
        qr: null,
      },
      { status: 429 }
    );
  }

  if (atual?.connected) {
    return NextResponse.json({
      ok: true,
      conectado: true,
      baileysOnline: true,
      qr: null,
    });
  }

  if (atual?.qr && !body.reset) {
    return NextResponse.json({
      ok: true,
      conectado: false,
      baileysOnline: true,
      qr: atual.qr,
    });
  }

  if (atual?.credenciaisRegistradas && !atual.connected && !body.reset) {
    const aguardado = await aguardarQrBaileys(35);
    void sincronizarConexaoWhatsappSocket();
    return NextResponse.json({
      ok: true,
      conectado: Boolean(aguardado?.connected),
      baileysOnline: true,
      qr: aguardado?.qr || null,
      pareamentoEmAndamento: !aguardado?.connected && !aguardado?.qr,
      mensagem: "Pareamento detectado — aguarde até 30s sem clicar novamente.",
    });
  }

  let reconnect: Awaited<ReturnType<typeof baileysReconectar>>;
  try {
    reconnect = await baileysReconectar({
      limparAuth: Boolean(body.reset),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Falha ao conectar no Baileys. Confira WHATSAPP_HTTP_URL e pm2 restart lab-protese-whatsapp.",
      },
      { status: 503 }
    );
  }

  const status =
    reconnect.connected || reconnect.qr
      ? {
          connected: Boolean(reconnect.connected),
          qr: reconnect.qr ?? null,
          phone: reconnect.phone ?? null,
        }
      : await aguardarQrBaileys(45);

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
          "Aguardando conexão após pareamento ou QR não gerado. Aguarde 30s ou rode npm run whatsapp:reset na VPS.",
        baileysOnline: true,
        conectado: false,
        qr: null,
        pareamentoEmAndamento: true,
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
