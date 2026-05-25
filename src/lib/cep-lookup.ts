import { formatCepInput } from "@/lib/documento-br";

export type EnderecoViaCep = {
  cep: string;
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
  /** Código IBGE do município (7 dígitos) — usado na NFS-e. */
  codMunicipio: string;
};

export function somenteDigitosCep(cep: string): string {
  return cep.replace(/\D/g, "");
}

export async function buscarEnderecoPorCep(
  cepInformado: string
): Promise<EnderecoViaCep | null> {
  const cep = somenteDigitosCep(cepInformado);
  if (cep.length !== 8) return null;

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    cache: "no-store",
  });
  const data = (await response.json()) as {
    erro?: boolean;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
    ibge?: string;
  };

  if (data.erro) return null;

  return {
    cep: formatCepInput(cep),
    rua: data.logradouro || "",
    bairro: data.bairro || "",
    cidade: data.localidade || "",
    uf: (data.uf || "").toUpperCase().slice(0, 2),
    codMunicipio: data.ibge ? String(data.ibge) : "",
  };
}
