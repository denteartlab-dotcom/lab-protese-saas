import { z } from "zod";
import { fusoBackupAutomatico } from "@/lib/backup-automatico-servidor";
import {
  lerJsonStoreTenant,
  salvarJsonStoreTenant,
} from "@/lib/json-store-tenant";

export const BACKUP_AUTOMATICO_CONFIG_KEY = "labProteseBackupAutomatico";
export const FUSO_BACKUP_PADRAO = "America/Sao_Paulo";

export type BackupAutomaticoConfig = {
  ativo: boolean;
  diaSemana: number | null;
  hora: number;
  minuto: number;
  ultimoBackupEm: string | null;
  proximoBackupEm: string | null;
  ultimoArquivo: string | null;
  ultimoUploadDriveEm: string | null;
  ultimoUploadDriveArquivo: string | null;
  ultimoUploadDriveErro: string | null;
  pastaDriveId: string | null;
  pastaDriveNome: string | null;
};

export const CONFIG_BACKUP_AUTOMATICO_PADRAO: BackupAutomaticoConfig = {
  ativo: true,
  diaSemana: null,
  hora: 0,
  minuto: 0,
  ultimoBackupEm: null,
  proximoBackupEm: null,
  ultimoArquivo: null,
  ultimoUploadDriveEm: null,
  ultimoUploadDriveArquivo: null,
  ultimoUploadDriveErro: null,
  pastaDriveId: null,
  pastaDriveNome: null,
};

const schemaConfig = z.object({
  ativo: z.boolean(),
  diaSemana: z.number().int().min(0).max(6).nullable(),
  hora: z.number().int().min(0).max(23),
  minuto: z.number().int().min(0).max(59),
  ultimoBackupEm: z.string().nullable().optional(),
  proximoBackupEm: z.string().nullable().optional(),
  ultimoArquivo: z.string().nullable().optional(),
  ultimoUploadDriveEm: z.string().nullable().optional(),
  ultimoUploadDriveArquivo: z.string().nullable().optional(),
  ultimoUploadDriveErro: z.string().nullable().optional(),
  pastaDriveId: z.string().nullable().optional(),
  pastaDriveNome: z.string().nullable().optional(),
});

function partesDataHora(data: Date, fuso: string) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(data);

  const ler = (tipo: Intl.DateTimeFormatPartTypes) => {
    const bruto = partes.find((parte) => parte.type === tipo)?.value ?? "0";
    const numero = parseInt(bruto, 10);
    return Number.isFinite(numero) ? numero : 0;
  };

  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    weekday: "short",
  }).format(data);

  const mapaDia: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const hora = ler("hour") % 24;

  return {
    diaSemana: mapaDia[weekday] ?? 0,
    hora,
    minuto: ler("minute"),
    segundo: ler("second"),
  };
}

function fusoEfetivoBackup(fuso?: string) {
  return fuso?.trim() || fusoBackupAutomatico() || FUSO_BACKUP_PADRAO;
}

export function msAteProximoAgendamento(
  config: Pick<BackupAutomaticoConfig, "diaSemana" | "hora" | "minuto">,
  fuso = FUSO_BACKUP_PADRAO,
  aPartirDe = Date.now()
) {
  const agora = aPartirDe;
  let alvo = agora + 1000;
  const limite = agora + 8 * 24 * 60 * 60 * 1000;

  while (alvo < limite) {
    const { diaSemana, hora, minuto, segundo } = partesDataHora(new Date(alvo), fuso);
    const diaOk = config.diaSemana === null || config.diaSemana === diaSemana;
    const horaOk =
      hora === config.hora && minuto === config.minuto && segundo === 0;

    if (diaOk && horaOk) {
      return alvo - agora;
    }

    const pertoDoHorario =
      (config.diaSemana === null || config.diaSemana === diaSemana) &&
      (hora === config.hora - 1 ||
        hora === config.hora ||
        (hora === 23 && config.hora === 0));

    alvo += pertoDoHorario ? 1000 : 60_000;
  }

  return 24 * 60 * 60 * 1000;
}

export function calcularProximoBackupEm(
  config: Pick<BackupAutomaticoConfig, "diaSemana" | "hora" | "minuto" | "ativo">,
  fuso = FUSO_BACKUP_PADRAO,
  aPartirDe = Date.now()
): string | null {
  if (!config.ativo) return null;
  const ms = msAteProximoAgendamento(config, fuso, aPartirDe);
  return new Date(aPartirDe + ms).toISOString();
}

