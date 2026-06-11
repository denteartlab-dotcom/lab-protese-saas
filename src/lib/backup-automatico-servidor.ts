import { exec } from "child_process";
import { mkdir, readdir, stat } from "fs/promises";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

export const PASTA_BACKUP_PADRAO = "backups";
export const PREFIXO_ARQUIVO_BACKUP = "lab-protese-backup";

/** Caminho relativo exibido na interface (padrão da pasta + nome com data). */
export const BACKUP_ARQUIVO_PADRAO = `${PASTA_BACKUP_PADRAO}/${PREFIXO_ARQUIVO_BACKUP}-AAAA-MM-DD.json`;

export function fusoBackupAutomatico() {
  return process.env.BACKUP_AUTOMATICO_TZ || "America/Sao_Paulo";
}

function resolverCaminhoBackupEnv() {
  const env = process.env.BACKUP_AUTOMATICO_PATH?.trim();
  if (!env) return null;
  return path.resolve(process.cwd(), env);
}

export function pastaBackupResolvida() {
  const envResolvido = resolverCaminhoBackupEnv();
  if (!envResolvido) {
    return path.resolve(process.cwd(), PASTA_BACKUP_PADRAO);
  }

  if (envResolvido.toLowerCase().endsWith(".json")) {
    return path.dirname(envResolvido);
  }

  return envResolvido;
}

export function formatarDataArquivoBackup(
  data = new Date(),
  fuso = fusoBackupAutomatico()
) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(data);
}

export function nomeArquivoBackupAutomatico(
  data = new Date(),
  fuso = fusoBackupAutomatico()
) {
  return `${PREFIXO_ARQUIVO_BACKUP}-${formatarDataArquivoBackup(data, fuso)}.json`;
}

export function caminhoArquivoBackupAutomatico(
  data = new Date(),
  fuso = fusoBackupAutomatico()
) {
  return path.join(pastaBackupResolvida(), nomeArquivoBackupAutomatico(data, fuso));
}

/** Mantido para compatibilidade: caminho do backup do dia atual. */
export function caminhoBackupResolvido(
  data = new Date(),
  fuso = fusoBackupAutomatico()
) {
  return caminhoArquivoBackupAutomatico(data, fuso);
}

export function caminhoRelativoPastaBackup() {
  return path.relative(process.cwd(), pastaBackupResolvida()).replace(/\\/g, "/");
}

export async function garantirPastaBackup() {
  const pasta = pastaBackupResolvida();
  await mkdir(pasta, { recursive: true });
  return pasta;
}

export type ArquivoPastaBackup = {
  nome: string;
  bytes: number;
  modificadoEm: string;
};

export async function listarArquivosPastaBackup(): Promise<ArquivoPastaBackup[]> {
  const pasta = await garantirPastaBackup();
  const entradas = await readdir(pasta, { withFileTypes: true });
  const arquivos: ArquivoPastaBackup[] = [];

  for (const entrada of entradas) {
    if (!entrada.isFile() || !entrada.name.endsWith(".json")) continue;
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
  const pasta = await garantirPastaBackup();
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

export function backupAutomaticoHabilitadoNoServidor() {
  const flag = process.env.BACKUP_AUTOMATICO_ENABLED;
  return flag !== "0" && flag !== "false";
}
