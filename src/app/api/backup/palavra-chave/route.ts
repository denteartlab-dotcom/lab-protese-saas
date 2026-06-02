import { NextResponse } from "next/server";
import { z } from "zod";
import { exigirProprietario } from "@/lib/exigir-proprietario";
import {
  cadastrarOuAlterarPalavraChaveRestaurar,
  obterPalavraChaveRestaurar,
  palavraChaveRestaurarCadastrada,
} from "@/lib/seguranca-restaurar-padrao";

const schema = z.object({
  palavraChave: z.string().min(4),
  referencia: z.string().min(1),
  palavraChaveAtual: z.string().optional(),
});

export async function GET() {
  const auth = await exigirProprietario();
  if (auth.erro) return auth.erro;

  const cadastrada = await palavraChaveRestaurarCadastrada();
  const info = await obterPalavraChaveRestaurar();

  return NextResponse.json({
    cadastrada,
    referencia: info?.referencia ?? null,
    atualizadoEm: info?.atualizadoEm ?? null,
  });
}

export async function PUT(request: Request) {
  const auth = await exigirProprietario();
  if (auth.erro) return auth.erro;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Informe a palavra-chave (mín. 4 caracteres) e a referência." },
      { status: 400 }
    );
  }

  try {
    await cadastrarOuAlterarPalavraChaveRestaurar({
      palavraChave: parsed.data.palavraChave,
      referencia: parsed.data.referencia,
      palavraChaveAtual: parsed.data.palavraChaveAtual,
    });
    const info = await obterPalavraChaveRestaurar();
    return NextResponse.json({
      ok: true,
      referencia: info?.referencia ?? parsed.data.referencia,
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Não foi possível salvar a palavra-chave.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
