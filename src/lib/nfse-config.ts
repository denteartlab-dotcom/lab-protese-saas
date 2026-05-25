export const NFSE_CONFIG_KEY = "nfseIntegracao";

export type NfseAmbiente = "homologacao" | "producao";

/** plugnotas = TecnoSpeed (recomendado); nuvemfiscal = descontinuação prevista em 2026 */
export type NfseProvedor = "plugnotas" | "nuvemfiscal";

export type NfseConfig = {
  provedor: NfseProvedor;
  /** PlugNotas — header x-api-key (token da software house / conta). */
  apiKey: string;
  /** Nuvem Fiscal — OAuth (legado). */
  clientId: string;
  clientSecret: string;
  ambiente: NfseAmbiente;
  /** Código de tributação nacional do serviço (ex.: 04.12.01 → 041201). */
  codigoServicoNacional: string;
  /** Código do serviço na prefeitura (item da lista municipal). */
  codigoServicoMunicipal: string;
  /** Alíquota ISS em % (ex.: 2.5). */
  aliquotaIss: number;
  /** Discriminação padrão do serviço. */
  descricaoServicoPadrao: string;
};

export const NFSE_CONFIG_PADRAO: NfseConfig = {
  provedor: "plugnotas",
  apiKey: "",
  clientId: "",
  clientSecret: "",
  ambiente: "homologacao",
  codigoServicoNacional: "041201",
  codigoServicoMunicipal: "",
  aliquotaIss: 2,
  descricaoServicoPadrao: "Serviços de prótese dentária",
};

export function nfseConfigurada(config: NfseConfig): boolean {
  if (config.provedor === "plugnotas") {
    return Boolean(config.apiKey?.trim());
  }
  return Boolean(config.clientId?.trim() && config.clientSecret?.trim());
}
