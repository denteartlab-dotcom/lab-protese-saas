import {
  idsTrabalhosFaturadosNoLancamento,
  numerosOsDoLancamentoFatura,
} from "@/lib/os-faturamento";
import type { LinhaRelatorioContasReceber } from "@/lib/relatorio-contas-receber";
import {
  recebidoNaFatura,
  saldoFatura,
  textoParcelaLancamento,
  type LancamentoContasReceber,
  type TrabalhoContasReceber,
} from "@/lib/contas-receber-financeiro";
import { formatDate } from "@/lib/utils";
import { valorLiquidoDeLinhaItemAdicionado } from "@/lib/trabalho-os-segmento";

export type TrabalhoRelatorioFatura = TrabalhoContasReceber & {
  tipoProtese?: string;
  valor?: number;
  dentes?: string | null;
  cor?: string | null;
  instrucoes?: string | null;
  dataEntrega?: string | null;
  dataPrevista?: string | null;
  cliente?: { id?: string | null; nome?: string | null; cro?: string | null } | null;
};

export type ItemFaturaModelo3 = {
  os: string;
  descricao: string;
  numDente: string;
  paciente: string;
  dentista: string;
  qtd: string;
  valorUn: number;
  descPercent: string;
  subtotal: number;
};

export type ParcelaFaturaModelo3 = {
  parcela: string;
  vencimento: string;
  formaPagamento: string;
  valor: number;
  recebido: number;
  saldo: number;
};

export type FaturaModelo3Bloco = {
  numeroFatura: number;
  cliente: string;
  dataEmissao: string;
  itens: ItemFaturaModelo3[];
  parcelas: ParcelaFaturaModelo3[];
  totalFatura: number;
  descontoFatura: number;
  juros: number;
  totalRecebido: number;
  saldo: number;
};

function parseMoney(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(normalized) || 0;
}

