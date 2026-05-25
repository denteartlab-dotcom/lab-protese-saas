export type TomadorNfse = {
  nome: string;
  cpfCnpj: string;
  email?: string | null;
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  codMunicipio?: string | null;
};

export type ResultadoEmissaoNfse = {
  providerId: string;
  status: string;
  numeroNfse?: string;
  codigoVerificacao?: string;
  pdfUrl?: string;
  mensagens?: string[];
  resposta: unknown;
};
