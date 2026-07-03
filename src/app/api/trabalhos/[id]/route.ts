import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  formatClienteLogAuditoria,
  formatServicoLogAuditoria,
  formatarValorCampoLog,
  nomeUsuarioParaLogAuditoria,
  registrarLogAuditoria,
  type DetalheAlteracaoAuditoria,
} from "@/lib/logs-auditoria";
import {
  lancamentoFaturaOsAtivo,
  MENSAGEM_OS_FATURADA_NAO_EXCLUI,
  osEstaFaturadaContasReceber,
} from "@/lib/os-faturamento";
import { grupoOsIdOf, segmentoEfetivoTrabalho, whereGrupoOs } from "@/lib/trabalho-os-segmento";
import { STATUS_TRABALHO } from "@/lib/utils";
import {
  flagsUrgenciaTrabalho,
} from "@/lib/modulo-producao-os";
import {
  removerUrgenciaOs,
} from "@/lib/urgencia-cliente";
import { notificarTvOrdensEmpresa } from "@/lib/tv/notificar-tv-ordens";
import {
  adicionarTrabalhoControleEntregasAutomaticoServidor,
  deveAdicionarControleEntregasPorStatus,
  deveRemoverControleEntregasPorStatus,
  removerTrabalhoControleEntregasAutomaticoServidor,
} from "@/lib/controle-entregas-automatico";
import {
  concluirEntregasControlePorNumeroOsServidor,
  STATUS_ENTREGUE_CLIENTE,
} from "@/lib/entrega-trabalho-sync";
import { STATUS_TRABALHO_FINALIZADO_IMPRESSAO } from "@/lib/os-itens-impressao";
import { z } from "zod";

const schema = z.object({
  clienteId: z.string().nullish(),
  pacienteId: z.string().nullish(),
  segmentoFaturamento: z.enum(["servico", "produto", "transporte"]).nullish(),
  tipoProtese: z.string().nullish(),
  dentes: z.string().nullish(),
  cor: z.string().nullish(),
  material: z.string().nullish(),
  escala: z.string().nullish(),
  dataPrevista: z.string().nullish(),
  dataEntrega: z.string().nullish(),
  valor: z.number().nullish(),
  status: z.string().nullish(),
  observacoes: z.string().nullish(),
  instrucoes: z.string().nullish(),
});

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(value);
  return new Date(year, month - 1, day, 12);
}

