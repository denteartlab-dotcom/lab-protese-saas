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
  calcularProximoBackupEm,
  carregarConfigBackupAutomatico,
  formatarDataBackup,
  salvarConfigBackupAutomatico,
} from "@/lib/backup-automatico-config";
import { fusoBackupAutomatico } from "@/lib/backup-automatico-servidor";
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

function hospedagemVercel() {
  return process.env.VERCEL === "1";
}

function formatarProximoBackup(
  config: Awaited<ReturnType<typeof carregarConfigBackupAutomatico>>,
  fuso: string
) {
  if (!config.ativo) return null;

  let proximoEm = config.proximoBackupEm;
  if (!proximoEm) {
    proximoEm = calcularProximoBackupEm(config, fuso);
  }

  const formatado = formatarDataBackup(proximoEm, fuso);
  if (formatado) return formatado;

  if (!proximoEm) return null;
  try {
    return new Date(proximoEm).toLocaleString("pt-BR", {
      timeZone: fuso,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

async function montarStatus() {
  const fuso = fusoBackupAutomatico();
  const config = await carregarConfigBackupAutomatico();

  try {
    await garantirPastaBackup();
  } catch (erro) {
    console.warn("[backup/automatico] pasta local indisponível:", erro);
  }

  const pastaPadrao = process.env.BACKUP_AUTOMATICO_PATH?.trim()
    ? caminhoRelativoPastaBackup()
    : path.dirname(BACKUP_ARQUIVO_PADRAO);

  const padraoNomeArquivo = nomeArquivoBackupAutomatico(new Date(), fuso);
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
    hospedagemVercel: hospedagemVercel(),
    agendadorInternoAtivo: !hospedagemVercel() && servidorBackupHabilitado(),
    pastaPadrao,
    padraoNomeArquivo,
    arquivoPadrao: `${pastaPadrao}/${padraoNomeArquivo}`,
    ultimoArquivoNome,
    arquivoExiste,
    fusoHorario: fuso,
    ultimoBackupFormatado: formatarDataBackup(config.ultimoBackupEm, fuso),
    proximoBackupFormatado: formatarProximoBackup(config, fuso),
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
