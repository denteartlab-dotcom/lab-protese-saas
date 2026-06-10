import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { exportarBackupLaboratorio } from "@/lib/backup-laboratorio";

export const BACKUP_ARQUIVO_PADRAO = "backups/lab-protese-backup.json";
const FUSO_PADRAO = "America/Sao_Paulo";

let timerBackup: ReturnType<typeof setTimeout> | null = null;
let executando = false;

function backupAutomaticoHabilitado() {
  const flag = process.env.BACKUP_AUTOMATICO_ENABLED;
  if (flag === "0" || flag === "false") return false;
  return true;
}

function caminhoBackupAutomatico() {
  return path.resolve(
    process.cwd(),
    process.env.BACKUP_AUTOMATICO_PATH || BACKUP_ARQUIVO_PADRAO
  );
}

function fusoBackupAutomatico() {
  return process.env.BACKUP_AUTOMATICO_TZ || FUSO_PADRAO;
}

function partesHorario(data: Date, fuso: string) {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(data);

  const ler = (tipo: Intl.DateTimeFormatPartTypes) =>
    parseInt(partes.find((parte) => parte.type === tipo)?.value ?? "0", 10);

  return {
    hora: ler("hour"),
    minuto: ler("minute"),
    segundo: ler("second"),
  };
}

/** Milissegundos até a próxima 00:00:00 no fuso informado. */
export function msAteProximaMeiaNoite(fuso = FUSO_PADRAO) {
  const agora = Date.now();
  let alvo = agora + 1000;
  const limite = agora + 48 * 60 * 60 * 1000;

  while (alvo < limite) {
    const { hora, minuto, segundo } = partesHorario(new Date(alvo), fuso);
    if (hora === 0 && minuto === 0 && segundo === 0) {
      return alvo - agora;
    }
    const pertoDaMeiaNoite = hora === 23 && minuto >= 58;
    alvo += pertoDaMeiaNoite || (hora === 0 && minuto === 0) ? 1000 : 60_000;
  }

  return 24 * 60 * 60 * 1000;
}

export function formatarProximoBackup(fuso = FUSO_PADRAO) {
  const em = msAteProximaMeiaNoite(fuso);
  return new Date(Date.now() + em).toLocaleString("pt-BR", { timeZone: fuso });
}

/** Gera backup completo e sobrescreve o arquivo único (sem histórico). */
export async function executarBackupAutomatico() {
  if (executando) {
    console.warn("[backup-automatico] execução já em andamento, ignorando.");
    return null;
  }

  executando = true;
  try {
    const destino = caminhoBackupAutomatico();
    await mkdir(path.dirname(destino), { recursive: true });
    const backup = await exportarBackupLaboratorio(prisma);
    await writeFile(destino, JSON.stringify(backup, null, 2), "utf8");
    console.log(
      `[backup-automatico] backup gravado em ${destino} (${backup.exportedAt})`
    );
    return { destino, exportedAt: backup.exportedAt };
  } finally {
    executando = false;
  }
}

function agendarProximoBackup() {
  if (!backupAutomaticoHabilitado()) return;

  const fuso = fusoBackupAutomatico();
  const atraso = msAteProximaMeiaNoite(fuso);

  if (timerBackup) clearTimeout(timerBackup);

  timerBackup = setTimeout(() => {
    void executarBackupAutomatico()
      .catch((erro) => {
        console.error("[backup-automatico] falha ao gerar backup", erro);
      })
      .finally(() => {
        agendarProximoBackup();
      });
  }, atraso);

  console.log(
    `[backup-automatico] próximo backup às 00:00 (${fuso}) — ${formatarProximoBackup(fuso)}`
  );
}

/** Agenda backup diário à meia-noite; mantém apenas um arquivo (sempre sobrescrito). */
export function iniciarBackupAutomaticoDiario() {
  if (!backupAutomaticoHabilitado()) {
    console.log("[backup-automatico] desativado (BACKUP_AUTOMATICO_ENABLED=false).");
    return;
  }

  const destino = caminhoBackupAutomatico();
  console.log(`[backup-automatico] arquivo único: ${destino}`);
  agendarProximoBackup();
}
