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

/** Rótulo para lançamentos/OS sem cliente vinculado (não é cadastro). */
export const ROTULO_SEM_VINCULO_CLIENTE = "Sem vínculo de cliente";
