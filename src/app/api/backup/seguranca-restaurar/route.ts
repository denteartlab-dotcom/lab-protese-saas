import { NextResponse } from "next/server";
import { exigirProprietario } from "@/lib/exigir-proprietario";
import {
  exigePalavraChavePorTentativas,
  obterPalavraChaveRestaurar,
  obterTentativasSenhaRestaurar,
  palavraChaveRestaurarCadastrada,
  MAX_TENTATIVAS_SENHA_RESTAURAR,
} from "@/lib/seguranca-restaurar-padrao";

export async function GET() {
  const auth = await exigirProprietario();
  if (auth.erro) return auth.erro;

  const userId = auth.session!.id;
  const tentativas = await obterTentativasSenhaRestaurar(userId);
  const cadastrada = await palavraChaveRestaurarCadastrada();
  const info = await obterPalavraChaveRestaurar();

  return NextResponse.json({
    ehProprietario: true,
    palavraChaveCadastrada: cadastrada,
    referencia: info?.referencia ?? null,
    tentativasSenha: tentativas,
    maxTentativasSenha: MAX_TENTATIVAS_SENHA_RESTAURAR,
    exigePalavraChave: exigePalavraChavePorTentativas(tentativas),
  });
}
