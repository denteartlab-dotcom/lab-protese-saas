/** Constantes de rota do Socket.IO — sem dependências de cliente (seguro no middleware Edge). */
export const TV_SOCKET_PATH = "/api/tv/socket.io";

export function requisicaoTvSocket(pathname: string) {
  return pathname === TV_SOCKET_PATH || pathname.startsWith(`${TV_SOCKET_PATH}/`);
}
