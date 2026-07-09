import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  mesmosNomePacienteExato,
  normalizarNomePaciente,
} from "@/lib/paciente-nome-os";

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clienteId = (searchParams.get("clienteId") || "").trim();
  const nome = (searchParams.get("nome") || "").trim();

  if (!clienteId || normalizarNomePaciente(nome).length < 2) {
    return NextResponse.json({ duplicado: false, numerosOs: [] as number[] });
  }

  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, empresaId: ctx.empresaId },
    select: { id: true },
  });
  if (!cliente) {
    return NextResponse.json({ duplicado: false, numerosOs: [] as number[] });
  }

  const pacientes = await prisma.paciente.findMany({
    where: {
      clienteId,
      cliente: { empresaId: ctx.empresaId },
    },
    select: {
      nome: true,
      trabalhos: {
        select: { numeroOs: true },
      },
    },
  });

  const numerosOs = [
    ...new Set(
      pacientes
        .filter((paciente) => mesmosNomePacienteExato(nome, paciente.nome))
        .flatMap((paciente) => paciente.trabalhos.map((trabalho) => trabalho.numeroOs))
    ),
  ].sort((a, b) => b - a);

  return NextResponse.json({
    duplicado: numerosOs.length > 0,
    numerosOs,
  });
}
