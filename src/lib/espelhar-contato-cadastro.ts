export type CampoContatoPrincipal = "email" | "telefoneComercial" | "whatsapp";

export type MapaEspelhoContato = Record<CampoContatoPrincipal, string>;

/** Cliente: dados principais → seção Contato. */
export const ESPELHOS_CONTATO_CLIENTE: MapaEspelhoContato = {
  email: "contatoEmail",
  telefoneComercial: "contatoTelefoneComercial",
  whatsapp: "contatoWhatsapp",
};

/** Fornecedor: dados principais → Contato do Representante. */
export const ESPELHOS_CONTATO_FORNECEDOR: MapaEspelhoContato = {
  email: "representanteEmail",
  telefoneComercial: "representanteTelefoneComercial",
  whatsapp: "representanteWhatsapp",
};

export function aplicarEspelhoContatoCadastro<T extends object>(
  atual: T,
  campo: CampoContatoPrincipal,
  valor: string,
  espelhos: MapaEspelhoContato
): T {
  const destino = espelhos[campo];
  return {
    ...atual,
    [campo]: valor,
    ...(destino ? { [destino]: valor } : {}),
  } as T;
}
