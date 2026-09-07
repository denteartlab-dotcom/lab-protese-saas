import { NextResponse } from "next/server";
import { prisma, runWithTenantContext } from "@/lib/db";
import { extrairNumeroOsCodigo } from "@/lib/codigo-barras-os";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  acaoHttpParaPermissao,
  negarSeSemPermissao,
} from "@/lib/require-permissao";
import {
  formatClienteLogAuditoria,
  formatServicoLogAuditoria,
  nomeUsuarioParaLogAuditoria,
  registrarLogAuditoria,
} from "@/lib/logs-auditoria";
import { proximoNumeroOsDisponivel, registrarNumeroOsUtilizado } from "@/lib/os-sequencia";
import { trabalhoVisivelModuloTv } from "@/lib/status-os";
import { notificarTvOrdensEmpresa } from "@/lib/tv/notificar-tv-ordens";
import {
  sincronizarTempoProducaoPorMudancaStatus,
} from "@/lib/tempo-producao-status-servidor";
import { garantirDatasEntradaEmpresaAlinhadas } from "@/lib/os-data-criacao";
import {
  garantirOrigemEntradaNasInstrucoes,
  precisaNomeCriadorEntrada,
  rotuloOrigemEntradaDeTexto,
} from "@/lib/os-anexos";
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
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(
    ctx,
    "producao-os",
    acaoHttpParaPermissao(request.method)
  );
  if (negado) return negado;

  try {
    await garantirDatasEntradaEmpresaAlinhadas(prisma, ctx.empresaId);
  } catch (err) {
    console.warn("[trabalhos/GET] alinhar datasEntrada", err);
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const status = searchParams.get("status");
  const dataEntrada = searchParams.get("dataEntrada");
  const atrasados = searchParams.get("atrasados") === "1";
  const numeroOsStr = extrairNumeroOsCodigo(q);
  const isNumeroOs = numeroOsStr.length > 0 && /^\d+$/.test(numeroOsStr);
  const numeroOs = isNumeroOs ? Number(numeroOsStr) : 0;
  const dataInicio = dataEntrada ? new Date(`${dataEntrada}T00:00:00`) : null;
  const dataFim = dataEntrada ? new Date(`${dataEntrada}T23:59:59.999`) : null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const trabalhos = await runWithTenantContext(ctx.empresaId, () =>
    prisma.trabalho.findMany({
      where: {
        empresaId: ctx.empresaId,
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
                  {
                    paciente: {
                      nome: { contains: q, mode: "insensitive" },
                    },
                  },
                  {
                    cliente: {
                      nome: { contains: q, mode: "insensitive" },
                    },
                  },
                  { tipoProtese: { contains: q, mode: "insensitive" } },
                ],
              }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        cliente: { select: { id: true, nome: true, cro: true, ativo: true } },
        paciente: { select: { id: true, nome: true } },
      },
    })
  );

  const precisaCriador = trabalhos.filter((t) =>
    precisaNomeCriadorEntrada(t.instrucoes, t.observacoes)
  );
  const numerosOs = [...new Set(precisaCriador.map((t) => t.numeroOs))];
  const criadorPorNumero = new Map<number, string>();
  const criadorPorTrabalho = new Map<string, string>();

  if (numerosOs.length > 0) {
    const logs = await prisma.logAuditoria.findMany({
      where: {
        empresaId: ctx.empresaId,
        categoria: "os",
        tipoAlteracao: "inclusao",
        OR: [
          { numeroOs: { in: numerosOs } },
          { trabalhoId: { in: precisaCriador.map((t) => t.id) } },
        ],
      },
      orderBy: { dataAlteracao: "asc" },
      select: { numeroOs: true, trabalhoId: true, usuarioNome: true },
    });
    for (const log of logs) {
      const nome = (log.usuarioNome || "").trim();
      if (!nome) continue;
      if (log.numeroOs != null && !criadorPorNumero.has(log.numeroOs)) {
        criadorPorNumero.set(log.numeroOs, nome);
      }
      if (log.trabalhoId && !criadorPorTrabalho.has(log.trabalhoId)) {
        criadorPorTrabalho.set(log.trabalhoId, nome);
      }
    }
  }

  return NextResponse.json(
    trabalhos.map((t) => {
      const base = rotuloOrigemEntradaDeTexto(t.instrucoes, t.observacoes);
      if (!precisaNomeCriadorEntrada(t.instrucoes, t.observacoes)) {
        return { ...t, origemEntradaLabel: base };
      }
      const criador =
        criadorPorTrabalho.get(t.id) || criadorPorNumero.get(t.numeroOs) || "";
      return {
        ...t,
        origemEntradaLabel: criador || "—",
      };
    })
  );
}

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(ctx, "producao-os", "criar");
  if (negado) return negado;

  try {
    const body = await request.json();
    const data = schema.parse(body);
    const segmentoFaturamento = data.segmentoFaturamento ?? "servico";
    const numeroOs =
      data.numeroOs ?? (await proximoNumeroOsDisponivel(ctx.empresaId));

    const [cliente, paciente] = await Promise.all([
      prisma.cliente.findFirst({
        where: { id: data.clienteId, empresaId: ctx.empresaId },
      }),
      prisma.paciente.findFirst({
        where: {
          id: data.pacienteId,
          clienteId: data.clienteId,
          cliente: { empresaId: ctx.empresaId },
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
    const usuarioNome = await nomeUsuarioParaLogAuditoria(ctx.user);
    const instrucoes = garantirOrigemEntradaNasInstrucoes(
      data.instrucoes,
      data.observacoes,
      usuarioNome
    );

    const trabalho = await prisma.trabalho.create({
      data: {
        empresaId: ctx.empresaId,
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
        instrucoes,
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

    await sincronizarTempoProducaoPorMudancaStatus(
      ctx.empresaId,
      trabalho,
      "",
      trabalho.status
    );

    if (trabalho.valor > 0) {
      const sufixoSegmento =
        segmentoFaturamento === "produto"
          ? " (produtos)"
          : segmentoFaturamento === "transporte"
            ? " (transporte)"
            : "";
      await prisma.lancamento.create({
        data: {
          empresaId: ctx.empresaId,
          tipo: "receita",
          descricao: `OS #${trabalho.numeroOs}${sufixoSegmento} - ${trabalho.tipoProtese}`,
          valor: trabalho.valor,
          status: "pendente",
          clienteId: trabalho.clienteId,
          trabalhoId: trabalho.id,
        },
      });
    }

    await registrarNumeroOsUtilizado(ctx.empresaId, trabalho.numeroOs);

    await registrarLogAuditoria({
      empresaId: ctx.empresaId,
      categoria: "os",
      tipoAlteracao: "inclusao",
      numeroOs: trabalho.numeroOs,
      trabalhoId: trabalho.id,
      servico: formatServicoLogAuditoria(trabalho.tipoProtese, trabalho.id),
      clienteNome: formatClienteLogAuditoria(cliente.nome, trabalho.clienteId),
      usuarioId: ctx.user.id,
      usuarioNome,
    });

    if (trabalhoVisivelModuloTv(trabalho.status)) {
      void notificarTvOrdensEmpresa(ctx.empresaId, trabalho.id);
    }

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
