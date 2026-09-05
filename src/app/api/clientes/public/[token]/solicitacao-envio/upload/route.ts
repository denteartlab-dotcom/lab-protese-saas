import { NextResponse } from "next/server";
import { executarSemRls, runWithTenantContext } from "@/lib/db";
import { MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO } from "@/lib/cliente-acompanhamento";
import { buscarClientePublicoPorToken } from "@/lib/tenant-db";
import {
  categoriaAnexoPorMime,
  LIMITE_ARQUIVOS_SOLICITACAO_ENVIO,
  LIMITE_IMAGENS_SOLICITACAO_ENVIO,
  type CategoriaAnexoSolicitacao,
} from "@/lib/solicitacao-envio-types";
import { salvarArquivosUpload } from "@/lib/upload-arquivo-server";

type Params = { params: Promise<{ token: string }> };

function idDeUrlUpload(url: string): string {
  const m = url.match(/\/api\/uploads\/arquivo\/([^/?#]+)/i);
  return m?.[1] || url;
}

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const resultado = await buscarClientePublicoPorToken(token);
  if (!resultado) {
    return NextResponse.json(
      { error: "link_invalido", message: MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO },
      { status: 404 }
    );
  }

  const empresa = await executarSemRls((tx) =>
    tx.empresa.findUnique({
      where: { id: resultado.cliente.empresaId },
      select: { id: true, slug: true },
    })
  );
  if (!empresa?.slug) {
    return NextResponse.json(
      { error: "empresa_invalida", message: "Empresa não encontrada." },
      { status: 404 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "payload_invalido", message: "Formulário inválido." },
      { status: 400 }
    );
  }

  const pacienteNome = String(formData.get("pacienteNome") || "").trim();
  if (!pacienteNome) {
    return NextResponse.json(
      {
        error: "paciente_obrigatorio",
        message: "Informe o nome do paciente antes de enviar anexos.",
      },
      { status: 400 }
    );
  }

  const tipoRaw = String(formData.get("tipo") || "").trim().toLowerCase();
  const tipo: CategoriaAnexoSolicitacao =
    tipoRaw === "arquivo" ? "arquivo" : "imagem";
  const limite =
    tipo === "imagem"
      ? LIMITE_IMAGENS_SOLICITACAO_ENVIO
      : LIMITE_ARQUIVOS_SOLICITACAO_ENVIO;

  const files = formData
    .getAll("files")
    .filter((item): item is File => item instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }
  if (files.length > limite) {
    return NextResponse.json(
      {
        error: "limite_anexos",
        message:
          tipo === "imagem"
            ? `Envie no máximo ${LIMITE_IMAGENS_SOLICITACAO_ENVIO} imagens.`
            : `Envie no máximo ${LIMITE_ARQUIVOS_SOLICITACAO_ENVIO} arquivos.`,
      },
      { status: 400 }
    );
  }

  for (const file of files) {
    const mime = (file.type || "").toLowerCase();
    if (tipo === "imagem" && !mime.startsWith("image/")) {
      return NextResponse.json(
        {
          error: "tipo_invalido",
          message: "Na seção de imagens envie apenas JPEG, PNG ou WebP.",
        },
        { status: 400 }
      );
    }
    if (tipo === "arquivo" && mime.startsWith("image/")) {
      return NextResponse.json(
        {
          error: "tipo_invalido",
          message: "Na seção de arquivos envie PDF (imagens ficam na seção de imagens).",
        },
        { status: 400 }
      );
    }
  }

  try {
    const uploaded = await runWithTenantContext(empresa.id, () =>
      salvarArquivosUpload("os", files, empresa.id, empresa.slug, {
        subpasta: pacienteNome,
      })
    );

    return NextResponse.json(
      uploaded.map((item) => ({
        id: idDeUrlUpload(item.url),
        nome: item.name,
        mimeType: item.type,
        url: item.url,
        tamanho: 0,
        categoria: tipo || categoriaAnexoPorMime(item.type),
      }))
    );
  } catch (err) {
    console.error("[solicitacao-envio/upload]", err);
    const msg = err instanceof Error ? err.message : "Erro ao enviar arquivos.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
