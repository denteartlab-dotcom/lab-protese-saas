import { access, writeFile } from "fs/promises";
import { prisma } from "@/lib/db";
import { exportarBackupLaboratorio } from "@/lib/backup-laboratorio";
import {
  calcularProximoBackupEm,
  carregarConfigBackupAutomatico,
  formatarDataBackup,
  msAteProximoAgendamento,
  registrarExecucaoBackupAutomatico,
  type BackupAutomaticoConfig,
} from "@/lib/backup-automatico-config";
import {
  backupAutomaticoHabilitadoNoServidor,
  caminhoArquivoBackupAutomatico,
  caminhoRelativoPastaBackup,
  fusoBackupAutomatico,
  garantirPastaBackup,
} from "@/lib/backup-automatico-servidor";

let timerBackup: ReturnType<typeof setTimeout> | null = null;
let executando = false;
let configAtual: BackupAutomaticoConfig | null = null;

export { BACKUP_ARQUIVO_PADRAO } from "@/lib/backup-automatico-servidor";

/** Gera backup completo na pasta `backups/` com nome contendo a data do dia (horário de Brasília). */
export async function executarBackupAutomatico() {
  if (executando) {
    console.warn("[backup-automatico] execução já em andamento, ignorando.");
    return null;
  }

  executando = true;
  const fuso = fusoBackupAutomatico();
  const agora = new Date();

  try {
    await garantirPastaBackup();
    const destino = caminhoArquivoBackupAutomatico(agora, fuso);
    const backup = await exportarBackupLaboratorio(prisma);
    const conteudo = JSON.stringify(backup, null, 2);
    await writeFile(destino, conteudo, "utf8");

    try {
      await access(destino);
    } catch {
      throw new Error(`Arquivo de backup não encontrado após gravação: ${destino}`);
    }

    configAtual = await registrarExecucaoBackupAutomatico(backup.exportedAt, destino);
    console.log(
      `[backup-automatico] backup gravado em ${destino} (${backup.exportedAt}) fuso=${fuso}`
    );
    return { destino, exportedAt: backup.exportedAt };
  } catch (erro) {
    console.error("[backup-automatico] falha ao gerar backup:", erro);
    return null;
  } finally {
    executando = false;
  }
}

function agendarProximoBackup() {
  if (!backupAutomaticoHabilitadoNoServidor()) return;
  if (!configAtual?.ativo) {
    console.log("[backup-automatico] desativado na configuração.");
    return;
  }

  const fuso = fusoBackupAutomatico();
  const atraso = msAteProximoAgendamento(configAtual, fuso);

  if (timerBackup) clearTimeout(timerBackup);

  timerBackup = setTimeout(() => {
    void executarBackupAutomatico()
      .catch((erro) => {
        console.error("[backup-automatico] falha ao gerar backup", erro);
      })
      .finally(() => {
        void reagendarBackupAutomatico();
      });
  }, atraso);

  const proximo = calcularProximoBackupEm(configAtual, fuso);
  const proximoTexto = formatarDataBackup(proximo, fuso) ?? "—";
  console.log(
    `[backup-automatico] próximo backup: ${proximoTexto} (${fuso}, em ${Math.round(atraso / 1000)}s)`
  );
}

/** Recarrega configuração do banco e reagenda o próximo backup. */
export async function reagendarBackupAutomatico() {
  if (!backupAutomaticoHabilitadoNoServidor()) return;
  try {
    configAtual = await carregarConfigBackupAutomatico();
    agendarProximoBackup();
  } catch (erro) {
    console.error("[backup-automatico] falha ao reagendar:", erro);
  }
}

/** Agenda backup conforme dia/horário configurados em Configurações → Backup. */
export async function iniciarBackupAutomaticoDiario() {
  if (!backupAutomaticoHabilitadoNoServidor()) {
    console.log("[backup-automatico] desativado (BACKUP_AUTOMATICO_ENABLED=false).");
    return;
  }

  try {
    const pasta = await garantirPastaBackup();
    console.log(
      `[backup-automatico] pasta: ${pasta} (${caminhoRelativoPastaBackup()}/lab-protese-backup-AAAA-MM-DD.json) fuso=${fusoBackupAutomatico()}`
    );
    await reagendarBackupAutomatico();
  } catch (erro) {
    console.error("[backup-automatico] falha ao iniciar agendamento:", erro);
  }
}
