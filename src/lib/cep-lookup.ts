import { formatCepInput } from "@/lib/documento-br";

export type EnderecoViaCep = {
  cep: string;
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
  complemento: string;
  /** Código IBGE do município (7 dígitos) — usado na NFS-e. */
  codMunicipio: string;
};

type PayloadCep = {
  erro?: boolean | string;
  cep?: string;
  code?: string;
  logradouro?: string;
  street?: string;
  address?: string;
  bairro?: string;
  neighborhood?: string;
  district?: string;
  localidade?: string;
  city?: string;
  uf?: string;
  state?: string;
  complemento?: string;
  ibge?: string | { city?: string };
};

export function somenteDigitosCep(cep: string): string {
  return cep.replace(/\D/g, "");
}

function texto(...valores: unknown[]) {
  for (const valor of valores) {
    const limpo = String(valor ?? "").trim();
    if (limpo && limpo.toLowerCase() !== "null" && limpo.toLowerCase() !== "undefined") {
      return limpo;
    }
  }
  return "";
}

function payloadInvalido(data: PayloadCep | null | undefined) {
  if (!data || typeof data !== "object") return true;
  return data.erro === true || data.erro === "true" || data.erro === "1";
}

/** Converte a resposta de ViaCEP, OpenCEP, BrasilAPI ou Apicep no endereço do formulário. */
export function enderecoDePayloadCep(
  data: PayloadCep | null | undefined,
  cepInformado = ""
): EnderecoViaCep | null {
  if (payloadInvalido(data)) return null;
  const rua = texto(data?.logradouro, data?.street, data?.address);
  const bairro = texto(data?.bairro, data?.neighborhood, data?.district);
  const cidade = texto(data?.localidade, data?.city);
  const uf = texto(data?.uf, data?.state).toUpperCase().slice(0, 2);
  const ibge = typeof data?.ibge === "object" ? data.ibge?.city : data?.ibge;
  const codMunicipio = texto(ibge);
  if (!rua && !bairro && !cidade && !uf) return null;
  const cep = somenteDigitosCep(texto(data?.cep, data?.code, cepInformado));
  return {
    cep: cep.length === 8 ? formatCepInput(cep) : texto(data?.cep, data?.code),
    rua,
    bairro,
    cidade,
    uf,
    complemento: texto(data?.complemento),
    codMunicipio,
  };
}

/** A rua vem da primeira fonte que a tiver; cidade e bairro completam o que faltar. */
export function mesclarEnderecosCep(fontes: Array<EnderecoViaCep | null | undefined>): EnderecoViaCep | null {
  const validos = fontes.filter((item): item is EnderecoViaCep => Boolean(item));
  if (validos.length === 0) return null;
  const pegar = (campo: keyof EnderecoViaCep) =>
    validos.map((item) => item[campo]).find((valor) => valor.trim()) || "";
  return {
    cep: pegar("cep"),
    rua: pegar("rua"),
    bairro: pegar("bairro"),
    cidade: pegar("cidade"),
    uf: pegar("uf"),
    complemento: pegar("complemento"),
    codMunicipio: pegar("codMunicipio"),
  };
}

async function lerJson(url: string): Promise<PayloadCep | null> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), 4000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controle.signal });
    if (!response.ok) return null;
    return (await response.json()) as PayloadCep;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function buscarEnderecoPorCep(
  cepInformado: string
): Promise<EnderecoViaCep | null> {
  const cep = somenteDigitosCep(cepInformado);
  if (cep.length !== 8) return null;
  const cepFormatado = `${cep.slice(0, 5)}-${cep.slice(5)}`;

  const [viaCep, openCep, brasilApi, apicep] = await Promise.all([
    lerJson(`https://viacep.com.br/ws/${cep}/json/`),
    lerJson(`https://opencep.com/v1/${cep}`),
    lerJson(`https://brasilapi.com.br/api/cep/v2/${cep}`),
    lerJson(`https://cdn.apicep.com/file/apicep/${cepFormatado}.json`),
  ]);

  return mesclarEnderecosCep([
    enderecoDePayloadCep(viaCep, cep),
    enderecoDePayloadCep(openCep, cep),
    enderecoDePayloadCep(brasilApi, cep),
    enderecoDePayloadCep(apicep, cep),
  ]);
}
