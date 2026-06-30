import type { SuporteMensagemDto } from "@/lib/suporte-chat";
import { getTvSocketIo } from "@/lib/tv/tv-socket-io";
import {
  SUPORTE_SOCKET_EVENTS,
  salaSuporteEmpresa,
  salaSuporteMaster,
  type SuporteSocketConversaExpiradaPayload,
  type SuporteSocketNovaMensagemPayload,
  type SuporteSocketNaoLidasEmpresaPayload,
  type SuporteSocketStatusAdminPayload,
} from "@/lib/suporte/suporte-socket-events";

export function emitSuporteNovaMensagem(empresaId: string, mensagem: SuporteMensagemDto) {
  const io = getTvSocketIo();
  if (!io) return;

  const payload: SuporteSocketNovaMensagemPayload = { empresaId, mensagem };
  io.to(salaSuporteEmpresa(empresaId)).emit(SUPORTE_SOCKET_EVENTS.novaMensagem, payload);
  io.to(salaSuporteMaster()).emit(SUPORTE_SOCKET_EVENTS.novaMensagem, payload);
}

export function emitSuporteConversasAtualizadas() {
  const io = getTvSocketIo();
  if (!io) return;
  io.to(salaSuporteMaster()).emit(SUPORTE_SOCKET_EVENTS.conversasAtualizadas);
}

export function emitSuporteNaoLidasEmpresa(empresaId: string, naoLidas: number) {
  const io = getTvSocketIo();
  if (!io) return;
  const payload: SuporteSocketNaoLidasEmpresaPayload = { naoLidas };
  io.to(salaSuporteEmpresa(empresaId)).emit(SUPORTE_SOCKET_EVENTS.naoLidasEmpresa, payload);
}

export function emitSuporteStatusAdmin(online: boolean) {
  const io = getTvSocketIo();
  if (!io) return;
  const payload: SuporteSocketStatusAdminPayload = { online };
  io.emit(SUPORTE_SOCKET_EVENTS.statusAdmin, payload);
}

export function emitSuporteConversaExpirada(empresaId: string) {
  const io = getTvSocketIo();
  if (!io) return;
  const payload: SuporteSocketConversaExpiradaPayload = { empresaId };
  io.to(salaSuporteEmpresa(empresaId)).emit(SUPORTE_SOCKET_EVENTS.conversaExpirada, payload);
  io.to(salaSuporteMaster()).emit(SUPORTE_SOCKET_EVENTS.conversaExpirada, payload);
}
