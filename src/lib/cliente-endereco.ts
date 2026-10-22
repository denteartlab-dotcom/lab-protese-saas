import { configValueFromObservacoes } from "@/lib/cliente-financeiro";

export const PREFIXO_RUA_CLIENTE = "Rua:";
export const PREFIXO_NUMERO_CLIENTE = "Número:";
export const PREFIXO_NUMERO_CLIENTE_SEM_ACENTO = "Numero:";
export const PREFIXO_BAIRRO_CLIENTE = "Bairro:";
export const PREFIXO_COMPLEMENTO_CLIENTE = "Complemento:";

export const PREFIXOS_ENDERECO_CLIENTE = [
  PREFIXO_RUA_CLIENTE,
  PREFIXO_NUMERO_CLIENTE,
  PREFIXO_NUMERO_CLIENTE_SEM_ACENTO,
  PREFIXO_BAIRRO_CLIENTE,
  PREFIXO_COMPLEMENTO_CLIENTE,
] as const;

export type PartesEnderecoCliente = {
  rua: string;
  numero: string;
  bairro: string;
  complemento: string;
};

function linhaPrefixo(observacoes: string | null | undefined, prefixo: string) {
  return (observacoes || "")
    .split("\n")
    .map((linha) => linha.trim())
    .some((linha) => linha.toLowerCase().startsWith(prefixo.toLowerCase()));
}

export function temEnderecoEstruturadoCliente(observacoes: string | null | undefined) {
  return PREFIXOS_ENDERECO_CLIENTE.some((prefixo) => linhaPrefixo(observacoes, prefixo));
}

function pareceNumeroImovel(valor: string) {
  return /^\d{1,6}[a-zA-Z]?$/.test(valor.trim());
}

/** Separa o texto único gravado em `endereco` nas lacunas do cadastro. */
export function dividirEnderecoLivreCliente(endereco: string | null | undefined): PartesEnderecoCliente {
  const partes = (endereco || "")
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);

  if (partes.length >= 2 && pareceNumeroImovel(partes[0])) {
    return {
      rua: "",
      numero: partes[0],
      bairro: partes[1] || "",
      complemento: partes.slice(2).join(", "),
    };
  }

  return {
    rua: partes[0] || "",
    numero: partes[1] || "",
    bairro: partes[2] || "",
    complemento: partes.slice(3).join(", "),
  };
}

export function partesEnderecoCliente(
  observacoes: string | null | undefined,
  endereco?: string | null
): PartesEnderecoCliente {
  if (temEnderecoEstruturadoCliente(observacoes)) {
    const numero =
      configValueFromObservacoes(observacoes, PREFIXO_NUMERO_CLIENTE) ||
      configValueFromObservacoes(observacoes, PREFIXO_NUMERO_CLIENTE_SEM_ACENTO);
    return {
      rua: configValueFromObservacoes(observacoes, PREFIXO_RUA_CLIENTE),
      numero,
      bairro: configValueFromObservacoes(observacoes, PREFIXO_BAIRRO_CLIENTE),
      complemento: configValueFromObservacoes(observacoes, PREFIXO_COMPLEMENTO_CLIENTE),
    };
  }
  return dividirEnderecoLivreCliente(endereco);
}

export function enderecoCompostoCliente(partes: Partial<PartesEnderecoCliente> | null | undefined) {
  return [partes?.rua, partes?.numero, partes?.bairro, partes?.complemento]
    .map((parte) => (parte || "").trim())
    .filter(Boolean)
    .join(", ");
}

export function mesclarObservacoesComEnderecoCliente(
  observacoes: string | null | undefined,
  partes: Partial<PartesEnderecoCliente>
) {
  const linhas = (observacoes || "")
    .split("\n")
    .map((linha) => linha.trim())
    .filter(
      (linha) =>
        linha &&
        !PREFIXOS_ENDERECO_CLIENTE.some((prefixo) =>
          linha.toLowerCase().startsWith(prefixo.toLowerCase())
        )
    );

  const rua = partes.rua?.trim() || "";
  const numero = partes.numero?.trim() || "";
  const bairro = partes.bairro?.trim() || "";
  const complemento = partes.complemento?.trim() || "";

  if (rua) linhas.push(`${PREFIXO_RUA_CLIENTE} ${rua}`);
  if (numero) linhas.push(`${PREFIXO_NUMERO_CLIENTE} ${numero}`);
  if (bairro) linhas.push(`${PREFIXO_BAIRRO_CLIENTE} ${bairro}`);
  if (complemento) linhas.push(`${PREFIXO_COMPLEMENTO_CLIENTE} ${complemento}`);

  return linhas.join("\n");
}
