import { exec } from "child_process";
import { mkdir, readFile, readdir, stat, unlink } from "fs/promises";
import path from "path";
import { promisify } from "util";
import { pastaBackupEmpresa } from "@/lib/backup-empresa-pasta";

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

export function caminhoArquivoBackupAutomaticoEmpresa(
  slug: string,
  nome?: string,
  data = new Date(),
  fuso = fusoBackupAutomatico()
) {
  return path.join(
    pastaBackupEmpresa(slug, nome),
    nomeArquivoBackupAutomatico(data, fuso)
  );
}

export async function garantirPastaBackupEmpresa(slug: string, nome?: string) {
  const pasta = pastaBackupEmpresa(slug, nome);
  await mkdir(pasta, { recursive: true });
  return pasta;
}

export async function listarArquivosPastaBackupEmpresa(slug: string, nome?: string) {
  const pasta = await garantirPastaBackupEmpresa(slug, nome);
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

export async function abrirPastaBackupsEmpresaNoSistema(slug: string, nome?: string) {
  const pasta = await garantirPastaBackupEmpresa(slug, nome);
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

/** Evita path traversal ao manipular arquivos na pasta de backup. */
export function nomeArquivoBackupValido(nome: string) {
  if (!nome || nome.includes("..") || /[\\/]/.test(nome)) return false;
  return new RegExp(
    `^${PREFIXO_ARQUIVO_BACKUP.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d{4}-\\d{2}-\\d{2}\\.json$`,
    "i"
  ).test(nome);
}

function caminhoArquivoNaPastaEmpresa(
  slug: string,
  nomeArquivo: string,
  empresaNome?: string
) {
  if (!nomeArquivoBackupValido(nomeArquivo)) {
    throw new Error("ARQUIVO_BACKUP_INVALIDO");
  }
  const pasta = pastaBackupEmpresa(slug, empresaNome);
  const caminho = path.resolve(pasta, nomeArquivo);
  const pastaResolvida = path.resolve(pasta);
  const relativo = path.relative(pastaResolvida, caminho);
  if (relativo.startsWith("..") || path.isAbsolute(relativo)) {
    throw new Error("ARQUIVO_BACKUP_INVALIDO");
  }
  return caminho;
}

export async function lerArquivoBackupPastaEmpresa(
  slug: string,
  nomeArquivo: string,
  empresaNome?: string
) {
  const caminho = caminhoArquivoNaPastaEmpresa(slug, nomeArquivo, empresaNome);
  return readFile(caminho, "utf8");
}

export async function excluirArquivosPastaBackupEmpresa(
  slug: string,
  nomes: string[],
  empresaNome?: string
) {
  const excluidos: string[] = [];
  for (const nome of nomes) {
    const caminho = caminhoArquivoNaPastaEmpresa(slug, nome, empresaNome);
    await unlink(caminho);
    excluidos.push(nome);
  }
  return excluidos;
}

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
