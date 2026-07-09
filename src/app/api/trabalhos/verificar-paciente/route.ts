import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  extrairNomeSobrenomePaciente,
  mesmosNomeSobrenomePaciente,
} from "@/lib/paciente-nome-os";

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clienteId = (searchParams.get("clienteId") || "").trim();
  const nome = (searchParams.get("nome") || "").trim();
  const excluirNumeroOs = Number(searchParams.get("excluirNumeroOs") || 0);

  if (!clienteId || !nome) {
    return NextResponse.json({ duplicado: false, numerosOs: [] as number[] });
  }

  const partes = extrairNomeSobrenomePaciente(nome);
  if (!partes) {
    return NextResponse.json({ duplicado: false, numerosOs: [] as number[] });
  }

  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, empresaId: ctx.empresaId },
    select: { id: true },
  });
  if (!cliente) {
    return NextResponse.json({ duplicado: false, numerosOs: [] as number[] });
  }

  const trabalhos = await prisma.trabalho.findMany({
    where: {
      empresaId: ctx.empresaId,
      clienteId,
      paciente: {
        nome: { contains: partes.nome, mode: "insensitive" },
      },
      ...(excluirNumeroOs > 0 ? { numeroOs: { not: excluirNumeroOs } } : {}),
    },
    select: {
      numeroOs: true,
      dataEntrada: true,
      status: true,
      paciente: { select: { nome: true } },
    },
    orderBy: [{ numeroOs: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const numerosOs = [
    ...new Set(
      trabalhos
        .filter((trabalho) => mesmosNomeSobrenomePaciente(nome, trabalho.paciente.nome))
        .map((trabalho) => trabalho.numeroOs)
    ),
  ].sort((a, b) => b - a);

  const ordens = numerosOs.map((numeroOs) => {
    const registro = trabalhos.find((trabalho) => trabalho.numeroOs === numeroOs);
    return {
      numeroOs,
      status: registro?.status || "",
      dataEntrada: registro?.dataEntrada?.toISOString() || null,
      pacienteNome: registro?.paciente.nome || nome,
    };
  });

  return NextResponse.json({
    duplicado: numerosOs.length > 0,
    numerosOs,
    ordens,
  });
}
