export const DISPARO_SOCKET_EVENTS = {
  subscribe: "disparo:subscribe",
  conexao: "disparo:conexao",
  qr: "disparo:qr",
  progresso: "disparo:progresso",
  contato: "disparo:contato",
  campanha: "disparo:campanha",
} as const;

export type DisparoConexaoPayload = {
  conectado: boolean;
  numero: string | null;
  ultimaConexao: string | null;
  qr: string | null;
};

export type DisparoProgressoPayload = {
  campaignId: string;
  status: string;
  total: number;
  enviadas: number;
  pendentes: number;
  falhas: number;
  percentual: number;
  tempoRestanteSegundos: number;
  intervaloSegundos: number;
};

export type DisparoContatoPayload = {
  campaignId: string;
  contactId: string;
  nome: string;
  telefone: string;
  status: string;
  tentativas: number;
  erro: string | null;
  enviadoEm: string | null;
};

export function salaDisparoEmpresa(empresaId: string) {
  return `disparo:empresa:${empresaId}`;
}
