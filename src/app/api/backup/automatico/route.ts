import { access } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  caminhoRelativoPastaBackupEmpresa,
  caminhoRelativoUploadsBackupEmpresa,
} from "@/lib/backup-empresa-pasta";
import { contarUploadsBackupEmpresa } from "@/lib/backup-uploads-espelho";
import { onedriveBackupSyncHabilitado } from "@/lib/backup-onedrive-sync";
import { modoUploadStorage, faltamCredenciaisOneDriveGraph } from "@/lib/upload-arquivo-server";
import {
  onedriveUploadsRemote,
  uploadUsaOneDrive,
} from "@/lib/upload-onedrive-storage";
import { onedriveGraphConfigurado } from "@/lib/onedrive-graph";
import { reagendarBackupAutomaticoEmpresa } from "@/lib/backup-automatico";
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
  type BackupAutomaticoConfig,
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

type MontarStatusOpcoes = {
  /** Config já salva/carregada — evita nova leitura no store. */
  config?: BackupAutomaticoConfig;
  /**
   * Modo rápido para o PUT: não varre pasta de uploads nem lista todos os JSON.
   * Suficiente para refletir ativo/dia/próximo backup na UI.
   */
  leve?: boolean;
};

async function montarStatus(
  empresaId: string,
  slug: string,
  nome: string,
  opcoes?: MontarStatusOpcoes
) {
  const fuso = fusoBackupAutomatico();
  const config =
    opcoes?.config ?? (await carregarConfigBackupAutomatico(empresaId));
  const leve = opcoes?.leve === true;

  if (!leve) {
    try {
      await garantirPastaBackupEmpresa(slug, nome);
    } catch (erro) {
      console.warn("[backup/automatico] pasta local indisponível:", erro);
    }
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
  } else if (config.ultimoArquivo) {
    ultimoArquivoNome = path.basename(config.ultimoArquivo);
  }

  if (!arquivoExiste && !leve) {
    const arquivos = await listarArquivosPastaBackupEmpresa(slug, nome);
    if (arquivos.length > 0) {
      arquivoExiste = true;
      ultimoArquivoNome = arquivos[0].nome;
    }
  }

  let uploadsArquivos = 0;
  if (!leve) {
    try {
      uploadsArquivos = await contarUploadsBackupEmpresa(slug, nome);
    } catch {
      uploadsArquivos = 0;
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
    uploadsArquivos,
    onedriveSyncHabilitado: onedriveBackupSyncHabilitado(),
    uploadStorage: modoUploadStorage(),
    onedriveUploadsAtivo: uploadUsaOneDrive(),
    onedriveUploadsRemote: uploadUsaOneDrive() ? onedriveUploadsRemote() : null,
    onedriveGraphConfigurado: onedriveGraphConfigurado(),
    onedriveFaltandoCredenciais: uploadUsaOneDrive()
      ? []
      : faltamCredenciaisOneDriveGraph(),
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
    const empresaId = auth.session!.empresaId;
    const slug = auth.session!.empresaSlug;
    const nome = auth.session!.empresaNome;
    const config = await salvarConfigBackupAutomatico(empresaId, parsed.data);
    // Só esta empresa — reagendar todas as ativas deixava o botão Salvar lento.
    await reagendarBackupAutomaticoEmpresa(
      { id: empresaId, slug, nome },
      config
    );
    return NextResponse.json(
      await montarStatus(empresaId, slug, nome, { config, leve: true })
    );
  } catch (erro) {
    console.error("[backup/automatico PUT]", erro);
    return NextResponse.json(
      { error: "Não foi possível salvar o agendamento." },
      { status: 500 }
    );
  }
}
