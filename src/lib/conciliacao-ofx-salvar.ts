import type { ContaBancaria } from "@/lib/conta-bancaria";
import type { ExtratoMovimentacao } from "@/lib/extrato-bancario";
import type { LancamentoConciliacao } from "@/lib/conciliacao-ofx-procedimento";
import { empacotarDespesa, desempacotarDespesa } from "@/lib/lancamento-despesa";
import { empacotarReceitaConta } from "@/lib/receita-conta-bancaria";
import { resumirDescricaoOfx, type MovimentacaoOfx } from "@/lib/extrato-ofx";

function isoParaDataApi(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formaPagamentoDaLinha(forma: string) {
  if (forma === "PIX") return "PIX";
  if (forma === "TED") return "TED";
  if (forma === "DOC") return "DOC";
  if (forma === "Boleto") return "Boleto";
  return forma && forma !== "Crédito" && forma !== "Débito" ? forma : "Transferência";
}

export async function salvarConciliacaoNaConta(input: {
  conta: ContaBancaria;
  linhas: MovimentacaoOfx[];
  procedimentos: Record<string, string>;
  lancamentos: LancamentoConciliacao[];
  resumirDescricao: boolean;
}): Promise<ExtratoMovimentacao[]> {
  const { conta, linhas, procedimentos, lancamentos, resumirDescricao } = input;
  const movimentacoesExtrato: ExtratoMovimentacao[] = [];
  const mapaLanc = new Map(lancamentos.map((l) => [l.id, l]));

  for (const linha of linhas) {
    const procId = procedimentos[linha.id]?.trim();
    const descricaoLinha = resumirDescricao
      ? resumirDescricaoOfx(linha.descricao)
      : linha.descricao;

    if (procId) {
      const lanc = mapaLanc.get(procId);
      if (!lanc) continue;

      const payload: Record<string, unknown> = {
        status: "pago",
        data: isoParaDataApi(linha.data),
        formaPagamento: formaPagamentoDaLinha(linha.forma),
      };

      if (lanc.tipo === "despesa") {
        const pack = desempacotarDespesa(lanc.descricao);
        payload.descricao = empacotarDespesa(pack.texto, {
          ...pack.meta,
          conta: conta.nome,
        });
      } else {
        payload.descricao = empacotarReceitaConta(lanc.descricao, conta.nome);
      }

      const res = await fetch(`/api/financeiro/${procId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error || "Não foi possível vincular o lançamento.");
      }
      continue;
    }

    movimentacoesExtrato.push({
      id: `conc-${linha.id}-${Date.now()}`,
      contaId: conta.id,
      tipo: linha.tipo === "credito" ? "entrada" : "saida",
      valor: linha.valor,
      descricao: descricaoLinha,
      data: linha.data,
      origem: "arquivo",
      idExterno: linha.fitid || linha.id,
    });
  }

  return movimentacoesExtrato;
}
