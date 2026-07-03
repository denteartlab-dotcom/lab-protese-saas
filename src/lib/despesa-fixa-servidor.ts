import { prisma } from "@/lib/db";
import { findLancamentosFinanceiro } from "@/lib/lancamentos-cobranca";
import { descricaoDespesaComParcela } from "@/lib/lancamento-despesa";
import {
  desempacotarDespesa,
  empacotarDespesa,
  type DespesaMeta,
} from "@/lib/lancamento-despesa";
import { brShortToIso } from "@/lib/datas-br";
import {
  extrairGruposDespesaFixaAtivos,
  extrairTemplateDespesaFixa,
  grupoFixaTemInstanciaNoMes,
  instanciaFixaEhFutura,
  mesIgnoradoDespesaFixa,
  mesReferenciaAtual,
  metaDespesaFixa,
  parcelasInstanciaFixaNoMes,
  podeGerarInstanciaFixaMesCorrente,
  type LancamentoDespesaFixa,
  vencimentoParcelaNoMes,
} from "@/lib/despesa-fixa";

function parseDateOnly(value?: string) {
  if (!value) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

type ParcelaApiDespesa = {
  valor: number;
  data: string;
  status: "pendente" | "pago";
  formaPagamento: string;
  parcelaLabel: string;
};

function lancamentosParaDespesaFixa(
  lancamentos: Awaited<ReturnType<typeof findLancamentosFinanceiro>>
): LancamentoDespesaFixa[] {
  return lancamentos.map((l) => ({
    id: l.id,
    descricao: l.descricao,
    valor: l.valor,
    data: l.data instanceof Date ? l.data.toISOString() : String(l.data),
    status: l.status,
    formaPagamento: l.formaPagamento,
  }));
}

async function criarDespesaServidor(
  empresaId: string,
  descricaoBase: string,
  parcelasApi: ParcelaApiDespesa[]
) {
  if (parcelasApi.length === 0) return;

  if (parcelasApi.length === 1) {
    const parcela = parcelasApi[0];
    await prisma.lancamento.create({
      data: {
        empresaId,
        tipo: "despesa",
        descricao: descricaoDespesaComParcela(descricaoBase, parcela.parcelaLabel),
        valor: parcela.valor,
        data: parseDateOnly(parcela.data),
        status: parcela.status,
        formaPagamento: parcela.formaPagamento,
      },
    });
    return;
  }

  await prisma.$transaction(
    parcelasApi.map((p, i) => {
      const n = i + 1;
      const total = parcelasApi.length;
      return prisma.lancamento.create({
        data: {
          empresaId,
          tipo: "despesa",
          descricao: descricaoDespesaComParcela(descricaoBase, `${n}/${total}`),
          valor: p.valor,
          data: parseDateOnly(p.data),
          status: p.status,
          formaPagamento: p.formaPagamento,
        },
      });
    })
  );
}

async function limparInstanciasFixasFuturasServidor(
  empresaId: string,
  lancamentos: LancamentoDespesaFixa[]
) {
  let removidos = 0;
  for (const item of lancamentos) {
    const pack = desempacotarDespesa(item.descricao);
    if (!pack.meta.fixa || pack.meta.fixaAtiva === false) continue;
    if (!instanciaFixaEhFutura(item)) continue;

    const deleted = await prisma.lancamento.deleteMany({
      where: { id: item.id, empresaId },
    });
    removidos += deleted.count;
  }
  return removidos;
}

async function sincronizarDespesasFixaServidor(
  empresaId: string,
  lancamentos: LancamentoDespesaFixa[]
) {
  const grupos = extrairGruposDespesaFixaAtivos(lancamentos);
  if (!grupos.length) return 0;

  let criados = 0;
  const mesAtual = mesReferenciaAtual();

  for (const grupoId of grupos) {
    const template = extrairTemplateDespesaFixa(lancamentos, grupoId);
    if (!template) continue;

    if (!podeGerarInstanciaFixaMesCorrente(mesAtual, lancamentos, grupoId)) continue;
    if (grupoFixaTemInstanciaNoMes(lancamentos, grupoId, mesAtual)) continue;
    if (mesIgnoradoDespesaFixa(lancamentos, grupoId, mesAtual)) continue;

    const parcelasMes = parcelasInstanciaFixaNoMes(template, mesAtual);
    if (!parcelasMes.length) continue;

    if (parcelasMes.length === 1) {
      const parcela = parcelasMes[0];
      await criarDespesaServidor(
        empresaId,
        empacotarDespesa(
          template.textoBase,
          metaDespesaFixa(
            {
              ...template.metaBase,
              conta: parcela.conta,
              parcela: "1",
            } as DespesaMeta,
            template.grupoId,
            mesAtual,
            template.diaVencimento
          )
        ),
        [
          {
            valor: parcela.valor,
            data: brShortToIso(parcela.vencimento) || "",
            status: "pendente",
            formaPagamento: parcela.formaPagamento,
            parcelaLabel: parcela.parcela,
          },
        ]
      );
      criados += 1;
    } else {
      const descricaoBase = empacotarDespesa(
        template.textoBase,
        metaDespesaFixa(
          {
            ...template.metaBase,
            conta: parcelasMes[0].conta,
            parcela: String(parcelasMes.length),
          } as DespesaMeta,
          template.grupoId,
          mesAtual,
          template.diaVencimento
        )
      );
      await criarDespesaServidor(
        empresaId,
        descricaoBase,
        parcelasMes.map((parcela, index) => ({
          valor: parcela.valor,
          data:
            brShortToIso(
              vencimentoParcelaNoMes(mesAtual, template.diaVencimento, index)
            ) || "",
          status: "pendente" as const,
          formaPagamento: parcela.formaPagamento,
          parcelaLabel: parcela.parcela,
        }))
      );
      criados += parcelasMes.length;
    }
  }

  return criados;
}

/** Carrega despesas com sync de fixas no servidor (evita N+1 no cliente). */
export async function carregarDespesasPainelServidor(empresaId: string) {
  let lancamentos = await findLancamentosFinanceiro({
    where: { empresaId, tipo: "despesa" },
    orderBy: { data: "desc" },
  });

  let listaFixa = lancamentosParaDespesaFixa(lancamentos);
  const removidos = await limparInstanciasFixasFuturasServidor(empresaId, listaFixa);
  if (removidos > 0) {
    lancamentos = await findLancamentosFinanceiro({
      where: { empresaId, tipo: "despesa" },
      orderBy: { data: "desc" },
    });
    listaFixa = lancamentosParaDespesaFixa(lancamentos);
  }

  const criados = await sincronizarDespesasFixaServidor(empresaId, listaFixa);
  if (criados > 0) {
    lancamentos = await findLancamentosFinanceiro({
      where: { empresaId, tipo: "despesa" },
      orderBy: { data: "desc" },
    });
  }

  return lancamentos;
}
