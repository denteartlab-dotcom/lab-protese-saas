import type { SuporteMensagemDto } from "@/lib/suporte-chat";

export const SUPORTE_SOCKET_EVENTS = {
  joinEmpresa: "suporte:join-empresa",
  joinMaster: "suporte:join-master",
  novaMensagem: "suporte:nova-mensagem",
  conversasAtualizadas: "suporte:conversas-atualizadas",
  naoLidasEmpresa: "suporte:nao-lidas-empresa",
  statusAdmin: "suporte:status-admin",
  conversaExpirada: "suporte:conversa-expirada",
} as const;

export function salaSuporteEmpresa(empresaId: string) {
  return `suporte:empresa:${empresaId}`;
}

export function salaSuporteMaster() {
  return "suporte:master";
}

export type SuporteSocketNovaMensagemPayload = {
  empresaId: string;
  mensagem: SuporteMensagemDto;
};

export type SuporteSocketNaoLidasEmpresaPayload = {
  naoLidas: number;
};

export type SuporteSocketStatusAdminPayload = {
  online: boolean;
};

export type SuporteSocketConversaExpiradaPayload = {
  empresaId: string;
};
