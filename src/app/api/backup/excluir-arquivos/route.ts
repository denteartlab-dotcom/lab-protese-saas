import { NextResponse } from "next/server";
import { z } from "zod";
import {
  excluirArquivosPastaBackupEmpresa,
  listarArquivosPastaBackupEmpresa,
  nomeArquivoBackupValido,
} from "@/lib/backup-automatico-servidor";
import { exigirProprietario } from "@/lib/exigir-proprietario";
import { verificarSenhaProprietario } from "@/lib/seguranca-restaurar-padrao";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  senha: z.string().min(1, "Informe a senha da sua conta."),
  arquivos: z.array(z.string().min(1)).min(1, "Selecione ao menos um arquivo."),
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

  const nomes = parsed.data.arquivos.filter(nomeArquivoBackupValido);
  if (nomes.length === 0) {
    return NextResponse.json(
      { error: "Nenhum arquivo de backup válido foi informado." },
      { status: 400 }
    );
  }

  const { empresaSlug, empresaNome } = auth.session!;

  try {
    const excluidos = await excluirArquivosPastaBackupEmpresa(
      empresaSlug,
      nomes,
      empresaNome
    );
    const arquivos = await listarArquivosPastaBackupEmpresa(empresaSlug, empresaNome);
    return NextResponse.json({ ok: true, excluidos, arquivos });
  } catch (err) {
    console.error("[backup/excluir-arquivos]", err);
    return NextResponse.json(
      { error: "Não foi possível excluir os arquivos selecionados." },
      { status: 500 }
    );
  }
}
