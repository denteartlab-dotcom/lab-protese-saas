import {
  diaCobrancaCliente,
  diasDesde,
  ehDiaCobrancaHoje,
  limiteSaldoDevedorCliente,
  saldoDevedorCliente,
} from "@/lib/cliente-financeiro";
import { prisma } from "@/lib/db";
import { desempacotarDespesa } from "@/lib/lancamento-despesa";
import {
  filtrarTrabalhosAtrasados,
  filtrarTrabalhosVencendoPeriodo,
  formatDiaMesBr,
  periodoVencendoNotificacoes,
  prazoTrabalho,
} from "@/lib/controle-producao-prazos";
import {
  hrefClienteCobrancaDia,
  hrefClienteSaldoLimite,
  hrefControleServico,
  hrefLancamentoVencido,
  hrefOrcamento,
  hrefOsSemNota,
  hrefOsEditar,
} from "@/lib/notificacao-links";
import {
  lancamentoEhDespesaBoleto,
  lancamentoParaResumoBoleto,
  montarLinhaBoleto,
  montarNotificacoesBoletos,
} from "@/lib/controle-boletos";
import {
  carregarEnviosNotaVencida,
  deveNotificarNotaVencida,
  diasAtrasoVencimento,
  idNotificacaoNotaVencida,
  salvarEnviosNotaVencida,
} from "@/lib/nota-vencida-notificacao";
import {
  enriquecerLinksAcompanhamentoUrgentes,
  montarUrgentesClienteDashboard,
  podarEventosUrgenciaInativos,
} from "@/lib/urgencia-cliente";
import { carregarStoreObservacoesCliente } from "@/lib/observacao-cliente-trabalho";
import { calcularResumoEstoqueDashboardServer } from "@/lib/dashboard-estoque-server";
import {
  ALERTA_ARMAZENAMENTO_GB,
  LIMITE_ARMAZENAMENTO_BYTES,
  armazenamentoGaleriaEmAlerta,
  formatarTamanhoArmazenamento,
} from "@/lib/uploads-armazenamento";
import { calcularArmazenamentoGaleria } from "@/lib/uploads-armazenamento-server";

