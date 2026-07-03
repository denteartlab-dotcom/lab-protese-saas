import { z } from "zod";

export const TIPOS_CONTEXTO_CADASTRO = ["colaborador", "fornecedor"] as const;
export type TipoContextoCadastro = (typeof TIPOS_CONTEXTO_CADASTRO)[number];

export function tipoContextoCadastroValido(valor: string): valor is TipoContextoCadastro {
  return (TIPOS_CONTEXTO_CADASTRO as readonly string[]).includes(valor);
}

export const schemaQueryContextoCadastro = z.object({
  tipo: z.enum(TIPOS_CONTEXTO_CADASTRO),
});
