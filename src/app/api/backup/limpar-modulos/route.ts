import { NextResponse } from "next/server";
import { z } from "zod";
import { exigirProprietario } from "@/lib/exigir-proprietario";
import { prisma } from "@/lib/db";
import {
  idsModulosValidos,
  limparModulosSelecionados,
} from "@/lib/limpar-modulos-laboratorio";
import { autenticarRestaurarPadrao } from "@/lib/seguranca-restaurar-padrao";

const bodySchema = z.object({
  modulos: z.array(z.string()).min(1),
  confirmacao: z.literal("apagar-modulos-selecionados"),
  senha: z.string().optional(),
  palavraChave: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await exigirProprietario();
  if (auth.erro) return auth.erro;

  const headerConfirmar =
    request.headers.get("x-backup-confirmar") === "apagar-modulos-selecionados";
  if (!headerConfirmar) {
    return NextResponse.json(
      {
        error: "Confirme a operação na tela antes de continuar.",
      },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Selecione ao menos um módulo e confirme a operação." },
      { status: 400 }
    );
  }

  const ids = idsModulosValidos(parsed.data.modulos);
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Nenhum módulo válido selecionado." },
      { status: 400 }
    );
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
    const resultado = await limparModulosSelecionados(prisma, ids, {
      usuarioIdManter: auth.session!.id,
    });
    return NextResponse.json({
      ok: true,
      apagados: resultado.apagados,
      localStorageKeys: resultado.localStorageKeys,
      localStoragePrefixos: resultado.localStoragePrefixos,
      localStorageSet: resultado.localStorageSet,
      modulos: resultado.modulos,
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Não foi possível limpar os módulos.";
    console.error("[backup/limpar-modulos]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
