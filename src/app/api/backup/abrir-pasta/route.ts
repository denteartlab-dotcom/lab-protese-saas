import { NextResponse } from "next/server";
import { z } from "zod";
import {
  abrirPastaBackupsNoSistema,
  listarArquivosPastaBackup,
} from "@/lib/backup-automatico-servidor";
import { exigirProprietario } from "@/lib/exigir-proprietario";
import { autenticarRestaurarPadrao } from "@/lib/seguranca-restaurar-padrao";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  senha: z.string().optional(),
  palavraChave: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await exigirProprietario();
  if (auth.erro) return auth.erro;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const autenticacao = await autenticarRestaurarPadrao(auth.session!.id, {
    senha: parsed.data.senha,
    palavraChave: parsed.data.palavraChave,
  });
  if (!autenticacao.ok) {
    return NextResponse.json(
      {
        error: autenticacao.error,
        tentativasSenha: autenticacao.tentativasSenha,
        exigePalavraChave: autenticacao.exigePalavraChave,
        palavraChaveCadastrada: autenticacao.palavraChaveCadastrada,
      },
      { status: 403 }
    );
  }

  try {
    const [resultado, arquivos] = await Promise.all([
      abrirPastaBackupsNoSistema(),
      listarArquivosPastaBackup(),
    ]);

    return NextResponse.json({
      ok: true,
      aberto: resultado.aberto,
      pasta: resultado.pasta,
      mensagem: resultado.mensagem ?? null,
      arquivos,
    });
  } catch (erro) {
    console.error("[backup/abrir-pasta]", erro);
    return NextResponse.json(
      { error: "Não foi possível acessar a pasta de backups." },
      { status: 500 }
    );
  }
}
