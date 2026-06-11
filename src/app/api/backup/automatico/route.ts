import { access } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { reagendarBackupAutomatico } from "@/lib/backup-automatico";
import {
  BACKUP_ARQUIVO_PADRAO,
  caminhoRelativoPastaBackup,
  garantirPastaBackup,
  listarArquivosPastaBackup,
  nomeArquivoBackupAutomatico,
} from "@/lib/backup-automatico-servidor";
import {
  carregarConfigBackupAutomatico,
  formatarDataBackup,
  salvarConfigBackupAutomatico,
} from "@/lib/backup-automatico-config";
import { exigirProprietario } from "@/lib/exigir-proprietario";

export const dynamic = "force-dynamic";

const schemaSalvar = z.object({
  ativo: z.boolean(),
  diaSemana: z.number().int().min(0).max(6).nullable(),
  hora: z.number().int().min(0).max(23),
  minuto: z.number().int().min(0).max(59),
});

function servidorBackupHabilitado() {
  const flag = process.env.BACKUP_AUTOMATICO_ENABLED;
  return flag !== "0" && flag !== "false";
}

async function montarStatus() {
  const config = await carregarConfigBackupAutomatico();
  await garantirPastaBackup();

  const pastaPadrao = process.env.BACKUP_AUTOMATICO_PATH?.trim()
    ? caminhoRelativoPastaBackup()
    : path.dirname(BACKUP_ARQUIVO_PADRAO);

  const padraoNomeArquivo = nomeArquivoBackupAutomatico();
  let arquivoExiste = false;
  let ultimoArquivoNome: string | null = null;

  if (config.ultimoArquivo) {
    try {
      await access(config.ultimoArquivo);
      arquivoExiste = true;
      ultimoArquivoNome = path.basename(config.ultimoArquivo);
    } catch {
      arquivoExiste = false;
    }
  }

  if (!arquivoExiste) {
    const arquivos = await listarArquivosPastaBackup();
    if (arquivos.length > 0) {
      arquivoExiste = true;
      ultimoArquivoNome = arquivos[0].nome;
    }
  }

  return {
    config,
    servidorHabilitado: servidorBackupHabilitado(),
    pastaPadrao,
    padraoNomeArquivo,
    arquivoPadrao: `${pastaPadrao}/${padraoNomeArquivo}`,
    ultimoArquivoNome,
    arquivoExiste,
    ultimoBackupFormatado: formatarDataBackup(config.ultimoBackupEm),
    proximoBackupFormatado: formatarDataBackup(config.proximoBackupEm),
  };
}

export async function GET() {
  const auth = await exigirProprietario();
  if (auth.erro) return auth.erro;

  try {
    return NextResponse.json(await montarStatus());
  } catch (erro) {
    console.error("[backup/automatico GET]", erro);
    return NextResponse.json(
      { error: "Não foi possível carregar o agendamento." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await exigirProprietario();
  if (auth.erro) return auth.erro;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const parsed = schemaSalvar.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  try {
    await salvarConfigBackupAutomatico(parsed.data);
    await reagendarBackupAutomatico();
    return NextResponse.json(await montarStatus());
  } catch (erro) {
    console.error("[backup/automatico PUT]", erro);
    return NextResponse.json(
      { error: "Não foi possível salvar o agendamento." },
      { status: 500 }
    );
  }
}
