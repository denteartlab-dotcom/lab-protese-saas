export type SuporteMensagemDto = {
  id: string;
  remetenteTipo: "usuario" | "suporte";
  remetenteNome: string;
  texto: string;
  imagemUrl: string | null;
  lidaEm: string | null;
  createdAt: string;
};

export type SuporteConversaResumoDto = {
  empresaId: string;
  empresaNome: string;
  ultimaMensagemEm: string;
  ultimaMensagemTexto: string | null;
  naoLidas: number;
};
