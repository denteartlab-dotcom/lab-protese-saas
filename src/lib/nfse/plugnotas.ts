import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import { normalizarTipoPessoa } from "@/lib/configuracoes-lab";
import { apenasDigitos } from "@/lib/documento-br";
import { fetchComTimeout } from "@/lib/http-integracao";
import type { NfseAmbiente, NfseConfig } from "@/lib/nfse-config";
import type { ResultadoEmissaoNfse, TomadorNfse } from "@/lib/nfse/types";

function baseUrl(ambiente: NfseAmbiente): string {
  return ambiente === "producao"
    ? "https://api.plugnotas.com.br"
    : "https://api.sandbox.plugnotas.com.br";
}

async function plugnotasFetch<T>(
  config: NfseConfig,
  path: string,
  init?: RequestInit
): Promise<T> {
  const key = config.apiKey.trim();
  if (!key) {
    throw new Error("Informe o token (x-api-key) do PlugNotas em Configurações → Nota Fiscal.");
  }

  const res = await fetchComTimeout(
    `${baseUrl(config.ambiente)}${path}`,
    {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": key,
        ...(init?.headers || {}),
      },
      cache: "no-store",
    },
    { integracao: "nfse" }
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { message?: string }).message ||
      (body as { error?: string }).error ||
      (Array.isArray((body as { errors?: { message?: string }[] }).errors)
        ? (body as { errors: { message?: string }[] }).errors
            .map((e) => e.message)
            .filter(Boolean)
            .join("; ")
        : "") ||
      `Erro PlugNotas (${res.status})`;
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

type ResumoPlugnotas = {
  id?: string;
  idIntegracao?: string;
  situacao?: string;
  status?: string;
  numeroNfse?: string;
  numero?: string;
  codigoVerificacao?: string;
  mensagem?: string;
  pdf?: string;
};

function mapStatus(situacao?: string): string {
  const s = (situacao || "").toUpperCase();
  if (s === "CONCLUIDO" || s === "AUTORIZADO") return "autorizada";
  if (s === "REJEITADO" || s === "DENEGADO" || s === "CANCELADO") return "erro";
  return "processando";
}

function montarPayload(params: {
  config: NfseConfig;
  lab: ConfigLaboratorio;
  tomador: TomadorNfse;
  valor: number;
  descricao: string;
  idIntegracao: string;
}) {
  const { config, lab, tomador, valor, descricao, idIntegracao } = params;
  const cMun = apenasDigitos(lab.codMunicipio || "");
  if (cMun.length !== 7) {
    throw new Error(
      "Código do município (IBGE) inválido. Informe o CEP em Dados do laboratório."
    );
  }

  const docPrest = docPrestador(lab);
  const docToma = apenasDigitos(tomador.cpfCnpj);
  if (docToma.length !== 11 && docToma.length !== 14) {
    throw new Error("Tomador precisa de CPF ou CNPJ válido.");
  }

  const codigoServico =
    config.codigoServicoMunicipal?.trim() ||
    config.codigoServicoNacional.replace(/\D/g, "").replace(/(\d{2})(\d{2})(\d{2})/, "$1.$2.$3") ||
    config.codigoServicoNacional;

  const cepToma = apenasDigitos(tomador.cep || "");
  const cMunToma = apenasDigitos(tomador.codMunicipio || cMun) || cMun;

  return [
    {
      idIntegracao,
      prestador: {
        cpfCnpj: docPrest,
        ...(lab.inscricaoMunicipal?.trim()
          ? { inscricaoMunicipal: lab.inscricaoMunicipal.trim() }
          : {}),
        razaoSocial:
          lab.razaoSocial?.trim() ||
          lab.nomeFantasia?.trim() ||
          lab.nomeLaboratorio?.trim() ||
          lab.responsavel,
      },
      tomador: {
        cpfCnpj: docToma,
        razaoSocial: tomador.nome.trim(),
        ...(tomador.email?.trim() ? { email: tomador.email.trim() } : {}),
        endereco: {
          logradouro: tomador.rua || "Não informado",
          numero: tomador.numero || "S/N",
          ...(tomador.bairro ? { bairro: tomador.bairro } : {}),
          codigoCidade: cMunToma,
          ...(tomador.cidade ? { descricaoCidade: tomador.cidade } : {}),
          estado: (tomador.uf || lab.uf || "").toUpperCase().slice(0, 2) || undefined,
          cep: cepToma.length === 8 ? cepToma : undefined,
        },
      },
      servico: [
        {
          codigo: codigoServico,
          discriminacao: descricao.slice(0, 2000),
          iss: {
            aliquota: config.aliquotaIss,
            retido: false,
          },
          valor: {
            servico: Number(valor.toFixed(2)),
          },
        },
      ],
    },
  ];
}

async function consultarResumo(
  config: NfseConfig,
  cpfCnpj: string,
  idIntegracao: string
): Promise<ResumoPlugnotas | null> {
  try {
    const lista = await plugnotasFetch<ResumoPlugnotas[]>(
      config,
      `/nfse/${encodeURIComponent(cpfCnpj)}/${encodeURIComponent(idIntegracao)}`
    );
    return Array.isArray(lista) ? lista[0] : null;
  } catch {
    return null;
  }
}

export async function emitirNfsePlugnotas(params: {
  config: NfseConfig;
  lab: ConfigLaboratorio;
  tomador: TomadorNfse;
  valor: number;
  descricao: string;
  referencia: string;
}): Promise<ResultadoEmissaoNfse> {
  const docPrest = docPrestador(params.lab);
  const idIntegracao = `lab-${params.referencia}`.slice(0, 50);
  const payload = montarPayload({ ...params, idIntegracao });

  const envio = await plugnotasFetch<
    | { documents?: { id?: string; protocol?: string; idIntegracao?: string }[] }
    | { id?: string; protocol?: string }[]
    | { id?: string; protocol?: string }
  >(params.config, "/nfse", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  let providerId = idIntegracao;
  const doc0 = Array.isArray(envio)
    ? envio[0]
    : (envio as { documents?: { id?: string; protocol?: string }[] }).documents?.[0];
  if (doc0 && typeof doc0 === "object") {
    providerId =
      (doc0 as { id?: string }).id ||
      (doc0 as { protocol?: string }).protocol ||
      idIntegracao;
  }

  await new Promise((r) => setTimeout(r, 3000));

  let resumo = await consultarResumo(params.config, docPrest, idIntegracao);
  if (!resumo?.situacao && providerId !== idIntegracao) {
    try {
      const porId = await plugnotasFetch<ResumoPlugnotas[]>(
        params.config,
        `/nfse/${encodeURIComponent(providerId)}`
      );
      resumo = Array.isArray(porId) ? porId[0] : (porId as unknown as ResumoPlugnotas);
    } catch {
      /* consulta alternativa opcional */
    }
  }

  const situacao = resumo?.situacao || resumo?.status;
  const status = mapStatus(situacao);

  return {
    providerId: resumo?.id || providerId,
    status,
    numeroNfse: resumo?.numeroNfse || resumo?.numero,
    codigoVerificacao: resumo?.codigoVerificacao,
    pdfUrl: resumo?.pdf,
    mensagens: resumo?.mensagem ? [resumo.mensagem] : undefined,
    resposta: resumo ?? envio,
  };
}
