import { NextResponse } from "next/server";
import { z } from "zod";
import { listarArquivosBackupFonte } from "@/lib/backup-arquivos-fonte";
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

  const { empresaId, empresaSlug, empresaNome } = auth.session!;

  try {
    const lista = await listarArquivosBackupFonte({
      empresaId,
      slug: empresaSlug,
      nome: empresaNome,
    });
    return NextResponse.json({
      ok: true,
      aberto: false,
      pasta: lista.pasta,
      origem: lista.origem,
      empresaSlug,
      empresaNome,
      mensagem: null,
      arquivos: lista.arquivos,
    });
  } catch (erro) {
    console.error("[backup/abrir-pasta] listar arquivos", erro);
    return NextResponse.json(
      {
        error:
          "Senha confirmada, mas não foi possível listar os backups no Google Drive.",
      },
      { status: 500 }
    );
  }
}
