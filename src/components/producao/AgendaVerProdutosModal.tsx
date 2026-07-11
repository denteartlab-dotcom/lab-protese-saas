"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { Button } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

type Produto = {
  id: string;
  nome: string;
  quantidade: string;
  valor: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  numeroOs: number;
  produtos: Produto[];
};

export function AgendaVerProdutosModal({ open, onClose, numeroOs, produtos }: Props) {
  if (!open) return null;

  return (
    <I18nPortal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Produtos da OS {numeroOs}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-lg text-slate-400 hover:text-slate-700"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <div className="p-4">
          {produtos.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Nenhum produto vinculado a esta OS.
            </p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="px-2 py-2 text-left font-semibold uppercase">Produto</th>
                  <th className="px-2 py-2 text-left font-semibold uppercase">Qtd</th>
                  <th className="px-2 py-2 text-right font-semibold uppercase">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {produtos.map((produto) => (
                  <tr key={produto.id}>
                    <td className="px-2 py-2 text-slate-700">{produto.nome}</td>
                    <td className="px-2 py-2 text-slate-600">{produto.quantidade}</td>
                    <td className="px-2 py-2 text-right text-slate-700">
                      {formatCurrency(produto.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
    </I18nPortal>
  );
}
