import { NextResponse } from "next/server";
import { executarSemRls } from "@/lib/db";
import { mapOrcamento } from "@/lib/orcamentos-db";
import { linkOrcamentoAtivo, type ItemOrcamento } from "@/lib/orcamentos-types";
import {
  lerArquivoEPreencherItens,
  validarArquivoOrcamento,
} from "@/lib/orcamento-leitura-arquivo";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const row = await executarSemRls((tx) =>
    tx.orcamento.findFirst({
      where: { token, linkAtivo: true },
    })
  );

  if (!row) {
    return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
  }

  const atual = mapOrcamento(row);
  if (!linkOrcamentoAtivo(atual.status, atual.linkAtivo)) {
    return NextResponse.json(
      { error: "link_expirado", message: "Este link não aceita mais uploads." },
      { status: 410 }
    );
  }

  if (atual.status !== "aguardando_resposta") {
    return NextResponse.json(
      {
        error: "ja_respondido",
        message: "Este pedido não aceita mais leitura de arquivo.",
      },
      { status: 409 }
    );
  }

  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file") ?? formData.get("files");
    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }
    const file = fileEntry;

    const erroArquivo = validarArquivoOrcamento(file);
    if (erroArquivo) {
      return NextResponse.json({ error: erroArquivo }, { status: 400 });
    }

    let itensBase: ItemOrcamento[] = atual.itens;
    const itensRaw = formData.get("itens");
    if (typeof itensRaw === "string" && itensRaw.trim()) {
      try {
        const parsed = JSON.parse(itensRaw) as ItemOrcamento[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          itensBase = parsed;
        }
      } catch {
        /* mantém itens do banco */
      }
    }

    const resultado = await lerArquivoEPreencherItens(file, itensBase);
    return NextResponse.json({
      itens: resultado.itens,
      matches: resultado.matches,
      naoEncontrados: resultado.naoEncontrados,
      fonte: resultado.fonte,
      mensagem: `Preenchemos ${resultado.matches.length} item(ns) com base no arquivo.`,
    });
  } catch (err) {
    console.error("POST /api/orcamentos/public/[token]/parse", err);
    const msg =
      err instanceof Error ? err.message : "Erro ao ler o arquivo do orçamento.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
