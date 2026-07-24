import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  propagarMudancasTabelaPrecosParaOs,
  type MudancaItemTabelaPrecos,
} from "@/lib/tabela-precos-propagar-os-servidor";
import { z } from "zod";

const mudancaSchema = z.object({
  tipo: z.enum(["servico", "produto", "transporte"]),
  nomeAnterior: z.string().min(1),
  nomeNovo: z.string().min(1),
  valorNovo: z.number().finite(),
  produtoId: z.string().nullish(),
});

const bodySchema = z.object({
  mudancas: z.array(mudancaSchema).min(1).max(500),
});

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }


  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const mudancas: MudancaItemTabelaPrecos[] = body.mudancas.map((m) => ({
    tipo: m.tipo,
    nomeAnterior: m.nomeAnterior.trim(),
    nomeNovo: m.nomeNovo.trim(),
    valorNovo: m.valorNovo,
    produtoId: m.produtoId ?? null,
  }));

  try {
    const resultado = await propagarMudancasTabelaPrecosParaOs(
      ctx.empresaId,
      mudancas
    );
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    console.error("[api/tabela-precos/propagar-os]", err);
    return NextResponse.json(
      { error: "Falha ao propagar alterações para as OS" },
      { status: 500 }
    );
  }
}
