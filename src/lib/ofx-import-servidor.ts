import {
  listarContasBancariasServidor,
} from "@/lib/conta-bancaria-servidor";
import type { ContaBancaria } from "@/lib/conta-bancaria";
import {
  contaOfxCombina,
  parseOfxArquivo,
  type DadosContaOfx,
  type OfxParseResult,
} from "@/lib/extrato-ofx";
import { z } from "zod";

export const schemaPayloadImportOfx = z.object({
  texto: z.string().min(1),
  nomeArquivo: z.string().optional(),
});

export type ResultadoImportOfxJob = {
  parseResult: OfxParseResult;
  contaEncontrada: ContaBancaria | null;
  contaNaoCadastrada: boolean;
  dadosConta: DadosContaOfx;
  contasCadastradas: ContaBancaria[];
};

export async function executarImportOfxServidor(
  empresaId: string,
  texto: string
): Promise<ResultadoImportOfxJob> {
  const resultado = parseOfxArquivo(texto);
  const contas = await listarContasBancariasServidor(empresaId);
  const contaEncontrada =
    contas.find((c) => contaOfxCombina(c, resultado.dadosConta)) ?? null;
  const numeroOfx = resultado.dadosConta.numeroConta.trim();

  return {
    parseResult: resultado,
    contaEncontrada,
    contaNaoCadastrada: Boolean(numeroOfx && !contaEncontrada),
    dadosConta: resultado.dadosConta,
    contasCadastradas: contas.filter((c) => !c.excluida),
  };
}