function dentistaDoTrabalho(trabalho: TrabalhoRelatorioFatura) {
  const linha = (trabalho.instrucoes || "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^Dentista:/i.test(l));
  if (linha) return linha.replace(/^Dentista:\s*/i, "").trim() || "—";
  return trabalho.cliente?.nome?.trim() || "—";
}

/** Nome do paciente da OS (string, objeto { nome } ou linha nas instruções). */
export function nomePacienteTrabalho(trabalho: TrabalhoRelatorioFatura): string {
  const p = trabalho.paciente as string | { nome?: string | null } | null | undefined;
  if (typeof p === "string" && p.trim()) return p.trim();
  if (p && typeof p === "object" && typeof p.nome === "string" && p.nome.trim()) {
    return p.nome.trim();
  }
  const linha = (trabalho.instrucoes || "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^Paciente:\s*/i.test(l));
  if (linha) {
    const nome = linha.replace(/^Paciente:\s*/i, "").trim();
    if (nome) return nome;
  }
  return "—";
}

function valorNumericoTrabalho(valor: unknown) {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string") {
    const n = Number(valor.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function totalItensInstrucoes(trabalho: {
  instrucoes?: string | null;
}) {
  const linhasItens = (trabalho.instrucoes || "")
    .split("\n")
    .filter((line) => line.trim().startsWith("Item adicionado:"));
  return linhasItens.reduce((sum, line) => {
    const liquido = valorLiquidoDeLinhaItemAdicionado(line);
    return sum + (liquido ?? 0);
  }, 0);
}

/** Valor da OS: itens nas instruções têm prioridade (extrato/faturas); senão usa o campo `valor`. */
export function valorTrabalho(trabalho: {
  instrucoes?: string | null;
  valor?: number;
  tipoProtese?: string | null;
}) {
  const totalLiquido = totalItensInstrucoes(trabalho);
  if (totalLiquido > 0) return totalLiquido;
  return valorNumericoTrabalho(trabalho.valor);
}

function ajustarItensAoValorTrabalho(
  itens: ItemFaturaModelo3[],
  valorAtual: number
): ItemFaturaModelo3[] {
  const totalItens = itens.reduce((sum, item) => sum + item.subtotal, 0);
  if (totalItens <= 0 || Math.abs(valorAtual - totalItens) <= 0.009) return itens;

  if (itens.length === 1) {
    const item = itens[0];
    const qtdNum = Number(item.qtd.replace(",", ".")) || 1;
    return [{ ...item, valorUn: valorAtual / qtdNum, subtotal: valorAtual }];
  }

  const fator = valorAtual / totalItens;
  return itens.map((item) => ({
    ...item,
    valorUn: item.valorUn * fator,
    subtotal: item.subtotal * fator,
  }));
}

export function itensDoTrabalho(trabalho: TrabalhoRelatorioFatura): ItemFaturaModelo3[] {
  const paciente = nomePacienteTrabalho(trabalho);
  const dentista = dentistaDoTrabalho(trabalho);
  const os = String(trabalho.numeroOs);

  const itens = (trabalho.instrucoes || "")
    .split("\n")
    .map((line) => {
      const match = line.match(
        /^Item adicionado:\s*(.*?)\s*-\s*dentes\s*(.*?)\s*-\s*cor\s*(.*?)\s*-\s*qtd\s*(.*?)\s*-\s*valor\s*(.*)$/i
      );
      if (!match) return null;
      const qtd = match[4]?.trim() || "1";
      const valorBruto = parseMoney(
        line.match(
          / - valor (.*?)(?: - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
        )?.[1] ||
          match[5] ||
          ""
      );
      const valorLinha = valorLiquidoDeLinhaItemAdicionado(line) ?? valorBruto;
      const qtdNum = Number(qtd.replace(",", ".")) || 1;
      const valorUn = qtdNum > 0 ? valorLinha / qtdNum : valorLinha;
      const descMatch = line.match(/ - desc(?:onto)?\s*([^-]+?)(?: - situação| - produtoId|$)/i);
      const descPercent = descMatch?.[1]?.trim() || "0,00";
      return {
        os,
        descricao: match[1]?.trim() || trabalho.tipoProtese || "—",
        numDente: match[2]?.trim() || trabalho.dentes || "—",
        paciente,
        dentista,
        qtd,
        valorUn,
        descPercent,
        subtotal: valorLinha,
      };
    })
    .filter(Boolean) as ItemFaturaModelo3[];

  if (itens.length) {
    return ajustarItensAoValorTrabalho(itens, valorTrabalho(trabalho));
  }

  const valor = valorTrabalho(trabalho);
  return [
    {
      os,
      descricao: trabalho.tipoProtese || "—",
      numDente: trabalho.dentes || "—",
      paciente,
      dentista,
      qtd: "1",
      valorUn: valor,
      descPercent: "0,00",
      subtotal: valor,
    },
  ];
}

export function chaveAgrupamentoFatura(lancamento: LancamentoContasReceber) {
  const desc = lancamento.descricao
    .replace(/@@trab:[^@]+@@/gi, "")
    .replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/gi, "")
    .trim()
    .toLowerCase();
  return `${lancamento.cliente?.id ?? lancamento.cliente?.nome ?? ""}|${desc}`;
}

export function trabalhoPertenceAoCliente(
  trabalho: TrabalhoRelatorioFatura,
  clienteId?: string | null,
  clienteNome?: string | null
) {
  const nomeNorm = clienteNome?.trim().toLowerCase();
  const tId = trabalho.cliente?.id;
  const tNome = trabalho.cliente?.nome?.trim().toLowerCase();
  if (clienteId && tId) return clienteId === tId;
  if (nomeNorm && tNome) return nomeNorm === tNome;
  return false;
}

export function filtrarTrabalhosCliente(
  trabalhos: TrabalhoRelatorioFatura[],
  clienteId?: string | null,
  clienteNome?: string | null
) {
  if (!clienteId && !clienteNome?.trim()) return trabalhos;
  return trabalhos.filter((t) => trabalhoPertenceAoCliente(t, clienteId, clienteNome));
}

export function trabalhosDaFatura(
  lancamento: LancamentoContasReceber,
  trabalhos: TrabalhoRelatorioFatura[]
) {
  const ids = new Set(idsTrabalhosFaturadosNoLancamento(lancamento));
  const numeros = numerosOsDoLancamentoFatura(lancamento);
  const temMetaIds = /@@trab:[^@]+@@/i.test(lancamento.descricao);
  const clienteId = lancamento.cliente?.id;
  const clienteNome = lancamento.cliente?.nome;

  return trabalhos.filter((t) => {
    if (!trabalhoPertenceAoCliente(t, clienteId, clienteNome)) return false;
    if (ids.has(t.id)) return true;
    if (temMetaIds) return false;
    return numeros.includes(t.numeroOs);
  });
}

function dataEmissaoLancamento(lancamento: LancamentoContasReceber) {
  const d = lancamento.createdAt ? new Date(lancamento.createdAt) : new Date(lancamento.data);
  return formatDate(d.toISOString());
}

export function montarFaturasModelo3(
  linhas: LinhaRelatorioContasReceber[],
  lancamentos: LancamentoContasReceber[],
  trabalhos: TrabalhoRelatorioFatura[]
): FaturaModelo3Bloco[] {
  const mapaLanc = new Map(lancamentos.map((l) => [l.id, l]));
  const receitas = lancamentos.filter((l) => l.tipo === "receita");

  const grupos = new Map<string, LinhaRelatorioContasReceber[]>();
  for (const linha of linhas) {
    const lanc = mapaLanc.get(linha.lancamentoId);
    if (!lanc) continue;
    const chave = chaveAgrupamentoFatura(lanc);
    const lista = grupos.get(chave) ?? [];
    lista.push(linha);
    grupos.set(chave, lista);
  }

  const blocos: FaturaModelo3Bloco[] = [];

  for (const linhasGrupo of grupos.values()) {
    const lancamentosGrupo = linhasGrupo
      .map((l) => mapaLanc.get(l.lancamentoId))
      .filter(Boolean) as LancamentoContasReceber[];
    if (!lancamentosGrupo.length) continue;

    const principal = lancamentosGrupo[0];
    const trabalhosRelacionados = new Map<string, TrabalhoRelatorioFatura>();
    for (const lanc of lancamentosGrupo) {
      for (const t of trabalhosDaFatura(lanc, trabalhos)) {
        trabalhosRelacionados.set(t.id, t);
      }
    }

    const itens: ItemFaturaModelo3[] = [];
    for (const t of trabalhosRelacionados.values()) {
      itens.push(...itensDoTrabalho(t));
    }

    const parcelas: ParcelaFaturaModelo3[] = linhasGrupo.map((linha) => {
      const lanc = mapaLanc.get(linha.lancamentoId)!;
      return {
        parcela: textoParcelaLancamento(lanc),
        vencimento: linha.vencimento,
        formaPagamento: linha.formaRecebimento,
        valor: linha.valor,
        recebido: recebidoNaFatura(lanc, receitas),
        saldo: saldoFatura(lanc, receitas),
      };
    });

    const totalItens = itens.reduce((s, i) => s + i.subtotal, 0);
    const totalParcelas = parcelas.reduce((s, p) => s + p.valor, 0);
    const totalFatura = totalItens > 0 ? totalItens : totalParcelas;
    const descontoFatura = Math.max(0, totalItens - totalParcelas);
    const juros = Math.max(0, totalParcelas - totalItens);
    const totalRecebido = parcelas.reduce((s, p) => s + p.recebido, 0);
    const saldo = parcelas.reduce((s, p) => s + p.saldo, 0);

    const numeroFatura = Math.min(...linhasGrupo.map((l) => l.numeroFatura));

    blocos.push({
      numeroFatura,
      cliente: linhasGrupo[0].cliente,
      dataEmissao: dataEmissaoLancamento(principal),
      itens,
      parcelas,
      totalFatura,
      descontoFatura,
      juros,
      totalRecebido,
      saldo,
    });
  }

  blocos.sort((a, b) => a.numeroFatura - b.numeroFatura);
  return blocos;
}
