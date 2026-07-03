import { gerarTokenAcompanhamentoCliente } from "@/lib/cliente-acompanhamento";
import { schemaNomeCliente } from "@/lib/cliente-validacao";
import {
  type ClienteImportPayload,
  type ResultadoImportacaoClientes,
} from "@/lib/clientes-import-schema";
import { prisma } from "@/lib/db";
import type { ErroImportacaoLinha } from "@/lib/importacao-excel-schema";

export type { ClienteImportPayload, ResultadoImportacaoClientes };
export { clienteImportSchema, schemaImportacaoClientes } from "@/lib/clientes-import-schema";

const TAMANHO_LOTE = 50;

function textoOpcional(valor?: string | null) {
  const t = valor?.trim();
  return t || null;
}

export async function executarImportacaoClientes(
  empresaId: string,
  clientes: ClienteImportPayload[],
  opcoes?: { onProgresso?: (progresso: number) => void | Promise<void> }
): Promise<ResultadoImportacaoClientes> {
  let ok = 0;
  let ignorados = 0;
  const erros: ErroImportacaoLinha[] = [];
  const total = clientes.length;

  for (let inicio = 0; inicio < clientes.length; inicio += TAMANHO_LOTE) {
    const lote = clientes.slice(inicio, inicio + TAMANHO_LOTE);
    const criacoes: Parameters<typeof prisma.cliente.create>[0][] = [];

    for (let offset = 0; offset < lote.length; offset += 1) {
      const linhaNum = inicio + offset + 1;
      const cliente = lote[offset];
      const parsedNome = schemaNomeCliente.safeParse(cliente.nome);
      if (!parsedNome.success) {
        ignorados += 1;
        erros.push({
          linha: linhaNum,
          mensagem:
            parsedNome.error.issues[0]?.message || "Nome inválido (mínimo 2 caracteres).",
        });
        continue;
      }

      criacoes.push({
        data: {
          empresaId,
          nome: parsedNome.data,
          razaoSocial: textoOpcional(cliente.razaoSocial),
          cnpjCpf: textoOpcional(cliente.cnpjCpf),
          cro: textoOpcional(cliente.cro),
          telefone: textoOpcional(cliente.telefone),
          celular: textoOpcional(cliente.celular),
          email: textoOpcional(cliente.email),
          endereco: textoOpcional(cliente.endereco),
          cidade: textoOpcional(cliente.cidade),
          uf: textoOpcional(cliente.uf),
          cep: textoOpcional(cliente.cep),
          observacoes: textoOpcional(cliente.observacoes),
          tokenAcompanhamento: gerarTokenAcompanhamentoCliente(),
        },
      });
    }

    if (criacoes.length > 0) {
      await prisma.$transaction(criacoes.map((data) => prisma.cliente.create(data)));
      ok += criacoes.length;
    }

    if (opcoes?.onProgresso && total > 0) {
      const processados = Math.min(total, inicio + lote.length);
      const progresso = Math.min(100, Math.round((processados / total) * 100));
      await opcoes.onProgresso(progresso);
    }
  }

  return { ok, importados: ok, ignorados, erros };
}
