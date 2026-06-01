import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  formatClienteLogAuditoria,
  formatServicoLogAuditoria,
  registrarLogAuditoria,
} from "@/lib/logs-auditoria";
import { proximoNumeroOsDisponivel, registrarNumeroOsUtilizado } from "@/lib/os-sequencia";
import { z } from "zod";

const schema = z.object({
  clienteId: z.string(),
  pacienteId: z.string(),
  tipoProtese: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, "Informe o tipo de prótese / título do segmento")),
  dentes: z.string().nullish(),
  cor: z.string().nullish(),
  material: z.string().nullish(),
  escala: z.string().nullish(),
  dataEntrada: z.string().nullish(),
  dataPrevista: z.string().nullish(),
  valor: z.number().nullish(),
  status: z.string().nullish(),
  observacoes: z.string().nullish(),
  instrucoes: z.string().nullish(),
  numeroOs: z.number().int().positive().optional(),
  segmentoFaturamento: z.enum(["servico", "produto", "transporte"]).optional(),
  grupoOsId: z.string().optional(),
});

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(value);
  return new Date(year, month - 1, day, 12);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const status = searchParams.get("status");
  const dataEntrada = searchParams.get("dataEntrada");
  const atrasados = searchParams.get("atrasados") === "1";
  const isNumeroOs = /^\d+$/.test(q);
  const numeroOs = isNumeroOs ? Number(q) : 0;
  const dataInicio = dataEntrada ? new Date(`${dataEntrada}T00:00:00`) : null;
  const dataFim = dataEntrada ? new Date(`${dataEntrada}T23:59:59.999`) : null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  ;
  const trabalhos = await prisma.trabalho.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(atrasados
        ? {
            status: { notIn: ["finalizado", "entregue", "cancelado"] },
            dataPrevista: { lt: hoje },
          }
        : {}),
      ...(dataInicio && dataFim
        ? {
            dataEntrada: {
              gte: dataInicio,
              lte: dataFim,
            },
          }
        : {}),
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
      cliente: { select: { id: true, nome: true, cro: true } },
      paciente: { select: { id: true, nome: true } },
    },
  });

  return NextResponse.json(trabalhos);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const data = schema.parse(body);
    const segmentoFaturamento = data.segmentoFaturamento ?? "servico";
    const numeroOs =
      data.numeroOs ?? (await proximoNumeroOsDisponivel());

    ;
    const [cliente, paciente] = await Promise.all([
      prisma.cliente.findFirst({
        where: { id: data.clienteId },
      }),
      prisma.paciente.findFirst({
        where: {
          id: data.pacienteId,
          clienteId: data.clienteId,
        },
      }),
    ]);
    if (!cliente || !paciente) {
      return NextResponse.json(
        { error: "Cliente ou paciente não encontrado neste laboratório." },
        { status: 400 }
      );
    }

    const tipoProtese = data.tipoProtese.trim();

    const trabalho = await prisma.trabalho.create({
      data: {
        numeroOs,
        segmentoFaturamento,
        ...(data.grupoOsId ? { grupoOsId: data.grupoOsId } : {}),
        clienteId: data.clienteId,
        pacienteId: data.pacienteId,
        tipoProtese,
        dentes: data.dentes,
        cor: data.cor,
        material: data.material,
        escala: data.escala,
        dataEntrada: data.dataEntrada ? parseDateOnly(data.dataEntrada) : undefined,
        dataPrevista: data.dataPrevista ? parseDateOnly(data.dataPrevista) : undefined,
        valor: data.valor ?? 0,
        status: data.status ?? "pedido",
        observacoes: data.observacoes,
        instrucoes: data.instrucoes,
      },
      include: {
        cliente: true,
        paciente: true,
      },
    });

    if (!trabalho.grupoOsId) {
      await prisma.trabalho.update({
        where: { id: trabalho.id },
        data: { grupoOsId: trabalho.id },
      });
      trabalho.grupoOsId = trabalho.id;
    }

    if (trabalho.valor > 0) {
      const sufixoSegmento =
        segmentoFaturamento === "produto"
          ? " (produtos)"
          : segmentoFaturamento === "transporte"
            ? " (transporte)"
            : "";
      await prisma.lancamento.create({
        data: {
          tipo: "receita",
          descricao: `OS #${trabalho.numeroOs}${sufixoSegmento} - ${trabalho.tipoProtese}`,
          valor: trabalho.valor,
          status: "pendente",
          clienteId: trabalho.clienteId,
          trabalhoId: trabalho.id,
        },
      });
    }

    await registrarNumeroOsUtilizado(trabalho.numeroOs);

    await registrarLogAuditoria({
      categoria: "os",
      tipoAlteracao: "inclusao",
      numeroOs: trabalho.numeroOs,
      trabalhoId: trabalho.id,
      servico: formatServicoLogAuditoria(trabalho.tipoProtese, trabalho.id),
      clienteNome: formatClienteLogAuditoria(cliente.nome, trabalho.clienteId),
      usuarioId: session.id,
      usuarioNome: session.name,
    });

    return NextResponse.json(trabalho, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const mensagem = error.issues.map((issue) => issue.message).join("; ");
      return NextResponse.json(
        { error: mensagem || "Dados inválidos", issues: error.issues },
        { status: 400 }
      );
    }
    const prismaCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "";
    console.error("POST /api/trabalhos", error);
    return NextResponse.json(
      {
        error:
          prismaCode === "P2002"
            ? "Já existe registro desta OS com o mesmo segmento e mesmo serviço/título. Verifique itens duplicados ou aplique a migração do banco (vários serviços por OS)."
            : "Não foi possível gravar a OS.",
        code: prismaCode || undefined,
      },
      { status: 400 }
    );
  }
}