function vencimentoBr(data: Date) {
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export type NotificacaoApi = {
  id: string;
  kind:
    | "nota_vencida"
    | "despesa_vencendo"
    | "saldo_limite"
    | "orcamento_aguardando"
    | "orcamento_recebido"
    | "os_sem_nota"
    | "cobranca_dia"
    | "servico_vencendo"
    | "servico_atrasado"
    | "urgente_cliente"
    | "observacao_cliente"
    | "boleto_vencido"
    | "boleto_vencendo"
    | "armazenamento_quase_cheio";
  href: string;
  params: Record<string, string | number>;
  criadoEm: string;
};

export async function montarNotificacoesEmpresa(
  empresaId: string,
  opts?: { empresaSlug?: string; empresaNome?: string }
) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const [lancamentos, clientes, orcamentos, trabalhosAtivos] = await Promise.all([
    prisma.lancamento.findMany({
      where: { empresaId },
      include: {
        cliente: { select: { id: true, nome: true, observacoes: true } },
        trabalho: { select: { id: true, numeroOs: true } },
      },
      orderBy: { data: "desc" },
    }),
    prisma.cliente.findMany({ where: { empresaId, ativo: true } }),
    prisma.orcamento.findMany({
      where: {
        empresaId,
        status: { notIn: ["excluido", "cancelado"] },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.trabalho.findMany({
      where: {
        empresaId,
        status: { notIn: ["finalizado", "entregue", "cancelado"] },
      },
      include: {
        paciente: { select: { nome: true } },
      },
    }),
  ]);

  const lista: NotificacaoApi[] = [];
  const enviosNotaVencida = await carregarEnviosNotaVencida(empresaId);
  const enviosAtualizados = { ...enviosNotaVencida };
  let enviosAlterados = false;
  const idsReceitasVencidasPendentes = new Set<string>();

  function diasAteVencimento(vencimento: Date) {
    const venc = new Date(vencimento);
    venc.setHours(0, 0, 0, 0);
    return Math.round((venc.getTime() - hoje.getTime()) / 86400000);
  }

  for (const l of lancamentos) {
    if (l.tipo !== "despesa" || l.status !== "pendente") continue;
    const dias = diasAteVencimento(l.data);
    if (dias === 2) {
      const pack = desempacotarDespesa(l.descricao);
      lista.push({
        id: `despesa-vencendo-${l.id}`,
        kind: "despesa_vencendo",
        href: `/app/financeiro?tipo=despesa&lancamentoId=${encodeURIComponent(l.id)}`,
        params: {
          fornecedor: pack.nome,
          valor: l.valor.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
          parcela: pack.parcela,
          vencimento: vencimentoBr(l.data),
        },
        criadoEm: l.updatedAt.toISOString(),
      });
    }
  }

  const linhasBoletos = lancamentos
    .filter(lancamentoEhDespesaBoleto)
    .map((l) => montarLinhaBoleto(lancamentoParaResumoBoleto(l), hoje));
  for (const n of montarNotificacoesBoletos(linhasBoletos)) {
    lista.push(n);
  }

  for (const l of lancamentos) {
    if (l.tipo !== "receita" || l.status !== "pendente") continue;
    const diasAtraso = diasAtrasoVencimento(l.data, hoje);
    if (diasAtraso <= 0) continue;

    idsReceitasVencidasPendentes.add(l.id);

    if (!deveNotificarNotaVencida(diasAtraso, enviosAtualizados[l.id], hoje)) {
      continue;
    }

    const enviadoEm = hoje.toISOString();
    enviosAtualizados[l.id] = enviadoEm;
    enviosAlterados = true;

    lista.push({
      id: idNotificacaoNotaVencida(l.id, hoje),
      kind: "nota_vencida",
      href: hrefLancamentoVencido({
        id: l.id,
        clienteId: l.clienteId,
        descricao: l.descricao,
      }),
      params: {
        cliente: l.cliente?.nome || "Cliente",
        valor: l.valor,
        dias: diasAtraso,
      },
      criadoEm: enviadoEm,
    });
  }

  for (const lancamentoId of Object.keys(enviosAtualizados)) {
    if (!idsReceitasVencidasPendentes.has(lancamentoId)) {
      delete enviosAtualizados[lancamentoId];
      enviosAlterados = true;
    }
  }

  if (enviosAlterados) {
    await salvarEnviosNotaVencida(empresaId, enviosAtualizados);
  }

  const lancamentosResumo = lancamentos.map((l) => ({
    tipo: l.tipo,
    status: l.status,
    valor: l.valor,
    data: l.data,
    clienteId: l.clienteId,
    descricao: l.descricao,
  }));

  const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  for (const cliente of clientes) {
    const dia = diaCobrancaCliente(cliente.observacoes);
    if (dia == null || !ehDiaCobrancaHoje(dia, hoje)) continue;

    const saldo = saldoDevedorCliente(cliente.id, lancamentosResumo);
    lista.push({
      id: `cobranca-dia-${cliente.id}-${mesRef}`,
      kind: "cobranca_dia",
      href: hrefClienteCobrancaDia(cliente.id),
      params: {
        cliente: cliente.nome,
        dia,
        saldo: saldo.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
      },
      criadoEm: hoje.toISOString(),
    });
  }

  for (const cliente of clientes) {
    const limite = limiteSaldoDevedorCliente(cliente.observacoes);
    if (limite <= 0) continue;
    const saldo = saldoDevedorCliente(cliente.id, lancamentosResumo);
    if (saldo >= limite * 0.9) {
      lista.push({
        id: `saldo-limite-${cliente.id}`,
        kind: "saldo_limite",
        href: hrefClienteSaldoLimite(cliente.id),
        params: {
          cliente: cliente.nome,
          saldo,
          limite,
        },
        criadoEm: new Date().toISOString(),
      });
    }
  }

  for (const o of orcamentos) {
    if (
      o.status === "aguardando_resposta" ||
      o.status === "enviado" ||
      o.status === "pendente"
    ) {
      lista.push({
        id: `orc-aguardando-${o.id}`,
        kind: "orcamento_aguardando",
        href: hrefOrcamento(o.id, "abrir"),
        params: {
          pedido: o.numeroPedido,
          fornecedor: o.fornecedorNome || "Fornecedor",
        },
        criadoEm: o.updatedAt.toISOString(),
      });
    }
    if (o.dataResposta) {
      const dias = diasDesde(o.dataResposta);
      if (dias <= 7 && (o.status === "aprovado" || o.respostaFornecedor)) {
        lista.push({
          id: `orc-recebido-${o.id}`,
          kind: "orcamento_recebido",
          href: hrefOrcamento(o.id, "resposta"),
          params: {
            pedido: o.numeroPedido,
            fornecedor: o.fornecedorNome || "Fornecedor",
          },
          criadoEm: o.dataResposta.toISOString(),
        });
      }
    }
  }

  for (const l of lancamentos) {
    const desc = l.descricao.toLowerCase();
    if (l.tipo !== "receita" || l.status !== "pendente") continue;
    if (!desc.includes("cobrança") && !desc.includes("cobranca")) continue;
    if (!desc.includes("os")) continue;
    const dias = diasDesde(l.createdAt);
    if (dias >= 3) {
      lista.push({
        id: `os-sem-nota-${l.id}`,
        kind: "os_sem_nota",
        href: hrefOsSemNota({
          trabalhoId: l.trabalho?.id,
          numeroOs: l.trabalho?.numeroOs,
          clienteId: l.clienteId,
          lancamentoId: l.id,
        }),
        params: {
          numeroOs: l.trabalho?.numeroOs ?? "—",
          dias,
          cliente: l.cliente?.nome || "",
        },
        criadoEm: l.createdAt.toISOString(),
      });
    }
  }

  const periodoVencendo = periodoVencendoNotificacoes();
  const vencendo = filtrarTrabalhosVencendoPeriodo(trabalhosAtivos, "lab", periodoVencendo);
  const atrasados = filtrarTrabalhosAtrasados(trabalhosAtivos, "lab");

  for (const t of vencendo) {
    const prazo = prazoTrabalho(t, "lab");
    lista.push({
      id: `servico-vencendo-${t.id}`,
      kind: "servico_vencendo",
      href: hrefControleServico(t.id, "vencendo", { prazo: "lab", dia: periodoVencendo }),
      params: {
        numeroOs: t.numeroOs,
        servico: t.tipoProtese,
        paciente: t.paciente?.nome || "—",
        prazo: prazo ? formatDiaMesBr(prazo) : "—",
      },
      criadoEm: new Date().toISOString(),
    });
  }

  for (const t of atrasados) {
    const prazo = prazoTrabalho(t, "lab");
    lista.push({
      id: `servico-atrasado-${t.id}`,
      kind: "servico_atrasado",
      href: hrefControleServico(t.id, "atrasados", { prazo: "lab" }),
      params: {
        numeroOs: t.numeroOs,
        servico: t.tipoProtese,
        paciente: t.paciente?.nome || "—",
        prazo: prazo ? formatDiaMesBr(prazo) : "—",
      },
      criadoEm: new Date().toISOString(),
    });
  }

  const storeUrgencias = await podarEventosUrgenciaInativos(empresaId);
  const mapaTrabalhosUrgencia = new Map(
    trabalhosAtivos.map((t) => [
      t.id,
      { status: t.status, tipoProtese: t.tipoProtese, instrucoes: t.instrucoes },
    ])
  );
  const urgentesCliente = await enriquecerLinksAcompanhamentoUrgentes(
    montarUrgentesClienteDashboard(storeUrgencias.eventos, mapaTrabalhosUrgencia)
  );
  for (const u of urgentesCliente) {
    lista.push({
      id: `urgente-cliente-${u.trabalhoId}`,
      kind: "urgente_cliente",
      href: u.linkAcompanhamento || hrefOsEditar(u.trabalhoId),
      params: {
        numeroOs: u.numeroOs,
        cliente: u.clienteNome,
        paciente: u.pacienteNome,
        servico: u.tipoProtese,
      },
      criadoEm: u.criadoEm,
    });
  }

  const storeObservacoes = await carregarStoreObservacoesCliente(empresaId);
  const notificacoesObservacoes: NotificacaoApi[] = storeObservacoes.eventos
    .slice()
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .slice(0, 50)
    .map((evento) => ({
      id: `observacao-cliente-${evento.id}`,
      kind: "observacao_cliente",
      href: hrefOsEditar(evento.trabalhoId),
      params: {
        numeroOs: evento.numeroOs,
        cliente: evento.clienteNome,
        paciente: evento.pacienteNome,
        servico: evento.tipoProtese,
        texto:
          evento.texto.length > 240
            ? `${evento.texto.slice(0, 237)}...`
            : evento.texto,
      },
      criadoEm: evento.criadoEm,
    }));
  // Observações enviadas pelo cliente precisam aparecer primeiro no sino.
  lista.unshift(...notificacoesObservacoes);

  if (opts?.empresaSlug) {
    const armazenamento = await calcularArmazenamentoGaleria(
      empresaId,
      opts.empresaSlug,
      opts.empresaNome
    );
    if (
      armazenamentoGaleriaEmAlerta(
        armazenamento.bytesUsados,
        armazenamento.limiteBytes ?? LIMITE_ARMAZENAMENTO_BYTES
      )
    ) {
      lista.unshift({
        id: "armazenamento-quase-cheio",
        kind: "armazenamento_quase_cheio",
        href: "/app/liberar-espaco",
        params: {
          usado: formatarTamanhoArmazenamento(armazenamento.bytesUsados),
          limiteGb: ALERTA_ARMAZENAMENTO_GB,
          totalGb: armazenamento.limiteGb,
        },
        criadoEm: new Date().toISOString(),
      });
    }
  }

  const unicos = new Map<string, NotificacaoApi>();
  for (const n of lista) {
    if (!unicos.has(n.id)) unicos.set(n.id, n);
  }

  const notificacoes = Array.from(unicos.values()).slice(0, 50);
  return {
    notificacoes,
    total: unicos.size,
  };
}

export async function montarNotificacoesResumoCompleto(
  empresaId: string,
  opts?: { empresaSlug?: string; empresaNome?: string }
) {
  const [base, estoque, produtos] = await Promise.all([
    montarNotificacoesEmpresa(empresaId, opts),
    calcularResumoEstoqueDashboardServer(empresaId),
    prisma.produto.findMany({
      where: { empresaId, ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return {
    ...base,
    contadores: {
      total: base.total,
      estoqueBaixo: estoque.baixo,
      estoqueZerado: estoque.zerado,
    },
    produtosEstoque: produtos,
  };
}
