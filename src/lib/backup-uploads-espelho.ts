import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { pastaBackupEmpresa } from "@/lib/backup-empresa-pasta";
import { prisma } from "@/lib/db";
import { uploadUsaBancoDados } from "@/lib/upload-arquivo-server";
import { caminhoPastaUploads } from "@/lib/uploads-armazenamento-server";

export function nomeArquivoUploadBackupSeguro(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 180);
}

export function pastaUploadsBackupEmpresa(slug: string, nome?: string) {
  return path.join(pastaBackupEmpresa(slug, nome), "uploads");
}

async function contarArquivosRecursivo(pasta: string): Promise<number> {
  let total = 0;
  let entradas;
  try {
    entradas = await readdir(pasta, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entrada of entradas) {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) {
      total += await contarArquivosRecursivo(caminho);
    } else if (entrada.isFile()) {
      total += 1;
    }
  }

  return total;
}

/** Copia anexos/imagens para `backups/{empresa}/uploads/` (incluído no sync para OneDrive). */
export async function espelharUploadsNoBackupEmpresa(
  empresaId: string,
  slug: string,
  nome?: string
) {
  const destino = pastaUploadsBackupEmpresa(slug, nome);
  await rm(destino, { recursive: true, force: true });
  await mkdir(destino, { recursive: true });

  let arquivos = 0;

  if (uploadUsaBancoDados()) {
    const rows = await prisma.arquivoUpload.findMany({
      where: { empresaId },
      select: { id: true, pasta: true, nome: true, dados: true },
      orderBy: { criadoEm: "asc" },
    });

    for (const row of rows) {
      const pastaDestino = path.join(destino, row.pasta);
      await mkdir(pastaDestino, { recursive: true });
      const arquivo = `${row.id}-${nomeArquivoUploadBackupSeguro(row.nome)}`;
      await writeFile(path.join(pastaDestino, arquivo), row.dados);
      arquivos += 1;
    }
  } else {
    const origem = caminhoPastaUploads(slug);
    try {
      const info = await stat(origem);
      if (info.isDirectory()) {
        await cp(origem, destino, { recursive: true });
        arquivos = await contarArquivosRecursivo(destino);
      }
    } catch {
      /* sem uploads em disco ainda */
    }
  }

  return { destino, arquivos };
}

export async function contarUploadsBackupEmpresa(slug: string, nome?: string) {
  return contarArquivosRecursivo(pastaUploadsBackupEmpresa(slug, nome));
}

async function lerUploadsRecursivoParaMapa(
  dir: string,
  prefixo: string,
  destino: Map<string, Buffer>
) {
  let entradas;
  try {
    entradas = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entrada of entradas) {
    const rel = prefixo ? `${prefixo}/${entrada.name}` : entrada.name;
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      await lerUploadsRecursivoParaMapa(completo, rel, destino);
    } else if (entrada.isFile()) {
      const dados = await readFile(completo);
      if (dados.length > 0) {
        destino.set(`uploads/${rel.replace(/\\/g, "/")}`, dados);
      }
    }
  }
}

/** Lê uploads/ da pasta de backup automático no servidor (para importação). */
export async function mapaUploadsDaPastaBackupEmpresa(slug: string, nome?: string) {
  const mapa = new Map<string, Buffer>();
  await lerUploadsRecursivoParaMapa(pastaUploadsBackupEmpresa(slug, nome), "", mapa);
  return mapa;
}
