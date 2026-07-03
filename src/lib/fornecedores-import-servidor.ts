import { randomUUID } from "crypto";
import {
  type FornecedorImportPayload,
  type FornecedorImportadoServidor,
  type ResultadoImportacaoFornecedores,
} from "@/lib/fornecedores-import-schema";
import type { ErroImportacaoLinha } from "@/lib/importacao-excel-schema";
import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";

export type { FornecedorImportPayload, ResultadoImportacaoFornecedores };
export {
  fornecedorImportSchema,
  schemaImportacaoFornecedores,
} from "@/lib/fornecedores-import-schema";

const STORAGE_KEY = "labProteseFornecedores";
const TAMANHO_LOTE = 50;

function texto(valor?: string | null) {
  return (valor ?? "").trim();
}

function textoOpcional(valor?: string | null) {
  const t = texto(valor);
  return t || undefined;
}

function normalizarNome(nome: string) {
  return nome.trim().toLowerCase();
}

function payloadParaFornecedor(linha: FornecedorImportPayload): FornecedorImportadoServidor {
  const whatsapp = texto(linha.whatsapp);
  const celular = texto(linha.celular) || whatsapp;

  return {
    id: randomUUID(),
    nome: texto(linha.nome),
    contato: texto(linha.contato),
    celular,
    whatsapp: whatsapp || celular,
    email: texto(linha.email),
    cpf: textoOpcional(linha.cpf),
    cnpj: textoOpcional(linha.cnpj),
    categoria: textoOpcional(linha.categoria),
    telefoneResidencial: textoOpcional(linha.telefoneResidencial),
    telefoneComercial: textoOpcional(linha.telefoneComercial),
    cep: textoOpcional(linha.cep),
    rua: textoOpcional(linha.rua),
    numero: textoOpcional(linha.numero),
    cidade: textoOpcional(linha.cidade),
    uf: textoOpcional(linha.uf),
    bairro: textoOpcional(linha.bairro),
    complemento: textoOpcional(linha.complemento),
    representanteTelefoneComercial: textoOpcional(linha.representanteTelefoneComercial),
    representanteWhatsapp: textoOpcional(linha.representanteWhatsapp),
    representanteEmail: textoOpcional(linha.representanteEmail),
  };
}

export async function executarImportacaoFornecedores(
  empresaId: string,
  fornecedores: FornecedorImportPayload[],
  opcoes?: { onProgresso?: (progresso: number) => void | Promise<void> }
): Promise<ResultadoImportacaoFornecedores> {
  const existentes =
    (await lerJsonStoreTenant<FornecedorImportadoServidor[]>(empresaId, STORAGE_KEY)) ?? [];
  const nomes = new Set(existentes.map((f) => normalizarNome(f.nome)));

  let ok = 0;
  let ignorados = 0;
  const erros: ErroImportacaoLinha[] = [];
  const novos: FornecedorImportadoServidor[] = [];
  const total = fornecedores.length;

  for (let i = 0; i < fornecedores.length; i += TAMANHO_LOTE) {
    const lote = fornecedores.slice(i, i + TAMANHO_LOTE);

    for (let offset = 0; offset < lote.length; offset += 1) {
      const linhaNum = i + offset + 1;
      const linha = lote[offset];
      const nome = texto(linha.nome);
      if (nome.length < 2) {
        ignorados += 1;
        erros.push({
          linha: linhaNum,
          mensagem: "Nome inválido (mínimo 2 caracteres).",
        });
        continue;
      }

      const chave = normalizarNome(nome);
      if (nomes.has(chave)) {
        ignorados += 1;
        erros.push({
          linha: linhaNum,
          mensagem: `Fornecedor "${nome}" já cadastrado.`,
        });
        continue;
      }

      const fornecedor = payloadParaFornecedor({ ...linha, nome });
      novos.push(fornecedor);
      nomes.add(chave);
      ok += 1;
    }

    if (opcoes?.onProgresso && total > 0) {
      const processados = Math.min(total, i + lote.length);
      const progresso = Math.min(100, Math.round((processados / total) * 100));
      await opcoes.onProgresso(progresso);
    }
  }

  if (novos.length > 0) {
    await salvarJsonStoreTenant(empresaId, STORAGE_KEY, [...existentes, ...novos]);
  }

  return { ok, ignorados, erros };
}
