/**
 * Data de criação/lançamento da OS — imutável após o cadastro.
 * Em grupos (serviço+produto+transporte), usa a data da linha mais antiga.
 */

/** YYYY-MM-DD no calendário local (sem deslocar por UTC). */
export function dataEntradaParaApi(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (br) {
      return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type TrabalhoDataCriacao = {
  id: string;
  dataEntrada: Date;
  createdAt?: Date | null;
};

/**
 * Data original da OS: a `dataEntrada` da linha criada primeiro no sistema
 * (menor `createdAt`). Assim edição / novos segmentos não alteram o cabeçalho.
 */
export function dataCriacaoOriginalOs<T extends TrabalhoDataCriacao>(
  grupo: T[],
  fallback?: T | null
): Date {
  const lista = grupo.length > 0 ? grupo : fallback ? [fallback] : [];
  if (lista.length === 0) return new Date();

  let principal = lista[0];
  for (const row of lista) {
    const a = row.createdAt?.getTime() ?? row.dataEntrada.getTime();
    const b = principal.createdAt?.getTime() ?? principal.dataEntrada.getTime();
    if (a < b) principal = row;
  }
  return principal.dataEntrada;
}

/**
 * Alinha `dataEntrada` de todos os segmentos do grupo à data original.
 * Corrige OS já existentes cujo segmento novo ficou com a data de hoje.
 */
export async function alinharDataEntradaGrupoOs(
  prismaClient: {
    trabalho: {
      updateMany: (args: {
        where: { id: { in: string[] } };
        data: { dataEntrada: Date };
      }) => Promise<unknown>;
    };
  },
  grupo: TrabalhoDataCriacao[]
): Promise<Date> {
  const original = dataCriacaoOriginalOs(grupo);
  const originalMs = original.getTime();
  const idsDesalinhados = grupo
    .filter((row) => row.dataEntrada.getTime() !== originalMs)
    .map((row) => row.id);

  if (idsDesalinhados.length > 0) {
    await prismaClient.trabalho.updateMany({
      where: { id: { in: idsDesalinhados } },
      data: { dataEntrada: original },
    });
  }

  return original;
}

const empresasAlinhadas = new Set<string>();

/** Uma vez por processo/empresa: corrige dataEntrada de todos os grupos desalinhados. */
export async function garantirDatasEntradaEmpresaAlinhadas(
  prismaClient: {
    trabalho: {
      findMany: (args: {
        where: { empresaId: string };
        select: {
          id: true;
          grupoOsId: true;
          dataEntrada: true;
          createdAt: true;
        };
      }) => Promise<
        Array<{
          id: string;
          grupoOsId: string | null;
          dataEntrada: Date;
          createdAt: Date;
        }>
      >;
      updateMany: (args: {
        where: { id: { in: string[] } };
        data: { dataEntrada: Date };
      }) => Promise<unknown>;
    };
  },
  empresaId: string
) {
  if (empresasAlinhadas.has(empresaId)) return;
  empresasAlinhadas.add(empresaId);

  try {
    const todos = await prismaClient.trabalho.findMany({
      where: { empresaId },
      select: {
        id: true,
        grupoOsId: true,
        dataEntrada: true,
        createdAt: true,
      },
    });

    const porGrupo = new Map<string, typeof todos>();
    for (const t of todos) {
      const chave = t.grupoOsId || t.id;
      const lista = porGrupo.get(chave) || [];
      lista.push(t);
      porGrupo.set(chave, lista);
    }

    for (const grupo of porGrupo.values()) {
      await alinharDataEntradaGrupoOs(prismaClient, grupo);
    }
  } catch (err) {
    empresasAlinhadas.delete(empresaId);
    throw err;
  }
}
