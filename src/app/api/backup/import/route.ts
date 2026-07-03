import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";
import { salvarStagingImportBackup } from "@/lib/backup-temp-servidor";
import { criarJob, executarJobEmBackground } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES_JSON = 80 * 1024 * 1024;
const MAX_BYTES_ZIP = 512 * 1024 * 1024;

function ehArquivoZip(nome: string, tipo: string) {
  const lower = nome.toLowerCase();
  return (
    lower.endsWith(".zip") ||
    tipo === "application/zip" ||
    tipo === "application/x-zip-compressed"
  );
}

async function lerArquivoDaRequisicao(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const campo = formData.get("arquivo");
    if (!(campo instanceof File)) {
      return { erro: "Selecione um arquivo de backup (.zip ou .json)." as const };
    }

    const buffer = Buffer.from(await campo.arrayBuffer());
    if (ehArquivoZip(campo.name, campo.type)) {
      if (buffer.length > MAX_BYTES_ZIP) {
        return { erro: "Arquivo ZIP muito grande (máx. 512 MB)." as const };
      }
      return { buffer, ext: "zip" as const };
    }

    if (buffer.length > MAX_BYTES_JSON) {
      return { erro: "Arquivo de backup muito grande (máx. 80 MB)." as const };
    }

    try {
      JSON.parse(buffer.toString("utf8"));
      return { buffer, ext: "json" as const };
    } catch {
      return { erro: "Arquivo JSON inválido." as const };
    }
  }

  const texto = await request.text();
  if (texto.length > MAX_BYTES_JSON) {
    return { erro: "Arquivo de backup muito grande (máx. 80 MB)." as const };
  }

  try {
    JSON.parse(texto);
    return { buffer: Buffer.from(texto, "utf8"), ext: "json" as const };
  } catch {
    return { erro: "Arquivo JSON inválido." as const };
  }
}

/** Salva arquivo em staging e enfileira restore — resposta imediata (issue 026). */
export async function POST(request: Request) {
  const auth = await exigirGestorUsuarios();
  if (auth.erro) return auth.erro;

  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const confirmar = request.headers.get("x-backup-confirmar") === "substituir-tudo";
  if (!confirmar) {
    return NextResponse.json(
      {
        error:
          "Confirme a substituição dos dados (marque a opção na tela antes de importar).",
      },
      { status: 400 }
    );
  }

  const lido = await lerArquivoDaRequisicao(request);
  if ("erro" in lido) {
    return NextResponse.json({ error: lido.erro }, { status: 400 });
  }

  const excluirDre = request.headers.get("x-backup-excluir-dre") === "1";
  const stagingId = randomUUID();

  try {
    await salvarStagingImportBackup(ctx.empresaId, stagingId, lido.buffer, lido.ext);
    const job = await criarJob(ctx.empresaId, "backup_import", {
      stagingId,
      excluirDre,
      empresaSlug: ctx.empresaSlug,
    });
    executarJobEmBackground(job.id, ctx.empresaId);

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
    });
  } catch (err) {
    console.error("[backup/import POST]", err);
    return NextResponse.json(
      { error: "Não foi possível iniciar a restauração." },
      { status: 500 }
    );
  }
}
