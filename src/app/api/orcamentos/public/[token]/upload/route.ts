import { NextResponse } from "next/server";
import { executarSemRls, runWithTenantContext } from "@/lib/db";
import { mapOrcamento } from "@/lib/orcamentos-db";
import { linkOrcamentoAtivo } from "@/lib/orcamentos-types";
import { armazenamentoGaleriaEsgotado } from "@/lib/uploads-armazenamento";
import { calcularArmazenamentoGaleria } from "@/lib/uploads-armazenamento-server";
import { salvarArquivosUpload } from "@/lib/upload-arquivo-server";
import {
  CODIGO_ARMAZENAMENTO_CHEIO,
  ehErroEspacoArmazenamento,
  MENSAGEM_ARMAZENAMENTO_CHEIO,
} from "@/lib/uploads-erro-armazenamento";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const row = await executarSemRls((tx) =>
    tx.orcamento.findFirst({
      where: { token, linkAtivo: true },
      include: { empresa: { select: { id: true, slug: true, nome: true } } },
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
        message: "Este pedido não aceita mais anexos de foto.",
      },
      { status: 409 }
    );
  }

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }
    if (files.length > 1) {
      return NextResponse.json(
        { error: "Envie apenas uma imagem por vez." },
        { status: 400 }
      );
    }
    if (!files[0].type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Selecione um arquivo de imagem." },
        { status: 400 }
      );
    }

    const resumo = await runWithTenantContext(row.empresa.id, () =>
      calcularArmazenamentoGaleria(
        row.empresa.id,
        row.empresa.slug,
        row.empresa.nome
      )
    );
    const novosBytes = files.reduce((s, f) => s + f.size, 0);
    const limiteBytes = resumo.limiteBytes || 0;
    const semEspaco =
      armazenamentoGaleriaEsgotado(resumo.bytesLivres) ||
      novosBytes > resumo.bytesLivres ||
      (limiteBytes > 0 && resumo.bytesUsados + novosBytes > limiteBytes);

    if (semEspaco) {
      return NextResponse.json(
        {
          error: MENSAGEM_ARMAZENAMENTO_CHEIO,
          code: CODIGO_ARMAZENAMENTO_CHEIO,
        },
        { status: 413 }
      );
    }

    const uploaded = await runWithTenantContext(row.empresa.id, () =>
      salvarArquivosUpload("produtos", files, row.empresa.id, row.empresa.slug)
    );
    return NextResponse.json(uploaded);
  } catch (err) {
    console.error("POST /api/orcamentos/public/[token]/upload", err);
    const msg = err instanceof Error ? err.message : "Erro ao enviar arquivos.";
    if (ehErroEspacoArmazenamento(err) || ehErroEspacoArmazenamento(msg)) {
      return NextResponse.json(
        {
          error: MENSAGEM_ARMAZENAMENTO_CHEIO,
          code: CODIGO_ARMAZENAMENTO_CHEIO,
        },
        { status: 507 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
