import { z } from "zod";

export const MENSAGEM_NOME_CLIENTE_OBRIGATORIO =
  "Informe o nome do cliente (mínimo 2 caracteres).";

export const schemaNomeCliente = z
  .string()
  .trim()
  .min(2, MENSAGEM_NOME_CLIENTE_OBRIGATORIO);

export function validarNomeCliente(
  nome: string
): { ok: true; nome: string } | { ok: false; message: string } {
  const parsed = schemaNomeCliente.safeParse(nome);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || MENSAGEM_NOME_CLIENTE_OBRIGATORIO,
    };
  }
  return { ok: true, nome: parsed.data };
}

/** Lançamento/OS com cliente cadastrado e nome preenchido. */
export function temVinculoCliente(reg: {
  clienteId?: string | null;
  cliente?: { id?: string | null; nome?: string | null } | null;
}): boolean {
  const id = reg.cliente?.id || reg.clienteId;
  const nome = reg.cliente?.nome?.trim();
  return Boolean(id && nome);
}
