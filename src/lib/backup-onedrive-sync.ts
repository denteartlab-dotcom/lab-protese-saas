/**
 * Sincroniza backups locais → OneDrive via Microsoft Graph (sem rclone).
 */
import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { pastaBackupResolvida } from "@/lib/backup-automatico-servidor";
import { pastaBackupEmpresa } from "@/lib/backup-empresa-pasta";
import {
  caminhoRemotoEmpresaBackups,
  deletePastaOneDriveGraph,
  onedriveGraphConfigurado,
  onedriveGraphRootFolder,
  resolverPastaRaizOneDriveGraph,
  uploadBytesOneDriveGraph,
} from "@/lib/onedrive-graph";
import { envRuntime, carregarEnvArquivoRuntime } from "@/lib/env-runtime";

function normalizarSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Ativo se Graph estiver configurado, salvo se
 * ONEDRIVE_BACKUP_SYNC_ENABLED=false|0 explicitamente.
 */
export function onedriveBackupSyncHabilitado() {
  carregarEnvArquivoRuntime();
  const flag = envRuntime("ONEDRIVE_BACKUP_SYNC_ENABLED").toLowerCase();
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return onedriveGraphConfigurado();
  // Sem flag: liga automaticamente quando Graph está ok.
  return onedriveGraphConfigurado();
}

/** @deprecated mantido por compat — destino lógico no Graph. */
export function onedriveRcloneDestino() {
  return onedriveGraphRootFolder();
}

async function listarArquivosRecursivo(
  dir: string,
  base = dir
): Promise<Array<{ absoluto: string; relativo: string; bytes: number }>> {
  const saida: Array<{ absoluto: string; relativo: string; bytes: number }> = [];
  let itens: string[];
  try {
    itens = await readdir(dir);
  } catch {
    return saida;
  }

  for (const nome of itens) {
    const absoluto = path.join(dir, nome);
    let info;
    try {
      info = await stat(absoluto);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      saida.push(...(await listarArquivosRecursivo(absoluto, base)));
      continue;
    }
    if (!info.isFile()) continue;
    const relativo = path.relative(base, absoluto).replace(/\\/g, "/");
    saida.push({ absoluto, relativo, bytes: info.size });
  }
  return saida;
}

function mimeBackupPorNome(nome: string): string {
  const lower = nome.toLowerCase();
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

/**
 * Envia a pasta local de backup da empresa para:
 *   {root}/{slug}/backups/...
 */
export async function sincronizarBackupComOneDrive(opts?: {
  slug?: string;
  nome?: string;
}): Promise<{
  ok: boolean;
  erro?: string;
  arquivos?: number;
}> {
  if (!onedriveBackupSyncHabilitado()) {
    return { ok: false, erro: "desativado" };
  }
  if (!onedriveGraphConfigurado()) {
    return { ok: false, erro: "graph-nao-configurado" };
  }

  try {
    await resolverPastaRaizOneDriveGraph();

    if (!opts?.slug?.trim()) {
      // Sem slug: envia cada subpasta de backups/ como se fosse um lab (legado).
      const raizLocal = pastaBackupResolvida();
      let pastas: string[] = [];
      try {
        pastas = await readdir(raizLocal);
      } catch {
        return { ok: true, arquivos: 0 };
      }

      let total = 0;
      for (const nomePasta of pastas) {
        const absoluto = path.join(raizLocal, nomePasta);
        const info = await stat(absoluto).catch(() => null);
        if (!info?.isDirectory()) continue;
        const slug = normalizarSlug(nomePasta);
        const r = await sincronizarBackupComOneDrive({ slug, nome: nomePasta });
        if (!r.ok) return r;
        total += r.arquivos || 0;
      }
      return { ok: true, arquivos: total };
    }

    const slug = normalizarSlug(opts.slug);
    const origem = pastaBackupEmpresa(slug, opts.nome);
    const destinoBase = caminhoRemotoEmpresaBackups(slug);
    const arquivos = await listarArquivosRecursivo(origem);

    if (!arquivos.length) {
      // Garante pasta remota mesmo vazia
      await uploadBytesOneDriveGraph(
        `${destinoBase}/.keep`,
        Buffer.from("lab-protese-backup\n", "utf8"),
        "text/plain"
      );
      console.info(`[backup-onedrive] pasta vazia → ${destinoBase}`);
      return { ok: true, arquivos: 0 };
    }

    let enviados = 0;
    for (const arq of arquivos) {
      const bytes = await readFile(arq.absoluto);
      const remotePath = `${destinoBase}/${arq.relativo}`;
      await uploadBytesOneDriveGraph(
        remotePath,
        bytes,
        mimeBackupPorNome(arq.relativo)
      );
      enviados += 1;
    }

    console.info(
      `[backup-onedrive] Graph sync OK ${enviados} arquivo(s) → ${destinoBase}`
    );
    return { ok: true, arquivos: enviados };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backup-onedrive]", msg);
    return { ok: false, erro: msg };
  }
}

/** Remove a pasta do laboratório no OneDrive (uploads + backups da estrutura Graph). */
export async function excluirPastaBackupEmpresaOneDrive(
  slug: string,
  _nome?: string
): Promise<{ ok: boolean; erro?: string }> {
  if (!onedriveBackupSyncHabilitado()) {
    return { ok: false, erro: "desativado" };
  }
  if (!onedriveGraphConfigurado()) {
    return { ok: false, erro: "graph-nao-configurado" };
  }

  try {
    await resolverPastaRaizOneDriveGraph();
    const slugNorm = normalizarSlug(slug);
    const raiz = `${onedriveGraphRootFolder().replace(/^[/\\]+|[/\\]+$/g, "")}/${slugNorm}`;
    await deletePastaOneDriveGraph(raiz);
    console.info(`[backup-onedrive] pasta removida no Graph: ${raiz}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found|itemNotFound/i.test(msg)) return { ok: true };
    console.error("[backup-onedrive] purge:", msg);
    return { ok: false, erro: msg };
  }
}
