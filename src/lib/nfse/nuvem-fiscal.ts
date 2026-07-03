import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import { normalizarTipoPessoa } from "@/lib/configuracoes-lab";
import { apenasDigitos } from "@/lib/documento-br";
import { fetchComTimeout } from "@/lib/http-integracao";
import type { NfseConfig } from "@/lib/nfse-config";
import type { ResultadoEmissaoNfse, TomadorNfse } from "@/lib/nfse/types";

export type { TomadorNfse, ResultadoEmissaoNfse };

const AUTH_URL = "https://auth.nuvemfiscal.com.br/oauth/token";
const API_URL = "https://api.nuvemfiscal.com.br";

type TokenCache = { token: string; expiraEm: number };
let cacheToken: TokenCache | null = null;

async function obterToken(config: NfseConfig): Promise<string> {
  const agora = Date.now();
  if (cacheToken && cacheToken.expiraEm > agora + 60_000) {
    return cacheToken.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId.trim(),
    client_secret: config.clientSecret.trim(),
    scope: "empresa nfse cep",
  });

  const res = await fetchComTimeout(
    AUTH_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    },
    { integracao: "nfse" }
  );

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || "Falha ao autenticar na Nuvem Fiscal. Verifique Client ID e Secret."
    );
  }

  cacheToken = {
    token: data.access_token,
    expiraEm: agora + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

async function nfseFetch<T>(
  config: NfseConfig,
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = await obterToken(config);
  const res = await fetchComTimeout(
    `${API_URL}${path}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
      cache: "no-store",
    },
    { integracao: "nfse" }
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const erros = (body as { error?: { message?: string } }).error?.message;
    const lista = (body as { errors?: { message?: string }[] }).errors;
    const msg =
      erros ||
      lista?.map((e) => e.message).filter(Boolean).join("; ") ||
      `Erro Nuvem Fiscal (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

function docPrestador(lab: ConfigLaboratorio): string {
  const ehFisica = normalizarTipoPessoa(lab.tipoPessoa) === "Física";
  const doc = apenasDigitos(ehFisica ? lab.cpf : lab.cnpj);
  if (doc.length !== 11 && doc.length !== 14) {
    throw new Error("Cadastre CPF ou CNPJ válido do laboratório em Dados do laboratório.");
  }
  return doc;
}

function montarPayloadNfse(params: {
  config: NfseConfig;
  lab: ConfigLaboratorio;
  tomador: TomadorNfse;
  valor: number;
  descricao: string;
  referencia: string;
}) {
  const { config, lab, tomador, valor, descricao, referencia } = params;
  const cMun = apenasDigitos(lab.codMunicipio || "");
  if (cMun.length !== 7) {
    throw new Error(
      "Código do município (IBGE) inválido. Informe o CEP em Dados do laboratório para preencher automaticamente."
    );
  }

  const docPrest = docPrestador(lab);
  const docToma = apenasDigitos(tomador.cpfCnpj);
  if (docToma.length !== 11 && docToma.length !== 14) {
    throw new Error("Tomador precisa de CPF ou CNPJ válido.");
  }

  const cepPrest = apenasDigitos(lab.cep);
  const cepToma = apenasDigitos(tomador.cep || "");

  return {
    ambiente: config.ambiente,
    referencia,
    infDPS: {
      dhEmi: new Date().toISOString(),
      prest: {
        ...(docPrest.length === 14 ? { CNPJ: docPrest } : { CPF: docPrest }),
        ...(lab.inscricaoMunicipal?.trim()
          ? { IM: lab.inscricaoMunicipal.trim() }
          : {}),
        xNome:
          lab.razaoSocial?.trim() ||
          lab.nomeFantasia?.trim() ||
          lab.nomeLaboratorio?.trim() ||
          lab.responsavel,
        end: {
          endNac: {
            cMun,
            CEP: cepPrest.length === 8 ? cepPrest : undefined,
          },
          xLgr: lab.rua || undefined,
          nro: lab.numero || "S/N",
          xBairro: lab.bairro || undefined,
        },
      },
      toma: {
        ...(docToma.length === 14 ? { CNPJ: docToma } : { CPF: docToma }),
        xNome: tomador.nome.trim(),
        email: tomador.email?.trim() || undefined,
        end: {
          endNac: {
            cMun: apenasDigitos(tomador.codMunicipio || cMun) || cMun,
            CEP: cepToma.length === 8 ? cepToma : undefined,
          },
          xLgr: tomador.rua || undefined,
          nro: tomador.numero || "S/N",
          xBairro: tomador.bairro || undefined,
        },
      },
      serv: {
        locPrest: { cLocPrestacao: cMun },
        cServ: {
          xDescServ: descricao.slice(0, 2000),
          cTribNac: config.codigoServicoNacional.replace(/\D/g, "").slice(0, 6),
          ...(config.codigoServicoMunicipal?.trim()
            ? { cTribMun: config.codigoServicoMunicipal.trim() }
            : {}),
        },
        vServPrest: {
          vServ: Number(valor.toFixed(2)),
        },
        trib: {
          tribMun: {
            tribISSQN: 1,
            pAliq: config.aliquotaIss,
          },
        },
      },
    },
  };
}

export async function emitirNfseNuvemFiscal(params: {
  config: NfseConfig;
  lab: ConfigLaboratorio;
  tomador: TomadorNfse;
  valor: number;
  descricao: string;
  referencia: string;
}): Promise<ResultadoEmissaoNfse> {
  const payload = montarPayloadNfse(params);
  const criado = await nfseFetch<{
    id: string;
    status: string;
    numero?: string;
    codigo_verificacao?: string;
    url_pdf?: string;
    mensagens?: { descricao?: string }[];
  }>(params.config, "/nfse", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  let atual = criado;
  if (criado.status === "processando" && criado.id) {
    await new Promise((r) => setTimeout(r, 2500));
    atual = await nfseFetch<typeof criado>(
      params.config,
      `/nfse/${encodeURIComponent(criado.id)}`
    );
  }

  const pdfUrl = atual.url_pdf
    ? atual.url_pdf
    : atual.id
      ? `${API_URL}/nfse/${encodeURIComponent(atual.id)}/pdf`
      : undefined;

  return {
    providerId: atual.id,
    status: atual.status,
    numeroNfse: atual.numero,
    codigoVerificacao: atual.codigo_verificacao,
    pdfUrl,
    mensagens: atual.mensagens?.map((m) => m.descricao).filter(Boolean) as string[],
    resposta: atual,
  };
}

export async function consultarMetadadosMunicipio(
  config: NfseConfig,
  codigoIbge: string
) {
  const cod = apenasDigitos(codigoIbge);
  if (cod.length !== 7) return null;
  try {
    return await nfseFetch<unknown>(
      config,
      `/nfse/cidades/${encodeURIComponent(cod)}`
    );
  } catch {
    return null;
  }
}
