"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, X } from "lucide-react";
import type { ContaBancaria } from "@/lib/conta-bancaria";
import {
  carregarExtratoBancario,
  extratoDaConta,
  mesclarExtrato,
  salvarExtratoBancario,
  type ExtratoMovimentacao,
} from "@/lib/extrato-bancario";
import { cn } from "@/lib/utils";

type Props = {
  conta: ContaBancaria | null;
  open: boolean;
  onClose: () => void;
  onContaAtualizada?: (conta: ContaBancaria) => void;
};

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatData(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

const origemLabel: Record<ExtratoMovimentacao["origem"], string> = {
  open_finance: "Open Finance",
  arquivo: "Arquivo",
  manual: "Manual",
};

export function ExtratoBancarioModal({
  conta,
  open,
  onClose,
  onContaAtualizada,
}: Props) {
  const [portalPronto, setPortalPronto] = useState(false);
  const [extrato, setExtrato] = useState<ExtratoMovimentacao[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  const recarregar = useCallback(() => {
    if (!conta) return;
    setExtrato(extratoDaConta(conta.id, carregarExtratoBancario()));
  }, [conta]);

  useEffect(() => {
    if (!open || !conta) return;
    recarregar();
    setErro("");
  }, [open, conta, recarregar]);

  const totais = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const m of extrato) {
      if (m.tipo === "entrada") entradas += m.valor;
      else saidas += m.valor;
    }
    return { entradas, saidas };
  }, [extrato]);

  async function sincronizarOpenFinance() {
    if (!conta?.openFinance?.itemId) return;
    setSincronizando(true);
    setErro("");
    try {
      const res = await fetch("/api/open-finance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: conta.openFinance.itemId,
          contaId: conta.id,
          dias: 90,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Falha na sincronização.");
        return;
      }
      const merged = mesclarExtrato(
        carregarExtratoBancario(),
        data.movimentacoes as ExtratoMovimentacao[]
      );
      salvarExtratoBancario(merged);
      recarregar();

      const atualizada: ContaBancaria = {
        ...conta,
        openFinance: {
          ...conta.openFinance!,
          ultimaSync: data.sincronizadoEm as string,
          status: "conectado",
          mensagemErro: undefined,
        },
      };
      onContaAtualizada?.(atualizada);
    } catch {
      setErro("Erro de rede ao sincronizar.");
    } finally {
      setSincronizando(false);
    }
  }

  if (!open || !portalPronto || !conta) return null;

  const podeSync =
    conta.modoVinculo === "open_finance" && Boolean(conta.openFinance?.itemId);

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-8">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative my-auto w-full max-w-[900px] rounded border border-[#d4d4d4] bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
          <div>
            <h2 className="text-[15px] font-normal text-slate-800">
              Extrato — {conta.nome}
            </h2>
            {conta.openFinance?.ultimaSync ? (
              <p className="text-[11px] text-slate-500">
                Última sincronização:{" "}
                {new Date(conta.openFinance.ultimaSync).toLocaleString("pt-BR")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#ececec] px-4 py-3">
          {podeSync ? (
            <button
              type="button"
              disabled={sincronizando}
              onClick={() => void sincronizarOpenFinance()}
              className="inline-flex items-center gap-1.5 rounded bg-[#4a90d9] px-3 py-1.5 text-[12px] text-white hover:bg-[#3d7fc4] disabled:opacity-60"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", sincronizando && "animate-spin")}
              />
              {sincronizando ? "Sincronizando…" : "Sincronizar extrato"}
            </button>
          ) : null}
          <span className="text-[12px] text-slate-600">
            Entradas:{" "}
            <span className="text-[#4cae4c]">{money(totais.entradas)}</span>
            {" · "}
            Saídas: <span className="text-red-600">{money(totais.saidas)}</span>
          </span>
        </div>

        {erro ? (
          <p className="mx-4 mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            {erro}
          </p>
        ) : null}

        <div className="max-h-[60vh] overflow-auto px-4 py-3">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#e0e0e0] text-[11px] uppercase text-slate-500">
                <th className="py-2 pr-2">Data</th>
                <th className="py-2 pr-2">Descrição</th>
                <th className="py-2 pr-2">Origem</th>
                <th className="py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {extrato.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Nenhuma movimentação no extrato. Conecte o banco ou importe um
                    arquivo OFX/CSV.
                  </td>
                </tr>
              ) : (
                extrato.map((m) => (
                  <tr key={m.id} className="border-b border-[#f0f0f0]">
                    <td className="py-2 pr-2 tabular-nums text-slate-600">
                      {formatData(m.data)}
                    </td>
                    <td className="py-2 pr-2 text-slate-800">{m.descricao}</td>
                    <td className="py-2 pr-2 text-slate-500">
                      {origemLabel[m.origem]}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right tabular-nums font-medium",
                        m.tipo === "entrada" ? "text-[#4cae4c]" : "text-red-600"
                      )}
                    >
                      {m.tipo === "entrada" ? "+" : "−"}
                      {money(m.valor)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#e5e5e5] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded border border-[#d4d4d4] px-4 text-[13px] text-slate-700 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
