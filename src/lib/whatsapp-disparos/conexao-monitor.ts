import { consultarStatusBaileys } from "@/lib/whatsapp-baileys-status";
import { baileysReconectar } from "@/lib/whatsapp-disparos/baileys-service";
import {
  DISPARO_SOCKET_EVENTS,
  type DisparoConexaoPayload,
} from "@/lib/whatsapp-disparos/disparos-socket-events";
import { getDisparoSocketIo } from "@/lib/whatsapp-disparos/disparos-socket-io";
import { garantirFilasCampanhasAtivas } from "@/lib/whatsapp-disparos/campaign-queue";

let ultimoQr: string | null | undefined;
let ultimoConectado: boolean | undefined;
let ultimoPhone: string | null | undefined;
let ultimoReconnectAutomatico = 0;

function assinaturaQr(qr: string | null) {
  if (!qr) return null;
  return qr.slice(-32);
}

function emitir(payload: DisparoConexaoPayload) {
  const io = getDisparoSocketIo();
  if (!io) return;
  io.emit(DISPARO_SOCKET_EVENTS.conexao, payload);
  io.emit(DISPARO_SOCKET_EVENTS.qr, { qr: payload.qr });
}

export async function sincronizarConexaoWhatsappSocket() {
  let status = await consultarStatusBaileys();
  if (!status) return null;

  if (
    !status.connected &&
    !status.pairingBlocked &&
    !status.iniciando &&
    !status.qr &&
    Date.now() - ultimoReconnectAutomatico > 45_000
  ) {
    ultimoReconnectAutomatico = Date.now();
    try {
      await baileysReconectar({ limparAuth: false });
      status = (await consultarStatusBaileys()) || status;
    } catch {
      /* tenta de novo no próximo ciclo */
    }
  }

  const conectado = Boolean(status.connected);
  const qr = status.qr || null;
  const phone = status.phone || null;

  const mudou =
    assinaturaQr(ultimoQr ?? null) !== assinaturaQr(qr) ||
    ultimoConectado !== conectado ||
    ultimoPhone !== phone;

  if (mudou) {
    ultimoQr = qr;
    ultimoConectado = conectado;
    ultimoPhone = phone;

    emitir({
      conectado,
      numero: phone,
      ultimaConexao: conectado ? new Date().toISOString() : null,
      qr,
    });
  }

  return status;
}

export function iniciarMonitorConexaoWhatsapp(intervaloMs = 2500) {
  void sincronizarConexaoWhatsappSocket();
  void garantirFilasCampanhasAtivas().catch((err) =>
    console.error("[whatsapp-monitor] filas:", err)
  );
  return setInterval(() => {
    void sincronizarConexaoWhatsappSocket();
    void garantirFilasCampanhasAtivas().catch((err) =>
      console.error("[whatsapp-monitor] filas:", err)
    );
  }, intervaloMs);
}

export async function aguardarQrBaileys(maxSegundos = 55) {
  const inicio = Date.now();
  while (Date.now() - inicio < maxSegundos * 1000) {
    const status = await consultarStatusBaileys();
    if (status?.connected) return status;
    if (status?.qr) return status;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return consultarStatusBaileys();
}
