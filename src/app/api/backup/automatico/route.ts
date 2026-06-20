import { access } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { caminhoRelativoPastaBackupEmpresa, caminhoRelativoUploadsBackupEmpresa } from "@/lib/backup-empresa-pasta";
import { reagendarBackupAutomatico } from "@/lib/backup-automatico";
import {
  fusoBackupAutomatico,
  garantirPastaBackupEmpresa,
  listarArquivosPastaBackupEmpresa,
  nomeArquivoBackupAutomatico,
} from "@/lib/backup-automatico-servidor";
import {
  calcularProximoBackupEm,
  carregarConfigBackupAutomatico,
  formatarDataBackup,
  formatarHorarioFixoBackupAutomatico,
  salvarConfigBackupAutomatico,
} from "@/lib/backup-automatico-config";
import {
  caminhoDriveEmpresa,
  statusGoogleDriveBackup,
  textoStatusUploadDrive,
} from "@/lib/backup-google-drive";
import { exigirProprietario } from "@/lib/exigir-proprietario";

export const dynamic = "force-dynamic";

const schemaSalvar = z.object({
  ativo: z.boolean(),
  diaSemana: z.number().int().min(0).max(6).nullable(),
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

async function montarStatus(empresaId: string, slug: string, nome: string) {
  const fuso = fusoBackupAutomatico();
  const config = await carregarConfigBackupAutomatico(empresaId);

  try {
    await garantirPastaBackupEmpresa(slug, nome);
  } catch (erro) {
    console.warn("[backup/automatico] pasta local indisponível:", erro);
  }

  const pastaRelativa = caminhoRelativoPastaBackupEmpresa(slug, nome);
  const padraoNomeArquivo = nomeArquivoBackupAutomatico(new Date(), fuso);
  let arquivoExiste = false;
  let ultimoArquivoNome: string | null = null;

  const pastaNome = pastaRelativa.split("/").pop() ?? slug;
  if (
    config.ultimoArquivo?.includes(path.sep + pastaNome + path.sep) ||
    config.ultimoArquivo?.includes(`/${pastaNome}/`)
  ) {
    try {
      await access(config.ultimoArquivo);
      arquivoExiste = true;
      ultimoArquivoNome = path.basename(config.ultimoArquivo);
    } catch {
      arquivoExiste = false;
    }
  }

  if (!arquivoExiste) {
    const arquivos = await listarArquivosPastaBackupEmpresa(slug, nome);
    if (arquivos.length > 0) {
      arquivoExiste = true;
      ultimoArquivoNome = arquivos[0].nome;
    }
  }

  return {
    config,
    empresaSlug: slug,
    empresaNome: nome,
    servidorHabilitado: servidorBackupHabilitado(),
    hospedagemVercel: hospedagemVercel(),
    agendadorInternoAtivo: !hospedagemVercel() && servidorBackupHabilitado(),
    pastaPadrao: pastaRelativa,
    pastaUploads: caminhoRelativoUploadsBackupEmpresa(slug, nome),
    horarioFixo: formatarHorarioFixoBackupAutomatico(),
    padraoNomeArquivo,
    arquivoPadrao: `${pastaRelativa}/${padraoNomeArquivo}`,
    ultimoArquivoNome,
    arquivoExiste,
    fusoHorario: fuso,
    ultimoBackupFormatado: formatarDataBackup(config.ultimoBackupEm, fuso),
    proximoBackupFormatado: formatarProximoBackup(config, fuso),
    googleDrive: {
      ...statusGoogleDriveBackup(),
      statusUpload: textoStatusUploadDrive(config, fuso),
      pastaEmpresa: config.pastaDriveNome ?? null,
      caminhoEmpresa: caminhoDriveEmpresa(slug, nome),
    },
  };
}

export async function GET() {
  const auth = await exigirProprietario();
  if (auth.erro) return auth.erro;

  try {
    return NextResponse.json(
      await montarStatus(
        auth.session!.empresaId,
        auth.session!.empresaSlug,
        auth.session!.empresaNome
      )
    );
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
    await salvarConfigBackupAutomatico(auth.session!.empresaId, parsed.data);
    await reagendarBackupAutomatico();
    return NextResponse.json(
      await montarStatus(
        auth.session!.empresaId,
        auth.session!.empresaSlug,
        auth.session!.empresaNome
      )
    );
  } catch (erro) {
    console.error("[backup/automatico PUT]", erro);
    return NextResponse.json(
      { error: "Não foi possível salvar o agendamento." },
      { status: 500 }
    );
  }
}
