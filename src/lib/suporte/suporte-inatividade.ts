export const SUPORTE_INATIVIDADE_MS = 10 * 60 * 1000;

export function conversaSuporteInativa(ultimaMensagemEm: Date) {
  return Date.now() - ultimaMensagemEm.getTime() > SUPORTE_INATIVIDADE_MS;
}

export function limiteInatividadeSuporte() {
  return new Date(Date.now() - SUPORTE_INATIVIDADE_MS);
}
