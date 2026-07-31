import { NextResponse } from "next/server";
import { executarSemRls } from "@/lib/db";
import { mapOrcamento } from "@/lib/orcamentos-db";
import { linkOrcamentoAtivo } from "@/lib/orcamentos-types";
import { normalizarSlugPastaUploads } from "@/lib/uploads-armazenamento-server";
import {
  contentDispositionUpload,
  lerArquivoDiscoPorCaminhoRelativo,
  normalizarUrlUploadParaApi,
  obterConteudoArquivoUpload,
} from "@/lib/upload-arquivo-server";

type Params = { params: Promise<{ token: string }> };

/**
 * Serve anexo de orçamento público quando a imagem aponta para disco/API.
 * Query: ?u=/api/uploads/disco/... ou /uploads/... ou /api/uploads/arquivo/{id}
 */
export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  const u = new URL(request.url).searchParams.get("u")?.trim() || "";
  if (!u) {
    return NextResponse.json({ error: "Arquivo não informado" }, { status: 400 });
  }

  const row = await executarSemRls((tx) =>
    tx.orcamento.findFirst({
      where: { token, linkAtivo: true },
      include: { empresa: { select: { id: true, slug: true } } },
    })
  );
  if (!row) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const atual = mapOrcamento(row);
  if (!linkOrcamentoAtivo(atual.status, atual.linkAtivo)) {
    return NextResponse.json({ error: "Link expirado" }, { status: 410 });
  }

  const urlNorm = normalizarUrlUploadParaApi(u);
  const urlsPermitidas = new Set(
    atual.itens
      .map((item) => (item.imagemUrl ? normalizarUrlUploadParaApi(item.imagemUrl) : ""))
      .filter(Boolean)
  );
  // Também aceita a URL original legada /uploads/ se estiver no item
  for (const item of atual.itens) {
    if (item.imagemUrl?.trim()) urlsPermitidas.add(item.imagemUrl.trim());
  }

  if (!urlsPermitidas.has(u) && !urlsPermitidas.has(urlNorm)) {
    return NextResponse.json({ error: "Arquivo não autorizado" }, { status: 403 });
  }

  // Banco / OneDrive
  const matchDb = urlNorm.match(/^\/api\/uploads\/arquivo\/([^/?]+)/);
  if (matchDb?.[1]) {
    let conteudo;
    try {
      conteudo = await obterConteudoArquivoUpload(matchDb[1]);
    } catch (err) {
      console.error("[orcamento/arquivo] leitura", err);
      return NextResponse.json(
        { error: "Não foi possível ler o arquivo no armazenamento." },
        { status: 502 }
      );
    }
    if (!conteudo || conteudo.empresaId !== row.empresa.id) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(conteudo.bytes), {
      headers: {
        "Content-Type": conteudo.mimeType,
        "Content-Length": String(conteudo.bytes.length),
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": contentDispositionUpload(conteudo.mimeType, conteudo.nome),
      },
    });
  }

  // Disco: /api/uploads/disco/{slug}/...
  const matchDisco = urlNorm.match(/^\/api\/uploads\/disco\/(.+)$/);
  if (!matchDisco?.[1]) {
    return NextResponse.json({ error: "Formato de URL não suportado" }, { status: 400 });
  }

  const partes = matchDisco[1].split("/").filter(Boolean);
  if (partes.length < 2) {
    return NextResponse.json({ error: "Caminho inválido" }, { status: 400 });
  }

  const slugUrl = normalizarSlugPastaUploads(partes[0] || "");
  const slugEmpresa = normalizarSlugPastaUploads(row.empresa.slug);
  if (slugUrl !== slugEmpresa) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  try {
    const arquivo = await lerArquivoDiscoPorCaminhoRelativo(
      slugEmpresa,
      partes.slice(1).join("/")
    );
    if (!arquivo) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(arquivo.bytes), {
      headers: {
        "Content-Type": arquivo.mimeType,
        "Content-Length": String(arquivo.bytes.length),
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": contentDispositionUpload(arquivo.mimeType, arquivo.nome),
      },
    });
  } catch {
    return NextResponse.json({ error: "Caminho inválido" }, { status: 400 });
  }
}
