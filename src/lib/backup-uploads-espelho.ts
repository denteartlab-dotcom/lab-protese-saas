import { cp, mkdir, readdir, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { pastaBackupEmpresa } from "@/lib/backup-empresa-pasta";
import { prisma } from "@/lib/db";
import { uploadUsaBancoDados } from "@/lib/upload-arquivo-server";
import { caminhoPastaUploads } from "@/lib/uploads-armazenamento-server";

function nomeArquivoSeguro(nome: string) {
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
      const arquivo = `${row.id}-${nomeArquivoSeguro(row.nome)}`;
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
