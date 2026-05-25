import { exec } from "child_process";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);
import {
  LIMITE_ARMAZENAMENTO_BYTES,
  LIMITE_GALERIA_GB,
} from "@/lib/uploads-armazenamento";

export function caminhoPastaUploads() {
  return path.join(process.cwd(), "public", "uploads");
}

function resolverArquivoUploads(relativePath: string) {
  const base = path.resolve(caminhoPastaUploads());
  const alvo = path.resolve(base, relativePath.replace(/^[/\\]+/, ""));
  if (alvo !== base && !alvo.startsWith(base + path.sep)) {
    throw new Error("Caminho inválido");
  }
  return alvo;
}

export type ArquivoGaleria = {
  relativePath: string;
  nome: string;
  bytes: number;
  url: string;
};

export async function listarArquivosGaleria(): Promise<ArquivoGaleria[]> {
  const base = caminhoPastaUploads();
  await mkdir(base, { recursive: true });
  const lista: ArquivoGaleria[] = [];

  async function walk(dir: string, prefix: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else if (entry.isFile()) {
        const info = await stat(full);
        const urlPath = rel.split(path.sep).join("/");
        lista.push({
          relativePath: rel.replace(/\\/g, "/"),
          nome: entry.name,
          bytes: info.size,
          url: `/uploads/${urlPath}`,
        });
      }
    }
  }

  await walk(base, "");
  return lista.sort((a, b) => b.bytes - a.bytes);
}

export async function excluirArquivoGaleria(relativePath: string) {
  const alvo = resolverArquivoUploads(relativePath);
  await unlink(alvo);
}

export async function abrirPastaUploadsNoSistema() {
  const pasta = caminhoPastaUploads();
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
      "Não foi possível abrir o gerenciador de arquivos. Use a lista abaixo para excluir arquivos.",
  };
}

async function tamanhoDiretorio(dir: string): Promise<number> {
  let total = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await tamanhoDiretorio(full);
      } else if (entry.isFile()) {
        const info = await stat(full);
        total += info.size;
      }
    }
  } catch {
    /* pasta inexistente */
  }
  return total;
}

export function resumoArmazenamentoVazio() {
  return {
    bytesUsados: 0,
    bytesLivres: LIMITE_ARMAZENAMENTO_BYTES,
    limiteBytes: LIMITE_ARMAZENAMENTO_BYTES,
    limiteGb: LIMITE_GALERIA_GB,
    percentualUsado: 0,
    percentualLivre: 100,
  };
}

export async function calcularArmazenamentoGaleria() {
  const base = caminhoPastaUploads();
  const bytesUsados = await tamanhoDiretorio(base);
  const bytesLivres = Math.max(0, LIMITE_ARMAZENAMENTO_BYTES - bytesUsados);
  const percentualUsado =
    LIMITE_ARMAZENAMENTO_BYTES > 0
      ? Math.min(100, Math.round((bytesUsados / LIMITE_ARMAZENAMENTO_BYTES) * 100))
      : 0;
  const percentualLivre = 100 - percentualUsado;

  return {
    bytesUsados,
    bytesLivres,
    limiteBytes: LIMITE_ARMAZENAMENTO_BYTES,
    limiteGb: LIMITE_GALERIA_GB,
    percentualUsado,
    percentualLivre,
  };
}
