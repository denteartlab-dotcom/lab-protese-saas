import { getSession } from "@/lib/auth";
import { prisma, runWithTenantContext } from "@/lib/db";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import { MODULO_PRODUCAO_ETAPAS_STORAGE_KEY } from "@/lib/modulo-producao-etapas";
import {
  agruparTrabalhosAgenda,
  filtrarLinhasAgendaGrupo,
  mapearLinhaAgendaPdfGrupo,
  type TrabalhoAgendaGrupo,
} from "@/lib/agenda-producao-grupo";
import { ordenarLinhasAgenda, tituloAgendaPdf } from "@/lib/agenda-producao";
import { PdfAgendaViewer } from "@/components/PdfAgendaViewer";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function buscarTrabalhosAgenda(
  empresaId: string,
  sp: Record<string, string | string[] | undefined>
) {
  const q = String(Array.isArray(sp.q) ? sp.q[0] : sp.q || "").trim();
  const status = String(Array.isArray(sp.status) ? sp.status[0] : sp.status || "producao");
  const isNumeroOs = /^\d+$/.test(q);
  const numeroOs = isNumeroOs ? Number(q) : 0;

  return runWithTenantContext(empresaId, () =>
    prisma.trabalho.findMany({
    where: {
      empresaId,
      ...(status ? { status } : {}),
      ...(q
        ? isNumeroOs
          ? { numeroOs }
          : {
              OR: [
                { id: q },
                { paciente: { nome: { contains: q } } },
                { cliente: { nome: { contains: q } } },
                { tipoProtese: { contains: q } },
              ],
            }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      cliente: { select: { nome: true } },
      paciente: { select: { nome: true } },
    },
    })
  );
}

export default async function ImprimirAgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-center">
        <div>
          <p className="font-medium text-slate-800">Sessão expirada.</p>
          <Link href="/login" className="mt-2 inline-block text-sm text-[#4a90d9] hover:underline">
            Faça login novamente
          </Link>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const filtro = String(Array.isArray(sp.filtro) ? sp.filtro[0] : sp.filtro || "todos");
  const cliente = String(Array.isArray(sp.cliente) ? sp.cliente[0] : sp.cliente || "");

  if (!session.empresaId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-center">
        <div>
          <p className="font-medium text-slate-800">Sessão incompleta.</p>
          <Link href="/login" className="mt-2 inline-block text-sm text-[#4a90d9] hover:underline">
            Faça login novamente
          </Link>
        </div>
      </div>
    );
  }

  const trabalhos = await buscarTrabalhosAgenda(session.empresaId, sp);
  const linhasAgrupadas = agruparTrabalhosAgenda(trabalhos as TrabalhoAgendaGrupo[]);
  const filtrados = filtrarLinhasAgendaGrupo(
    linhasAgrupadas,
    filtro,
    cliente || undefined
  );
  const empresaId = session.empresaId;
  const mapaEtapas =
    (await runWithTenantContext(empresaId, () =>
      lerJsonStoreTenant<Record<string, number[]>>(
        empresaId,
        MODULO_PRODUCAO_ETAPAS_STORAGE_KEY
      )
    )) ?? undefined;
  const linhas = ordenarLinhasAgenda(
    filtrados.map((linha) => mapearLinhaAgendaPdfGrupo(linha, mapaEtapas))
  );
  const titulo = tituloAgendaPdf(filtro);

  return <PdfAgendaViewer titulo={titulo} linhas={linhas} />;
}
