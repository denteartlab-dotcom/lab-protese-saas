import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";
import { prisma } from "@/lib/db";
import {
  lerArquivoBackupPastaEmpresa,
  nomeArquivoBackupValido,
} from "@/lib/backup-automatico-servidor";
import {
  backupPertenceAEmpresa,
  importarBackupEmpresa,
  validarBackupLaboratorio,
} from "@/lib/backup-laboratorio";
import { mapaUploadsDaPastaBackupEmpresa } from "@/lib/backup-uploads-espelho";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  arquivo: z.string().min(1),
  excluirDre: z.boolean().optional(),
});

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados inválidos." },
      { status: 400 }
    );
  }

  if (!nomeArquivoBackupValido(parsed.data.arquivo)) {
    return NextResponse.json({ error: "Arquivo de backup inválido." }, { status: 400 });
  }

  const { empresaSlug, empresaNome } = ctx;

  let texto: string;
  try {
    texto = await lerArquivoBackupPastaEmpresa(
      empresaSlug,
      parsed.data.arquivo,
      empresaNome
    );
  } catch {
    return NextResponse.json(
      { error: "Arquivo de backup não encontrado na pasta automática." },
      { status: 404 }
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(texto);
  } catch {
    return NextResponse.json({ error: "Arquivo JSON inválido." }, { status: 400 });
  }

  const backup = validarBackupLaboratorio(payload);
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
    const uploadsZip = await mapaUploadsDaPastaBackupEmpresa(empresaSlug, empresaNome);
    const resultado = await importarBackupEmpresa(prisma, backup, ctx.empresaId, {
      excluirDre: parsed.data.excluirDre,
      uploadsZip,
      empresaSlug,
    });
    return NextResponse.json({
      ok: true,
      arquivo: parsed.data.arquivo,
      exportedAt: backup.exportedAt,
      empresaSlug: backup.empresaSlug,
      contagens: resultado.contagens,
      excluirDre: Boolean(parsed.data.excluirDre),
      uploadsRestaurados: uploadsZip.size,
    });
  } catch (err) {
    console.error("[backup/import-pasta]", err);
    const msg =
      err instanceof Error && err.message === "BACKUP_OUTRA_EMPRESA"
        ? "Este backup não pertence à sua empresa."
        : "Falha ao importar backup. Os dados podem estar inconsistentes — restaure outro backup ou contate o suporte.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
