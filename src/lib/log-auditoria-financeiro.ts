import type { SessionUser } from "@/lib/auth";
import {
  parseParcelaNaDescricao,
  proximoNumeroFaturaReceita,
} from "@/lib/fatura-financeiro";
import {
  nomeUsuarioParaLogAuditoria,
  registrarLogAuditoria,
  type DetalheAlteracaoAuditoria,
} from "@/lib/logs-auditoria";

type LancamentoAudit = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  status: string;
  formaPagamento?: string | null;
  data: Date;
  cliente?: { nome?: string | null } | null;
  trabalho?: { numeroOs?: number | null } | null;
};

export type OpcoesAuditoriaLancamento = {
  boleto?: boolean;
  parcelaNumero?: number;
  parcelaTotal?: number;
  numeroFatura?: number;
  eventoRecebimento?: boolean;
  /** Evita nova consulta ao usuário em lote de parcelas. */
  usuarioNome?: string;
};

function moneyBr(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataBr(value: Date) {
  return value.toLocaleDateString("pt-BR");
}

function resolverParcela(
  lancamento: LancamentoAudit,
  opts?: OpcoesAuditoriaLancamento
) {
  const parsed = parseParcelaNaDescricao(lancamento.descricao);
  const numero = opts?.parcelaNumero ?? parsed?.numero ?? 1;
  const total = opts?.parcelaTotal ?? parsed?.total ?? 1;
  return { numero, total, temParcelamento: total > 1 };
}

function categoriaPorTipoLancamento(
  tipo: string,
  opts?: OpcoesAuditoriaLancamento & { temParcelamento?: boolean }
) {
  if (opts?.boleto) return "boletos";
  if (opts?.eventoRecebimento) return "financeiro_receitas_recebimentos";
  if (tipo === "receita") {
    return "financeiro_receitas_parcelas";
  }
  if (opts?.temParcelamento) return "despesas_pagamentos_parcelas";
  return "despesas";
}

function detalhesLancamento(l: LancamentoAudit): DetalheAlteracaoAuditoria[] {
  return [
    { campo: "Descrição", antes: "—", depois: l.descricao },
    { campo: "Valor", antes: "—", depois: moneyBr(l.valor) },
    { campo: "Vencimento", antes: "—", depois: dataBr(l.data) },
    { campo: "Situação", antes: "—", depois: l.status },
    {
      campo: "Forma pagamento",
      antes: "—",
      depois: l.formaPagamento || "—",
    },
  ];
}

function diffLancamento(
  antes: LancamentoAudit,
  depois: LancamentoAudit
): DetalheAlteracaoAuditoria[] {
  const detalhes: DetalheAlteracaoAuditoria[] = [];
  const add = (campo: string, a: string, d: string) => {
    if (a !== d) detalhes.push({ campo, antes: a, depois: d });
  };
  add("Descrição", antes.descricao, depois.descricao);
  add("Valor", moneyBr(antes.valor), moneyBr(depois.valor));
  add("Vencimento", dataBr(antes.data), dataBr(depois.data));
  add("Situação", antes.status, depois.status);
  add("Forma pagamento", antes.formaPagamento || "—", depois.formaPagamento || "—");
  return detalhes;
}

async function resolverNumeroFaturaReceita(
  lancamento: LancamentoAudit,
  opts?: OpcoesAuditoriaLancamento
) {
  if (lancamento.tipo !== "receita") return null;
  if (opts?.numeroFatura) return opts.numeroFatura;
  return proximoNumeroFaturaReceita();
}

export async function auditarCriacaoLancamento(
  session: SessionUser,
  lancamento: LancamentoAudit,
  opts?: OpcoesAuditoriaLancamento
) {
  const parcela = resolverParcela(lancamento, opts);
  const numeroFatura = await resolverNumeroFaturaReceita(lancamento, opts);
  const categoria = categoriaPorTipoLancamento(lancamento.tipo, {
    ...opts,
    temParcelamento: parcela.temParcelamento,
  });

  await registrarLogAuditoria({
    categoria,
    tipoAlteracao: "inclusao",
    lancamentoId: lancamento.id,
    referencia:
      numeroFatura != null ? String(numeroFatura) : lancamento.id.slice(-8).toUpperCase(),
    clienteNome: lancamento.cliente?.nome?.trim() || "—",
    numeroOs: lancamento.trabalho?.numeroOs ?? null,
    parcelaNumero: parcela.numero,
    parcelaTotal: parcela.total,
    usuarioId: session.id,
    usuarioNome:
      opts?.usuarioNome ?? (await nomeUsuarioParaLogAuditoria(session)),
    detalhes: detalhesLancamento(lancamento),
  });

  return { numeroFatura };
}

/** Várias parcelas de despesa em uma única gravação (uma consulta de usuário). */
export async function auditarCriacaoDespesasParceladas(
  session: SessionUser,
  lancamentos: LancamentoAudit[]
) {
  if (!lancamentos.length) return;
  const usuarioNome = await nomeUsuarioParaLogAuditoria(session);
  const total = lancamentos.length;
  for (let i = 0; i < lancamentos.length; i++) {
    await auditarCriacaoLancamento(session, lancamentos[i], {
      usuarioNome,
      parcelaNumero: i + 1,
      parcelaTotal: total,
    });
  }
}

export async function auditarAlteracaoLancamento(
  session: SessionUser,
  antes: LancamentoAudit,
  depois: LancamentoAudit,
  opts?: OpcoesAuditoriaLancamento
) {
  const detalhes = diffLancamento(antes, depois);
  if (!detalhes.length) return;

  const parcela = resolverParcela(depois, opts);
  let tipoAlteracao: "alteracao" | "inclusao" = "alteracao";
  let pagamentoDespesa = false;

  if (
    antes.tipo === "receita" &&
    antes.status !== "pago" &&
    depois.status === "pago"
  ) {
    detalhes.push({
      campo: "Recebimento",
      antes: "Pendente",
      depois: "Confirmado",
    });
  } else if (
    antes.tipo === "despesa" &&
    antes.status !== "pago" &&
    depois.status === "pago"
  ) {
    pagamentoDespesa = true;
  }

  const numeroFatura =
    depois.tipo === "receita"
      ? opts?.numeroFatura ?? (await mapNumeroFaturaFromLancamento(depois.id))
      : null;

  await registrarLogAuditoria({
    categoria: categoriaPorTipoLancamento(depois.tipo, {
      boleto: opts?.boleto,
      temParcelamento: pagamentoDespesa || parcela.temParcelamento,
    }),
    tipoAlteracao,
    lancamentoId: depois.id,
    referencia:
      numeroFatura != null
        ? String(numeroFatura)
        : depois.id.slice(-8).toUpperCase(),
    clienteNome: depois.cliente?.nome?.trim() || "—",
    numeroOs: depois.trabalho?.numeroOs ?? null,
    parcelaNumero: parcela.numero,
    parcelaTotal: parcela.total,
    usuarioId: session.id,
    usuarioNome: await nomeUsuarioParaLogAuditoria(session),
    detalhes,
  });
}

async function mapNumeroFaturaFromLancamento(lancamentoId: string) {
  const { mapNumeroFaturaPorLancamentoIds } = await import("@/lib/fatura-financeiro");
  const mapa = await mapNumeroFaturaPorLancamentoIds([lancamentoId]);
  return mapa.get(lancamentoId);
}

export async function auditarExclusaoLancamento(
  session: SessionUser,
  lancamento: LancamentoAudit,
  opts?: OpcoesAuditoriaLancamento
) {
  const parcela = resolverParcela(lancamento, opts);
  const numeroFatura =
    lancamento.tipo === "receita"
      ? opts?.numeroFatura ?? (await mapNumeroFaturaFromLancamento(lancamento.id))
      : null;

  await registrarLogAuditoria({
    categoria: categoriaPorTipoLancamento(lancamento.tipo, {
      ...opts,
      temParcelamento: parcela.temParcelamento,
    }),
    tipoAlteracao: "exclusao",
    lancamentoId: lancamento.id,
    referencia:
      numeroFatura != null
        ? String(numeroFatura)
        : lancamento.id.slice(-8).toUpperCase(),
    clienteNome: lancamento.cliente?.nome?.trim() || "—",
    numeroOs: lancamento.trabalho?.numeroOs ?? null,
    parcelaNumero: parcela.numero,
    parcelaTotal: parcela.total,
    usuarioId: session.id,
    usuarioNome: await nomeUsuarioParaLogAuditoria(session),
    detalhes: detalhesLancamento(lancamento).map((d) => ({
      campo: d.campo,
      antes: d.depois,
      depois: "—",
    })),
  });
}

/** Várias parcelas de receita na mesma fatura (nota com parcelamento). */
export async function auditarCriacaoReceitasParceladas(
  session: SessionUser,
  lancamentos: LancamentoAudit[]
) {
  if (!lancamentos.length) return;
  const numeroFatura = await proximoNumeroFaturaReceita();
  const usuarioNome = await nomeUsuarioParaLogAuditoria(session);
  const total = lancamentos.length;

  for (let i = 0; i < lancamentos.length; i++) {
    await auditarCriacaoLancamento(session, lancamentos[i], {
      numeroFatura,
      parcelaNumero: i + 1,
      parcelaTotal: total,
      usuarioNome,
    });
  }

  return numeroFatura;
}
