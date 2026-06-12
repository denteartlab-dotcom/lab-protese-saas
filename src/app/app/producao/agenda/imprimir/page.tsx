import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

async function buscarTrabalhosAgenda(sp: Record<string, string | string[] | undefined>) {
  const q = String(Array.isArray(sp.q) ? sp.q[0] : sp.q || "").trim();
  const status = String(Array.isArray(sp.status) ? sp.status[0] : sp.status || "");
  const isNumeroOs = /^\d+$/.test(q);
  const numeroOs = isNumeroOs ? Number(q) : 0;

  return prisma.trabalho.findMany({
    where: {
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
  });
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

  const trabalhos = await buscarTrabalhosAgenda(sp);
  const linhasAgrupadas = agruparTrabalhosAgenda(trabalhos as TrabalhoAgendaGrupo[]);
  const filtrados = filtrarLinhasAgendaGrupo(
    linhasAgrupadas,
    filtro,
    cliente || undefined
  );
  const linhas = ordenarLinhasAgenda(filtrados.map(mapearLinhaAgendaPdfGrupo));
  const titulo = tituloAgendaPdf(filtro);

  return <PdfAgendaViewer titulo={titulo} linhas={linhas} />;
}
