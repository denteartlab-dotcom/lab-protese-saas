/** Tipos compartilhados para importação Excel assíncrona (issue 012). */

export type ErroImportacaoLinha = {
  linha: number;
  mensagem: string;
};

export type ResultadoImportacaoExcel = {
  ok: number;
  ignorados: number;
  erros: ErroImportacaoLinha[];
};
