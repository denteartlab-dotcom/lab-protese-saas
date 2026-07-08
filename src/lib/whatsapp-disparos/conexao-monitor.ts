import { consultarStatusBaileys } from "@/lib/whatsapp-baileys-status";
import {
  DISPARO_SOCKET_EVENTS,
  type DisparoConexaoPayload,
} from "@/lib/whatsapp-disparos/disparos-socket-events";
import { getDisparoSocketIo } from "@/lib/whatsapp-disparos/disparos-socket-io";

let ultimoQr: string | null | undefined;
let ultimoConectado: boolean | undefined;
let ultimoPhone: string | null | undefined;

function emitir(payload: DisparoConexaoPayload) {
  const io = getDisparoSocketIo();
  if (!io) return;
  io.emit(DISPARO_SOCKET_EVENTS.conexao, payload);
  io.emit(DISPARO_SOCKET_EVENTS.qr, { qr: payload.qr });
}

export async function sincronizarConexaoWhatsappSocket() {
  const status = await consultarStatusBaileys();
  if (!status) return null;

  const conectado = Boolean(status.connected);
  const qr = status.qr || null;
  const phone = status.phone || null;

  const mudou =
    ultimoQr !== qr ||
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
  return setInterval(() => {
    void sincronizarConexaoWhatsappSocket();
  }, intervaloMs);
}

export async function aguardarQrBaileys(maxSegundos = 20) {
  const inicio = Date.now();
  while (Date.now() - inicio < maxSegundos * 1000) {
    const status = await consultarStatusBaileys();
    if (status?.connected) return status;
    if (status?.qr) return status;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return consultarStatusBaileys();
}
