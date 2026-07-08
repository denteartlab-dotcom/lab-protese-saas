import type { Server as SocketIOServer } from "socket.io";
import { getTvSocketIo } from "@/lib/tv/tv-socket-io";
import {
  DISPARO_SOCKET_EVENTS,
  salaDisparoEmpresa,
  type DisparoConexaoPayload,
  type DisparoContatoPayload,
  type DisparoProgressoPayload,
} from "@/lib/whatsapp-disparos/disparos-socket-events";

export function getDisparoSocketIo(): SocketIOServer | null {
  return getTvSocketIo();
}

export function emitDisparoConexao(empresaId: string, payload: DisparoConexaoPayload) {
  const io = getDisparoSocketIo();
  io?.to(salaDisparoEmpresa(empresaId)).emit(DISPARO_SOCKET_EVENTS.conexao, payload);
}

export function emitDisparoQr(empresaId: string, qr: string | null) {
  const io = getDisparoSocketIo();
  io?.to(salaDisparoEmpresa(empresaId)).emit(DISPARO_SOCKET_EVENTS.qr, { qr });
}

export function emitDisparoProgresso(empresaId: string, payload: DisparoProgressoPayload) {
  const io = getDisparoSocketIo();
  io?.to(salaDisparoEmpresa(empresaId)).emit(DISPARO_SOCKET_EVENTS.progresso, payload);
}

export function emitDisparoContato(empresaId: string, payload: DisparoContatoPayload) {
  const io = getDisparoSocketIo();
  io?.to(salaDisparoEmpresa(empresaId)).emit(DISPARO_SOCKET_EVENTS.contato, payload);
}

export function emitDisparoCampanha(empresaId: string, payload: Record<string, unknown>) {
  const io = getDisparoSocketIo();
  io?.to(salaDisparoEmpresa(empresaId)).emit(DISPARO_SOCKET_EVENTS.campanha, payload);
}
