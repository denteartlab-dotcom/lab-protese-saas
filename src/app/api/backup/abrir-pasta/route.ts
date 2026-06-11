import { NextResponse } from "next/server";
import { z } from "zod";
import {
  abrirPastaBackupsNoSistema,
  listarArquivosPastaBackup,
  pastaBackupResolvida,
  type ArquivoPastaBackup,
} from "@/lib/backup-automatico-servidor";
import { exigirProprietario } from "@/lib/exigir-proprietario";
import { verificarSenhaProprietario } from "@/lib/seguranca-restaurar-padrao";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  senha: z.string().min(1, "Informe a senha da sua conta."),
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
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados inválidos." },
      { status: 400 }
    );
  }

  const senhaOk = await verificarSenhaProprietario(
    auth.session!.id,
    parsed.data.senha.trim()
  );
  if (!senhaOk) {
    return NextResponse.json(
      {
        error:
          "Senha incorreta. Use a mesma senha que você utiliza para entrar no sistema.",
      },
      { status: 403 }
    );
  }

  const pasta = pastaBackupResolvida();
  let arquivos: ArquivoPastaBackup[] = [];
  let aberto = false;
  let mensagem: string | null = null;

  try {
    arquivos = await listarArquivosPastaBackup();
  } catch (erro) {
    console.error("[backup/abrir-pasta] listar arquivos", erro);
    mensagem =
      "Senha confirmada, mas não foi possível listar os arquivos da pasta no servidor.";
  }

  try {
    const resultado = await abrirPastaBackupsNoSistema();
    aberto = resultado.aberto;
    if (!aberto && resultado.mensagem) {
      mensagem = resultado.mensagem;
    }
  } catch (erro) {
    console.error("[backup/abrir-pasta] abrir pasta", erro);
    if (!mensagem) {
      mensagem =
        "Senha confirmada. A pasta não pôde ser aberta no servidor; confira o caminho abaixo.";
    }
  }

  return NextResponse.json({
    ok: true,
    aberto,
    pasta,
    mensagem,
    arquivos,
  });
}
