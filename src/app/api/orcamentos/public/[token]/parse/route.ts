import { NextResponse } from "next/server";
import { executarSemRls } from "@/lib/db";
import { mapOrcamento } from "@/lib/orcamentos-db";
import { linkOrcamentoAtivo, type ItemOrcamento } from "@/lib/orcamentos-types";
import {
  lerArquivoEPreencherItens,
  lerPayloadOrcamento,
  mensagemResultadoLeitura,
  validarArquivoOrcamento,
} from "@/lib/orcamento-leitura-arquivo";

type Params = { params: Promise<{ token: string }> };

function arquivoDoFormData(entry: FormDataEntryValue | null): File | null {
  if (!entry || typeof entry === "string") return null;
  if (typeof File !== "undefined" && entry instanceof File) return entry;
  if (typeof Blob !== "undefined" && entry instanceof Blob) {
    const nome =
      "name" in entry && typeof (entry as { name?: unknown }).name === "string"
        ? String((entry as { name: string }).name)
        : "arquivo";
    return new File([entry], nome, {
      type: entry.type || "application/octet-stream",
    });
  }
  return null;
}

function parseItensCampo(raw: unknown, fallback: ItemOrcamento[]): ItemOrcamento[] {
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as ItemOrcamento[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      /* fallback */
    }
  }
  if (Array.isArray(raw) && raw.length > 0) {
    return raw as ItemOrcamento[];
  }
  return fallback;
}

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
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        itens?: ItemOrcamento[];
        texto?: string;
        mimeType?: string;
        base64?: string;
        nomeArquivo?: string;
      };
      const itensBase = parseItensCampo(body.itens, atual.itens);
      const resultado = await lerPayloadOrcamento({
        itens: itensBase,
        texto: body.texto,
        mimeType: body.mimeType,
        base64: body.base64,
        nomeArquivo: body.nomeArquivo,
      });
      return NextResponse.json({
        itens: resultado.itens,
        matches: resultado.matches,
        naoEncontrados: resultado.naoEncontrados,
        fonte: resultado.fonte,
        acrescentados: resultado.acrescentados,
        atualizados: resultado.atualizados,
        mensagem: mensagemResultadoLeitura(resultado),
      });
    }

    const formData = await request.formData();
    const file = arquivoDoFormData(
      formData.get("file") ?? formData.get("files")
    );
    const textoExtraido =
      typeof formData.get("texto") === "string"
        ? String(formData.get("texto"))
        : "";
    const itensBase = parseItensCampo(formData.get("itens"), atual.itens);

    if (!file && !textoExtraido.trim()) {
      return NextResponse.json(
        { error: "Nenhum arquivo ou texto enviado" },
        { status: 400 }
      );
    }

    if (file) {
      const erroArquivo = validarArquivoOrcamento(file);
      if (erroArquivo) {
        return NextResponse.json({ error: erroArquivo }, { status: 400 });
      }
    }

    const resultado = file
      ? await lerArquivoEPreencherItens(file, itensBase, textoExtraido)
      : await lerPayloadOrcamento({
          itens: itensBase,
          texto: textoExtraido,
          mimeType: "text/plain",
        });

    return NextResponse.json({
      itens: resultado.itens,
      matches: resultado.matches,
      naoEncontrados: resultado.naoEncontrados,
      fonte: resultado.fonte,
      acrescentados: resultado.acrescentados,
      atualizados: resultado.atualizados,
      mensagem: mensagemResultadoLeitura(resultado),
    });
  } catch (err) {
    console.error("POST /api/orcamentos/public/[token]/parse", err);
    const msg =
      err instanceof Error ? err.message : "Erro ao ler o arquivo do orçamento.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
