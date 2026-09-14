import { prisma } from "@/lib/db";

function idsOuUrlsMarcadores(arquivoIds: string[]): Set<string> {
  const set = new Set<string>();
  for (const id of arquivoIds) {
    const limpo = id.trim();
    if (!limpo) continue;
    set.add(limpo);
    set.add(`/api/uploads/arquivo/${limpo}`);
  }
  return set;
}

function linhaAnexoDeveSair(line: string, marcadores: Set<string>): boolean {
  const trimmed = line.trim();
  if (!/^arquivo anexado:/i.test(trimmed) && !/^arquivos anexados:/i.test(trimmed)) {
    return false;
  }
  const url = trimmed
    .replace(/^arquivos? anexados?:/i, "")
    .split("|")
    .map((p) => p.trim())[2] || "";
  if (!url) return false;
  if (marcadores.has(url)) return true;
  const match = url.match(/\/api\/uploads\/arquivo\/([^/?#]+)/i);
  const id = match?.[1] ? decodeURIComponent(match[1]) : "";
  return Boolean(id && marcadores.has(id));
}

export function textoSemAnexosArquivoIds(texto: string, arquivoIds: string[]): string {
  const marcadores = idsOuUrlsMarcadores(arquivoIds);
  if (marcadores.size === 0) return texto;
  return texto
    .split("\n")
    .filter((line) => !linhaAnexoDeveSair(line, marcadores))
    .join("\n");
}

/** Tira da OS as linhas "Arquivo anexado" que apontam para estes uploads. */
export async function removerAnexosOsPorArquivoIds(
  empresaId: string,
  arquivoIds: string[]
) {
  const ids = [...new Set(arquivoIds.map((id) => id.trim()).filter(Boolean))];
  if (!empresaId || ids.length === 0) return;

  const orFiltros = ids.flatMap((id) => [
    { instrucoes: { contains: id } },
    { observacoes: { contains: id } },
  ]);

  const trabalhos = await prisma.trabalho.findMany({
    where: { empresaId, OR: orFiltros },
    select: { id: true, instrucoes: true, observacoes: true },
  });

  for (const trabalho of trabalhos) {
    const instrucoes = textoSemAnexosArquivoIds(trabalho.instrucoes || "", ids);
    const observacoes = textoSemAnexosArquivoIds(trabalho.observacoes || "", ids);
    if (instrucoes === (trabalho.instrucoes || "") && observacoes === (trabalho.observacoes || "")) {
      continue;
    }
    await prisma.trabalho.update({
      where: { id: trabalho.id },
      data: { instrucoes, observacoes },
    });
  }
}

export function ehErroArquivoDriveAusente(err: unknown): boolean {
  const bruto = err as {
    code?: number | string;
    status?: number;
    response?: { status?: number };
    message?: string;
  };
  const status = Number(bruto?.code ?? bruto?.status ?? bruto?.response?.status ?? 0);
  if (status === 404) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /file not found|404|not found:|cannot find the file/i.test(msg);
}

/**
 * Arquivos que saíram do Drive mas ainda estão no banco/OS:
 * apaga o registro e limpa o anexo na ordem de serviço.
 */
export async function reconciliarUploadsGdriveAusentes(
  empresaId: string,
  arquivosNoDrive: Array<{ remotePath: string }>
) {
  if (!empresaId) return;
  const noDrive = new Set(
    arquivosNoDrive.map((a) => a.remotePath.replace(/\\/g, "/").trim()).filter(Boolean)
  );

  const rows = await prisma.arquivoUpload.findMany({
    where: {
      empresaId,
      OR: [{ storage: "gdrive" }, { remotePath: { startsWith: "gdrive:" } }],
    },
    select: { id: true, remotePath: true },
  });

  const orfaos = rows.filter((row) => {
    const chave = (row.remotePath || "").replace(/\\/g, "/").trim();
    if (!chave) return true;
    return !noDrive.has(chave);
  });
  if (orfaos.length === 0) return;

  const ids = orfaos.map((row) => row.id);
  await removerAnexosOsPorArquivoIds(empresaId, ids);
  await prisma.arquivoUpload.deleteMany({
    where: { empresaId, id: { in: ids } },
  });
}
