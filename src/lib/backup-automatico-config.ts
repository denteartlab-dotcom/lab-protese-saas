import { z } from "zod";
import {
  lerJsonStoreServidor,
  salvarJsonStoreServidor,
} from "@/lib/json-store-servidor";

export const BACKUP_AUTOMATICO_CONFIG_KEY = "labProteseBackupAutomatico";
export const FUSO_BACKUP_PADRAO = "America/Sao_Paulo";

export type BackupAutomaticoConfig = {
  ativo: boolean;
  /** 0=domingo … 6=sábado; null = todos os dias */
  diaSemana: number | null;
  hora: number;
  minuto: number;
  ultimoBackupEm: string | null;
  proximoBackupEm: string | null;
  ultimoArquivo: string | null;
};

export const CONFIG_BACKUP_AUTOMATICO_PADRAO: BackupAutomaticoConfig = {
  ativo: true,
  diaSemana: null,
  hora: 0,
  minuto: 0,
  ultimoBackupEm: null,
  proximoBackupEm: null,
  ultimoArquivo: null,
};

const schemaConfig = z.object({
  ativo: z.boolean(),
  diaSemana: z.number().int().min(0).max(6).nullable(),
  hora: z.number().int().min(0).max(23),
  minuto: z.number().int().min(0).max(59),
  ultimoBackupEm: z.string().nullable().optional(),
  proximoBackupEm: z.string().nullable().optional(),
  ultimoArquivo: z.string().nullable().optional(),
});

function partesDataHora(data: Date, fuso: string) {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(data);

  const ler = (tipo: Intl.DateTimeFormatPartTypes) =>
    parseInt(partes.find((parte) => parte.type === tipo)?.value ?? "0", 10);

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

  return {
    diaSemana: mapaDia[weekday] ?? 0,
    hora: ler("hour") % 24,
    minuto: ler("minute"),
    segundo: ler("second"),
  };
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
  };

  base.proximoBackupEm = calcularProximoBackupEm(base);
  return base;
}

export async function carregarConfigBackupAutomatico(): Promise<BackupAutomaticoConfig> {
  const remoto = await lerJsonStoreServidor<unknown>(BACKUP_AUTOMATICO_CONFIG_KEY);
  return normalizarConfigBackupAutomatico(remoto);
}

export async function salvarConfigBackupAutomatico(
  entrada: Pick<BackupAutomaticoConfig, "ativo" | "diaSemana" | "hora" | "minuto">
): Promise<BackupAutomaticoConfig> {
  const atual = await carregarConfigBackupAutomatico();
  const proximo: BackupAutomaticoConfig = {
    ...atual,
    ativo: entrada.ativo,
    diaSemana: entrada.diaSemana,
    hora: entrada.hora,
    minuto: entrada.minuto,
    proximoBackupEm: calcularProximoBackupEm({
      ativo: entrada.ativo,
      diaSemana: entrada.diaSemana,
      hora: entrada.hora,
      minuto: entrada.minuto,
    }),
  };
  await salvarJsonStoreServidor(BACKUP_AUTOMATICO_CONFIG_KEY, proximo);
  return proximo;
}

export async function registrarExecucaoBackupAutomatico(
  exportedAt: string,
  arquivo: string
): Promise<BackupAutomaticoConfig> {
  const atual = await carregarConfigBackupAutomatico();
  const proximo: BackupAutomaticoConfig = {
    ...atual,
    ultimoBackupEm: exportedAt,
    ultimoArquivo: arquivo,
    proximoBackupEm: calcularProximoBackupEm(atual, FUSO_BACKUP_PADRAO, Date.now()),
  };
  await salvarJsonStoreServidor(BACKUP_AUTOMATICO_CONFIG_KEY, proximo);
  return proximo;
}

export function formatarDataBackup(iso: string | null, fuso = FUSO_BACKUP_PADRAO) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: fuso });
  } catch {
    return null;
  }
}
