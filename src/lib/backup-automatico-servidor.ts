import { exec } from "child_process";
import { mkdir, readdir, stat } from "fs/promises";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

export const BACKUP_ARQUIVO_PADRAO = "backups/lab-protese-backup.json";

export function caminhoBackupResolvido() {
  return path.resolve(
    process.cwd(),
    process.env.BACKUP_AUTOMATICO_PATH || BACKUP_ARQUIVO_PADRAO
  );
}

export function pastaBackupResolvida() {
  return path.dirname(caminhoBackupResolvido());
}

export type ArquivoPastaBackup = {
  nome: string;
  bytes: number;
  modificadoEm: string;
};

export async function listarArquivosPastaBackup(): Promise<ArquivoPastaBackup[]> {
  const pasta = pastaBackupResolvida();
  await mkdir(pasta, { recursive: true });

  const entradas = await readdir(pasta, { withFileTypes: true });
  const arquivos: ArquivoPastaBackup[] = [];

  for (const entrada of entradas) {
    if (!entrada.isFile()) continue;
    const caminhoCompleto = path.join(pasta, entrada.name);
    const info = await stat(caminhoCompleto);
    arquivos.push({
      nome: entrada.name,
      bytes: info.size,
      modificadoEm: info.mtime.toISOString(),
    });
  }

  return arquivos.sort((a, b) => b.modificadoEm.localeCompare(a.modificadoEm));
}

export async function abrirPastaBackupsNoSistema() {
  const pasta = pastaBackupResolvida();
  await mkdir(pasta, { recursive: true });
  const pastaWin = pasta.replace(/\//g, "\\");

  try {
    if (process.platform === "win32") {
      await execAsync(`explorer "${pastaWin}"`);
      return { aberto: true, pasta };
    }
    if (process.platform === "darwin") {
      await execAsync(`open "${pasta}"`);
      return { aberto: true, pasta };
    }
    if (process.platform === "linux") {
      await execAsync(`xdg-open "${pasta}"`);
      return { aberto: true, pasta };
    }
  } catch {
    /* sem interface gráfica ou permissão */
  }

  return {
    aberto: false,
    pasta,
    mensagem:
      "Não foi possível abrir o gerenciador de arquivos. Confira o caminho e a lista abaixo.",
  };
}

export function fusoBackupAutomatico() {
  return process.env.BACKUP_AUTOMATICO_TZ || "America/Sao_Paulo";
}

export function backupAutomaticoHabilitadoNoServidor() {
  const flag = process.env.BACKUP_AUTOMATICO_ENABLED;
  return flag !== "0" && flag !== "false";
}
