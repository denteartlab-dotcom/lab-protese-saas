import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";
import { prisma } from "@/lib/db";
import {
  backupPertenceAEmpresa,
  importarBackupEmpresa,
  validarBackupLaboratorio,
} from "@/lib/backup-laboratorio";
import { extrairConteudoZipBackup } from "@/lib/backup-zip";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

async function lerBackupDaRequisicao(request: Request) {
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
      try {
        const { backupJson, uploads } = await extrairConteudoZipBackup(buffer);
        return {
          body: JSON.parse(backupJson) as unknown,
          uploadsZip: uploads,
        };
      } catch (err) {
        if (err instanceof Error && err.message === "ZIP_SEM_BACKUP_JSON") {
          return { erro: "ZIP inválido: falta o arquivo backup.json." as const };
        }
        return { erro: "Arquivo ZIP inválido ou corrompido." as const };
      }
    }

    if (buffer.length > MAX_BYTES_JSON) {
      return { erro: "Arquivo de backup muito grande (máx. 80 MB)." as const };
    }

    try {
      return { body: JSON.parse(buffer.toString("utf8")) as unknown };
    } catch {
      return { erro: "Arquivo JSON inválido." as const };
    }
  }

  const texto = await request.text();
  if (texto.length > MAX_BYTES_JSON) {
    return { erro: "Arquivo de backup muito grande (máx. 80 MB)." as const };
  }

  try {
    return { body: JSON.parse(texto) as unknown };
  } catch {
    return { erro: "Arquivo JSON inválido." as const };
  }
}

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

  const lido = await lerBackupDaRequisicao(request);
  if ("erro" in lido) {
    return NextResponse.json({ error: lido.erro }, { status: 400 });
  }

  const backup = validarBackupLaboratorio(lido.body);
  if (!backup) {
    return NextResponse.json(
      {
        error:
          "Backup incompatível ou corrompido. Use um arquivo exportado nesta versão multi-empresa.",
      },
      { status: 400 }
    );
  }

  if (!backupPertenceAEmpresa(backup, ctx.empresaId)) {
    return NextResponse.json(
      {
        error: `Este backup pertence a outra empresa (${backup.empresaNome || backup.empresaSlug}).`,
      },
      { status: 403 }
    );
  }

  try {
    const excluirDre = request.headers.get("x-backup-excluir-dre") === "1";
    const resultado = await importarBackupEmpresa(prisma, backup, ctx.empresaId, {
      excluirDre,
      uploadsZip: lido.uploadsZip,
      empresaSlug: ctx.empresaSlug,
    });
    return NextResponse.json({
      ok: true,
      exportedAt: backup.exportedAt,
      empresaSlug: backup.empresaSlug,
      contagens: resultado.contagens,
      excluirDre,
      uploadsRestaurados: lido.uploadsZip?.size ?? 0,
    });
  } catch (err) {
    console.error("[backup/import]", err);
    const msg =
      err instanceof Error && err.message === "BACKUP_OUTRA_EMPRESA"
        ? "Este backup não pertence à sua empresa."
        : "Falha ao importar backup. Os dados podem estar inconsistentes — restaure outro backup ou contate o suporte.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
