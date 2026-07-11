"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { Modal } from "@/components/ui";
import type { LancamentoContasReceber } from "@/lib/contas-receber-financeiro";
import {
  classeReferenciaHistoricoRecebimento,
  referenciaLancamento,
  valorHistoricoRecebimentoCliente,
} from "@/lib/contas-receber-financeiro";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  clienteNome: string;
  numeroFatura: number;
  movimentacoes: LancamentoContasReceber[];
  lancamentos: LancamentoContasReceber[];
  money: (value: number) => string;
  formatDate: (iso: string) => string;
  formaPagamentoExibicao: (l: LancamentoContasReceber) => string;
};

export function MovimentacoesRecebimentoModal({
  open,
  onClose,
  clienteNome,
  numeroFatura,
  movimentacoes,
  lancamentos,
  money,
  formatDate,
  formaPagamentoExibicao,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Movimentações do Recebimento"
      size="xl"
      layerClassName="z-[85]"
    >
      <div className="space-y-4 text-[11px] text-slate-600">
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <p>
            <strong>Cliente:</strong> {clienteNome}
          </p>
          <p>
            <strong>Fatura:</strong> #{numeroFatura}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-2 py-2 text-left">Data</th>
                <th className="px-2 py-2 text-left">Forma Pagamento</th>
                <th className="px-2 py-2 text-left">Referência</th>
                <th className="px-2 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-8 text-center text-slate-400">
                    Nenhuma movimentação encontrada para esta fatura.
                  </td>
                </tr>
              ) : (
                movimentacoes.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">{formatDate(l.data)}</td>
                    <td className="px-2 py-2">
                      <span className="rounded bg-cyan-50 px-2 py-1 text-cyan-700">
                        {formaPagamentoExibicao(l)}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={classeReferenciaHistoricoRecebimento(l, lancamentos)}>
                        {referenciaLancamento(l, lancamentos)}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-2 py-2 text-right font-medium",
                        valorHistoricoRecebimentoCliente(l, lancamentos) < 0 && "text-red-600"
                      )}
                    >
                      {money(valorHistoricoRecebimentoCliente(l, lancamentos))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