export function normalizarConfigBackupAutomatico(
  bruto: unknown
): BackupAutomaticoConfig {
  const parsed = schemaConfig.safeParse(bruto);
  if (!parsed.success) return { ...CONFIG_BACKUP_AUTOMATICO_PADRAO };

  const base = {
    ...CONFIG_BACKUP_AUTOMATICO_PADRAO,
    ...parsed.data,
    ultimoBackupEm: parsed.data.ultimoBackupEm ?? null,
    proximoBackupEm: parsed.data.proximoBackupEm ?? null,
    ultimoArquivo: parsed.data.ultimoArquivo ?? null,
    ultimoUploadDriveEm: parsed.data.ultimoUploadDriveEm ?? null,
    ultimoUploadDriveArquivo: parsed.data.ultimoUploadDriveArquivo ?? null,
    ultimoUploadDriveErro: parsed.data.ultimoUploadDriveErro ?? null,
    pastaDriveId: parsed.data.pastaDriveId ?? null,
    pastaDriveNome: parsed.data.pastaDriveNome ?? null,
  };

  base.proximoBackupEm = calcularProximoBackupEm(base, fusoEfetivoBackup());
  return base;
}

export async function sincronizarRegistroUltimoBackup(
  empresaId: string,
  config: BackupAutomaticoConfig
): Promise<BackupAutomaticoConfig> {
  if (!config.ultimoBackupEm && !config.ultimoArquivo) return config;
  if (!config.ultimoArquivo) return config;

  try {
    const { access } = await import("fs/promises");
    await access(config.ultimoArquivo);
    return config;
  } catch {
    const limpo: BackupAutomaticoConfig = {
      ...config,
      ultimoBackupEm: null,
      ultimoArquivo: null,
    };
    await salvarJsonStoreTenant(empresaId, BACKUP_AUTOMATICO_CONFIG_KEY, limpo);
    return limpo;
  }
}

export async function carregarConfigBackupAutomatico(
  empresaId: string
): Promise<BackupAutomaticoConfig> {
  const remoto = await lerJsonStoreTenant<unknown>(
    empresaId,
    BACKUP_AUTOMATICO_CONFIG_KEY
  );
  const normalizado = normalizarConfigBackupAutomatico(remoto);
  return sincronizarRegistroUltimoBackup(empresaId, normalizado);
}

export async function salvarConfigBackupAutomatico(
  empresaId: string,
  entrada: Pick<BackupAutomaticoConfig, "ativo" | "diaSemana" | "hora" | "minuto">
): Promise<BackupAutomaticoConfig> {
  const atual = await carregarConfigBackupAutomatico(empresaId);
  const proximo: BackupAutomaticoConfig = {
    ...atual,
    ativo: entrada.ativo,
    diaSemana: entrada.diaSemana,
    hora: entrada.hora,
    minuto: entrada.minuto,
    proximoBackupEm: calcularProximoBackupEm(
      {
        ativo: entrada.ativo,
        diaSemana: entrada.diaSemana,
        hora: entrada.hora,
        minuto: entrada.minuto,
      },
      fusoEfetivoBackup()
    ),
  };
  await salvarJsonStoreTenant(empresaId, BACKUP_AUTOMATICO_CONFIG_KEY, proximo);
  return proximo;
}

export async function registrarExecucaoBackupAutomatico(
  empresaId: string,
  exportedAt: string,
  arquivo: string
): Promise<BackupAutomaticoConfig> {
  const atual = await carregarConfigBackupAutomatico(empresaId);
  const proximo: BackupAutomaticoConfig = {
    ...atual,
    ultimoBackupEm: exportedAt,
    ultimoArquivo: arquivo,
    proximoBackupEm: calcularProximoBackupEm(atual, fusoEfetivoBackup(), Date.now()),
  };
  await salvarJsonStoreTenant(empresaId, BACKUP_AUTOMATICO_CONFIG_KEY, proximo);
  return proximo;
}

export async function registrarUploadDriveBackupAutomatico(
  empresaId: string,
  entrada: Partial<
    Pick<
      BackupAutomaticoConfig,
      "ultimoUploadDriveEm" | "ultimoUploadDriveArquivo" | "ultimoUploadDriveErro"
    >
  >
): Promise<BackupAutomaticoConfig> {
  const atual = await carregarConfigBackupAutomatico(empresaId);
  const proximo: BackupAutomaticoConfig = {
    ...atual,
    ...entrada,
  };
  if (entrada.ultimoUploadDriveEm) {
    proximo.ultimoUploadDriveErro = null;
  }
  await salvarJsonStoreTenant(empresaId, BACKUP_AUTOMATICO_CONFIG_KEY, proximo);
  return proximo;
}

export async function registrarPastaDriveEmpresa(
  empresaId: string,
  pastaDriveId: string,
  pastaDriveNome: string
): Promise<BackupAutomaticoConfig> {
  const atual = await carregarConfigBackupAutomatico(empresaId);
  const proximo: BackupAutomaticoConfig = {
    ...atual,
    pastaDriveId,
    pastaDriveNome,
  };
  await salvarJsonStoreTenant(empresaId, BACKUP_AUTOMATICO_CONFIG_KEY, proximo);
  return proximo;
}

export function formatarDataBackup(
  iso: string | null,
  fuso = fusoEfetivoBackup()
) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("pt-BR", {
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
