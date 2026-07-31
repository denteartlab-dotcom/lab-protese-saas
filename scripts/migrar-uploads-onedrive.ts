/**
 * Migra arquivos de var/uploads/{slug}/... para o OneDrive (Microsoft Graph)
 * e grava metadados no banco. Depois remove os arquivos locais (opcional).
 *
 * Uso:
 *   npx tsx scripts/migrar-uploads-onedrive.ts
 *   npx tsx scripts/migrar-uploads-onedrive.ts --limpar-disco
 *   npx tsx scripts/migrar-uploads-onedrive.ts --empresa=denteart-1
 *   npx tsx scripts/migrar-uploads-onedrive.ts --simular
 */
import { readdir, readFile, rm, stat } from "fs/promises";
import path from "path";
import { prisma, executarSemRls } from "../src/lib/db";
import {
  caminhoPastaUploads,
  normalizarSlugPastaUploads,
} from "../src/lib/uploads-armazenamento-server";
import {
  caminhoRemotoUpload,
  enviarBufferParaOneDrive,
  onedriveStorageDisponivel,
  onedriveUploadsRemote,
} from "../src/lib/upload-onedrive-storage";
import { detectarMimePorMagic } from "../src/lib/upload-arquivo-server";
import { garantirEstruturaPastasEmpresaOneDrive } from "../src/lib/onedrive-graph";

function argFlag(nome: string) {
  return process.argv.includes(nome);
}

function argValor(nome: string) {
  const prefix = `${nome}=`;
  const raw = process.argv.find((a) => a.startsWith(prefix));
  return raw ? raw.slice(prefix.length).trim() : "";
}

function mimePorExtensao(nome: string): string {
  const lower = nome.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

async function walkArquivos(dir: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkArquivos(full, rel)));
    } else if (entry.isFile()) {
      out.push(rel.replace(/\\/g, "/"));
    }
  }
  return out;
}

async function main() {
  const simular = argFlag("--simular");
  const limparDisco = argFlag("--limpar-disco");
  const filtroSlug = normalizarSlugPastaUploads(argValor("--empresa"));

  const ok = await onedriveStorageDisponivel();
  if (!ok && !simular) {
    console.error(
      "[migrar-uploads-onedrive] Configure ONEDRIVE_GRAPH_CLIENT_ID/SECRET/REFRESH_TOKEN."
    );
    process.exit(1);
  }

  console.log(`[migrar-uploads-onedrive] destino=${onedriveUploadsRemote()}`);
  if (simular) console.log("[migrar-uploads-onedrive] modo --simular");

  const empresas = await executarSemRls(() =>
    prisma.empresa.findMany({
      where: { status: "ativo" },
      select: { id: true, slug: true, nome: true },
      orderBy: { nome: "asc" },
    })
  );

  let totalOk = 0;
  let totalSkip = 0;
  let totalErro = 0;

  for (const empresa of empresas) {
    const slug = normalizarSlugPastaUploads(empresa.slug);
    if (filtroSlug && slug !== filtroSlug) continue;

    if (!simular) {
      try {
        await garantirEstruturaPastasEmpresaOneDrive(slug);
      } catch (err) {
        console.warn(`[migrar-uploads-onedrive] ${slug}: estrutura`, err);
      }
    }

    const base = caminhoPastaUploads(slug);
    let arquivos: string[] = [];
    try {
      const info = await stat(base);
      if (!info.isDirectory()) continue;
      arquivos = await walkArquivos(base, "");
    } catch {
      console.log(`[migrar-uploads-onedrive] ${slug}: sem pasta local`);
      continue;
    }

    console.log(`[migrar-uploads-onedrive] ${slug}: ${arquivos.length} arquivo(s)`);

    for (const rel of arquivos) {
      const partes = rel.split("/");
      if (partes.length < 2) {
        totalSkip += 1;
        continue;
      }
      const pasta = partes[0];
      const filename = partes.slice(1).join("/");
      const remotePath = caminhoRemotoUpload(slug, pasta, filename);

      const jaExiste = await executarSemRls(() =>
        prisma.arquivoUpload.findFirst({
          where: { empresaId: empresa.id, remotePath, storage: "onedrive" },
          select: { id: true },
        })
      );
      if (jaExiste) {
        totalSkip += 1;
        continue;
      }

      const full = path.join(base, ...partes);
      try {
        const bytes = await readFile(full);
        const mime =
          detectarMimePorMagic(bytes) || mimePorExtensao(filename) || "application/octet-stream";

        if (simular) {
          console.log(`  [simular] ${rel} -> ${remotePath} (${bytes.length} bytes)`);
          totalOk += 1;
          continue;
        }

        await enviarBufferParaOneDrive(remotePath, bytes, filename, mime);
        await executarSemRls(() =>
          prisma.arquivoUpload.create({
            data: {
              empresaId: empresa.id,
              pasta,
              nome: filename,
              mimeType: mime,
              tamanho: bytes.length,
              dados: null,
              storage: "onedrive",
              remotePath,
            },
          })
        );
        totalOk += 1;
        console.log(`  ok ${rel}`);
      } catch (err) {
        totalErro += 1;
        console.error(`  erro ${rel}:`, err instanceof Error ? err.message : err);
      }
    }

    if (limparDisco && !simular && arquivos.length > 0) {
      await rm(base, { recursive: true, force: true });
      console.log(`[migrar-uploads-onedrive] ${slug}: disco local removido`);
    }
  }

  console.log(
    `[migrar-uploads-onedrive] concluído ok=${totalOk} skip=${totalSkip} erro=${totalErro}`
  );
}

main()
  .catch((err) => {
    console.error("[migrar-uploads-onedrive]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
