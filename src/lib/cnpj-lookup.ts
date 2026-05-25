import { formatCepInput } from "@/lib/documento-br";

export type DadosCnpjConsulta = {
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  telefoneComercial: string;
  whatsapp: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  codMunicipio: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
};

function telefoneBrasilApi(ddd?: string | null, numero?: string | null) {
  const raw = `${ddd || ""}${numero || ""}`.replace(/\D/g, "");
  if (raw.length < 10) return "";
  const dddFmt = raw.length > 9 ? raw.slice(0, 2) : "";
  const tel = raw.length > 9 ? raw.slice(2) : raw;
  if (tel.length === 9) {
    return dddFmt ? `(${dddFmt}) ${tel.slice(0, 5)}-${tel.slice(5)}` : tel;
  }
  if (tel.length === 8) {
    return dddFmt ? `(${dddFmt}) ${tel.slice(0, 4)}-${tel.slice(4)}` : tel;
  }
  return raw;
}

function telefoneReceitaWs(telefone?: string | null) {
  if (!telefone) return "";
  const digits = telefone.replace(/\D/g, "");
  if (digits.length < 10) return telefone.trim();
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return telefone.trim();
}

export function mapearBrasilApiCnpj(data: Record<string, unknown>): Partial<DadosCnpjConsulta> {
  const dddTel1 = String(data.ddd_telefone_1 || "");
  const telCombinado =
    dddTel1.length >= 10
      ? telefoneBrasilApi(null, dddTel1)
      : telefoneBrasilApi(dddTel1, String(data.telefone_1 || ""));

  const dddTel2 = String(data.ddd_telefone_2 || "");
  const whatsapp =
    dddTel2.length >= 10
      ? telefoneBrasilApi(null, dddTel2)
      : telefoneBrasilApi(dddTel2, String(data.telefone_2 || ""));

  const ie =
    data.inscricao_estadual != null && String(data.inscricao_estadual).trim() !== ""
      ? String(data.inscricao_estadual)
      : "";

  return {
    razaoSocial: String(data.razao_social || ""),
    nomeFantasia: String(data.nome_fantasia || ""),
    email: String(data.email || ""),
    telefoneComercial: telCombinado,
    whatsapp,
    inscricaoEstadual: ie,
    cep: formatCepInput(String(data.cep || "")),
    rua: String(data.logradouro || ""),
    numero: data.numero != null ? String(data.numero) : "",
    complemento: String(data.complemento || ""),
    bairro: String(data.bairro || ""),
    cidade: String(data.municipio || ""),
    uf: String(data.uf || ""),
    codMunicipio: data.codigo_municipio_ibge
      ? String(data.codigo_municipio_ibge)
      : data.codigo_municipio
        ? String(data.codigo_municipio)
        : "",
  };
}

export function mapearReceitaWsCnpj(data: Record<string, unknown>): Partial<DadosCnpjConsulta> {
  const tel = telefoneReceitaWs(String(data.telefone || ""));
  return {
    razaoSocial: String(data.nome || ""),
    nomeFantasia: String(data.fantasia || ""),
    email: String(data.email || ""),
    telefoneComercial: tel,
    whatsapp: tel,
    cep: formatCepInput(String(data.cep || "")),
    rua: String(data.logradouro || ""),
    numero: data.numero != null ? String(data.numero) : "",
    complemento: String(data.complemento || ""),
    bairro: String(data.bairro || ""),
    cidade: String(data.municipio || ""),
    uf: String(data.uf || ""),
  };
}

export function mesclarDadosCnpj(
  ...fontes: Array<Partial<DadosCnpjConsulta> | undefined>
): DadosCnpjConsulta {
  const out: DadosCnpjConsulta = {
    razaoSocial: "",
    nomeFantasia: "",
    email: "",
    telefoneComercial: "",
    whatsapp: "",
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    codMunicipio: "",
    inscricaoEstadual: "",
    inscricaoMunicipal: "",
  };

  for (const fonte of fontes) {
    if (!fonte) continue;
    (Object.keys(out) as Array<keyof DadosCnpjConsulta>).forEach((key) => {
      const valor = fonte[key];
      if (valor != null && String(valor).trim() !== "") {
        out[key] = String(valor);
      }
    });
  }

  return out;
}