function dataHojeMeioDia() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const trabalho = await prisma.trabalho.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: { cliente: true, paciente: true },
  });

  if (!trabalho) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const grupo = await prisma.trabalho.findMany({
    where: {
      empresaId: ctx.empresaId,
      grupoOsId: grupoOsIdOf(trabalho),
    },
    include: { cliente: true, paciente: true },
    orderBy: { segmentoFaturamento: "asc" },
  });

  return NextResponse.json({ ...trabalho, grupo });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const data = schema.parse(body);
    const atual = await prisma.trabalho.findFirst({
      where: { id, empresaId: ctx.empresaId },
    });
    if (!atual) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const payload: Record<string, unknown> = {};

    if (data.clienteId != null && data.clienteId !== "") {
      payload.clienteId = data.clienteId;
    }
    if (data.pacienteId != null && data.pacienteId !== "") {
      payload.pacienteId = data.pacienteId;
    }
    if (data.segmentoFaturamento != null) {
      payload.segmentoFaturamento = data.segmentoFaturamento;
    }
    if (data.tipoProtese != null && data.tipoProtese !== "") {
      payload.tipoProtese = data.tipoProtese;
    }
    if (data.dentes !== undefined) payload.dentes = data.dentes;
    if (data.cor !== undefined) payload.cor = data.cor;
    if (data.material !== undefined) payload.material = data.material;
    if (data.escala !== undefined) payload.escala = data.escala;
    if (data.valor != null) payload.valor = data.valor;
    if (data.status != null && data.status !== "") payload.status = data.status;
    if (data.observacoes !== undefined) payload.observacoes = data.observacoes;
    if (data.instrucoes !== undefined) payload.instrucoes = data.instrucoes;

    if (data.dataPrevista === null) payload.dataPrevista = null;
    else if (data.dataPrevista) payload.dataPrevista = parseDateOnly(data.dataPrevista);

    if (data.dataEntrega === null) payload.dataEntrega = null;
    else if (data.dataEntrega) payload.dataEntrega = parseDateOnly(data.dataEntrega);

    if (data.status != null && data.status !== atual.status) {
      const novoStatus = String(data.status).trim().toLowerCase();
      if (STATUS_TRABALHO_FINALIZADO_IMPRESSAO.has(novoStatus)) {
        const entregaInformada =
          data.dataEntrega !== undefined && data.dataEntrega !== null && data.dataEntrega !== "";
        if (!entregaInformada && !atual.dataEntrega) {
          payload.dataEntrega = dataHojeMeioDia();
        }
      }
    }

    const trabalho = await prisma.trabalho.update({
      where: { id },
      data: payload,
      include: {
        cliente: {
          select: {
            nome: true,
            endereco: true,
            cidade: true,
            uf: true,
            cep: true,
            observacoes: true,
          },
        },
        paciente: true,
      },
    });

    const novoStatus = String(payload.status ?? atual.status);
    const statusMudou = data.status != null && data.status !== atual.status;

    if (statusMudou) {
      const tinhaUrgencia =
        flagsUrgenciaTrabalho(atual).urgente ||
        (
          await prisma.trabalho.findMany({
            where: { empresaId: ctx.empresaId, numeroOs: atual.numeroOs },
            select: { tipoProtese: true, instrucoes: true },
          })
        ).some((t) => flagsUrgenciaTrabalho(t).urgente);

      if (tinhaUrgencia) {
        await removerUrgenciaOs(atual.numeroOs, ctx.empresaId);
      }

      const outrosServicos = await prisma.trabalho.findMany({
        where: {
          empresaId: ctx.empresaId,
          numeroOs: atual.numeroOs,
          NOT: { id },
        },
        select: {
          id: true,
          segmentoFaturamento: true,
          instrucoes: true,
        },
      });
      const idsSync = outrosServicos
        .filter((t) => segmentoEfetivoTrabalho(t) === "servico")
        .map((t) => t.id);
      if (idsSync.length > 0) {
        await prisma.trabalho.updateMany({
          where: { id: { in: idsSync } },
          data: { status: novoStatus },
        });
      }
    }

    const detalhes: DetalheAlteracaoAuditoria[] = [];
    const rotulo = (campo: string, antes: unknown, depois: unknown) => {
      const a = antes == null || antes === "" ? "—" : String(antes);
      const d = depois == null || depois === "" ? "—" : String(depois);
      if (a !== d) detalhes.push({ campo, antes: a, depois: d });
    };

    if (data.status != null && data.status !== atual.status) {
      rotulo(
        "Situação",
        STATUS_TRABALHO[atual.status]?.label || atual.status,
        STATUS_TRABALHO[data.status]?.label || data.status
      );
    }
    if (data.observacoes !== undefined && data.observacoes !== atual.observacoes) {
      rotulo("Anotações", atual.observacoes, data.observacoes);
    }
    if (data.tipoProtese != null && data.tipoProtese !== atual.tipoProtese) {
      rotulo("Serviço", atual.tipoProtese, data.tipoProtese);
    }
    if (data.valor != null && data.valor !== atual.valor) {
      rotulo(
        "Valor",
        formatarValorCampoLog("Valor", String(atual.valor)),
        formatarValorCampoLog("Valor", String(data.valor))
      );
    }

    if (detalhes.length > 0) {
      await registrarLogAuditoria({
        empresaId: ctx.empresaId,
        categoria: "os",
        clienteNome: formatClienteLogAuditoria(
          trabalho.cliente?.nome,
          trabalho.clienteId
        ),
        tipoAlteracao: "alteracao",
        numeroOs: atual.numeroOs,
        trabalhoId: atual.id,
        servico: formatServicoLogAuditoria(trabalho.tipoProtese, trabalho.id),
        usuarioId: ctx.user.id,
        usuarioNome: await nomeUsuarioParaLogAuditoria(ctx.user),
        detalhes,
      });
    }

    const camposCompartilhados: Record<string, unknown> = {};
    if (data.clienteId != null && data.clienteId !== "") {
      camposCompartilhados.clienteId = data.clienteId;
    }
    if (data.pacienteId != null && data.pacienteId !== "") {
      camposCompartilhados.pacienteId = data.pacienteId;
    }
    if (data.status !== undefined) camposCompartilhados.status = data.status;
    if (data.observacoes !== undefined) camposCompartilhados.observacoes = data.observacoes;
    if (payload.dataPrevista !== undefined) camposCompartilhados.dataPrevista = payload.dataPrevista;
    if (payload.dataEntrega !== undefined) camposCompartilhados.dataEntrega = payload.dataEntrega;
    if (data.material !== undefined) camposCompartilhados.material = data.material;
    if (data.cor !== undefined) camposCompartilhados.cor = data.cor;
    if (data.dentes !== undefined) camposCompartilhados.dentes = data.dentes;

    if (Object.keys(camposCompartilhados).length > 0 && atual.grupoOsId) {
      await prisma.trabalho.updateMany({
        where: {
          empresaId: ctx.empresaId,
          grupoOsId: grupoOsIdOf(atual),
          NOT: { id },
        },
        data: camposCompartilhados,
      });
    }

    if (statusMudou && deveRemoverControleEntregasPorStatus(atual.status, novoStatus)) {
      try {
        await removerTrabalhoControleEntregasAutomaticoServidor(
          ctx.empresaId,
          trabalho.numeroOs
        );
      } catch (err) {
        console.warn("[trabalhos/PUT] remoção controle entregas automático", err);
      }
    } else if (statusMudou && deveAdicionarControleEntregasPorStatus(atual.status, novoStatus)) {
      try {
        await adicionarTrabalhoControleEntregasAutomaticoServidor(ctx.empresaId, {
          id: trabalho.id,
          numeroOs: trabalho.numeroOs,
          tipoProtese: trabalho.tipoProtese,
          valor: trabalho.valor,
          cliente: trabalho.cliente,
        }, { origem: "status" });
      } catch (err) {
        console.warn("[trabalhos/PUT] controle entregas automático", err);
      }
    }

    const statusArquivaEntrega =
      novoStatus === STATUS_ENTREGUE_CLIENTE ||
      novoStatus === "recebido_cliente" ||
      novoStatus === "entregue";
    if (statusMudou && statusArquivaEntrega) {
      try {
        await concluirEntregasControlePorNumeroOsServidor(ctx.empresaId, trabalho.numeroOs, {
          situacao: novoStatus === "recebido_cliente" ? "recebido" : "entregue",
        });
      } catch (err) {
        console.warn("[trabalhos/PUT] arquivamento controle entregas", err);
      }
    }

    void notificarTvOrdensEmpresa(ctx.empresaId, id);

    return NextResponse.json(trabalho);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const mensagem = error.issues
        .map((issue) => {
          const campo = issue.path.length ? issue.path.join(".") : "dados";
          return `${campo}: ${issue.message}`;
        })
        .join("; ");
      return NextResponse.json({ error: mensagem || "Dados inválidos" }, { status: 400 });
    }
    console.error("PUT /api/trabalhos/[id]", error);
    return NextResponse.json({ error: "Não foi possível atualizar a OS." }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    const atual = await prisma.trabalho.findFirst({
      where: { id, empresaId: ctx.empresaId },
      include: { cliente: true },
    });
    if (!atual) return NextResponse.json({ ok: true });

    const grupo = await prisma.trabalho.findMany({
      where: whereGrupoOs(atual),
      select: { id: true, numeroOs: true },
    });
    const lancamentos = await prisma.lancamento.findMany({
      where: { tipo: "receita" },
      select: {
        id: true,
        status: true,
        descricao: true,
        trabalho: { select: { id: true, numeroOs: true } },
      },
    });
    const cobrancasAtivas = lancamentos.filter((l) => lancamentoFaturaOsAtivo(l));
    if (
      osEstaFaturadaContasReceber(
        atual.numeroOs,
        grupo.map((t) => t.id),
        cobrancasAtivas
      )
    ) {
      return NextResponse.json({ error: MENSAGEM_OS_FATURADA_NAO_EXCLUI }, { status: 409 });
    }

    await registrarLogAuditoria({
      empresaId: ctx.empresaId,
      categoria: "os",
      tipoAlteracao: "exclusao",
      numeroOs: atual.numeroOs,
      trabalhoId: atual.id,
      servico: formatServicoLogAuditoria(atual.tipoProtese, atual.id),
      clienteNome: formatClienteLogAuditoria(
        atual.cliente?.nome,
        atual.clienteId
      ),
      usuarioId: ctx.user.id,
      usuarioNome: await nomeUsuarioParaLogAuditoria(ctx.user),
    });

    if (atual.grupoOsId) {
      await prisma.trabalho.deleteMany({
        where: {
          empresaId: ctx.empresaId,
          grupoOsId: grupoOsIdOf(atual),
        },
      });
    } else {
      await prisma.trabalho.delete({ where: { id } });
    }
  } catch {
    return NextResponse.json({ ok: true });
  }
  void notificarTvOrdensEmpresa(ctx.empresaId, id);
  return NextResponse.json({ ok: true });
}
