"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { CampoDataBr } from "@/components/campo-data-br";
import { dateToBrShort } from "@/lib/datas-br";
import type { ContaBancaria, MovimentacaoContaBancaria } from "@/lib/conta-bancaria";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  contas: ContaBancaria[];
  movimentacoes: MovimentacaoContaBancaria[];
  contaInicial?: ContaBancaria | null;
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

function inicioPeriodo(tipo: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (tipo === "hoje") return hoje;
  if (tipo === "semana") {
    const d = new Date(hoje);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }
  if (tipo === "mes") return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return null;
}

function fimPeriodo(tipo: string) {
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  if (tipo === "hoje" || tipo === "semana" || tipo === "mes") return hoje;
  return null;
}

export function TransferenciasAjustesSaldoModal({
  open,
  onClose,
  contas,
  movimentacoes,
  contaInicial = null,
}: Props) {
  const [portalPronto, setPortalPronto] = useState(false);
  const [contaId, setContaId] = useState("");
  const [periodo, setPeriodo] = useState("hoje");
  const [dataInicio, setDataInicio] = useState(dateToBrShort(new Date()));
  const [dataFinal, setDataFinal] = useState(dateToBrShort(new Date()));
  const [buscou, setBuscou] = useState(false);

  useEffect(() => setPortalPronto(true), []);

  useEffect(() => {
    if (!open) return;
    setContaId(contaInicial?.id ?? "");
    setPeriodo("hoje");
    const hoje = dateToBrShort(new Date());
    setDataInicio(hoje);
    setDataFinal(hoje);
    setBuscou(true);
  }, [open, contaInicial]);

  const linhas = useMemo(() => {
    if (!buscou || !contaId) return [];
    let lista = movimentacoes.filter((m) => m.contaId === contaId);

    if (periodo !== "todos" && periodo !== "outro") {
      const ini = inicioPeriodo(periodo);
      const fim = fimPeriodo(periodo);
      if (ini && fim) {
        lista = lista.filter((m) => {
          const d = new Date(m.data);
          return d >= ini && d <= fim;
        });
      }
    } else if (periodo === "outro") {
      const parseBr = (v: string) => {
        const [day, month, year] = v.split("/").map(Number);
        if (!day || !month || !year) return null;
        return new Date(year < 100 ? 2000 + year : year, month - 1, day);
      };
      const ini = parseBr(dataInicio);
      const fim = parseBr(dataFinal);
      if (ini && fim) {
        fim.setHours(23, 59, 59, 999);
        lista = lista.filter((m) => {
          const d = new Date(m.data);
          return d >= ini && d <= fim;
        });
      }
    }

    return lista.sort(
      (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
    );
  }, [buscou, contaId, movimentacoes, periodo, dataInicio, dataFinal]);

  if (!open || !portalPronto) return null;

  const contasAtivas = contas.filter((c) => !c.excluida);

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-10">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative my-auto w-full max-w-[min(1100px,94vw)] rounded border border-[#d4d4d4] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
          <h2 className="text-[15px] font-normal text-slate-800">
            Transferências e Ajustes de Saldo
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-[#e5e5e5] bg-[#fafafa] px-4 py-3">
          <div className="grid grid-cols-12 items-end gap-3">
            <div className="col-span-12 md:col-span-3">
              <label className="mb-1 block text-[11px] text-slate-600">Conta</label>
              <select
                value={contaId}
                onChange={(e) => setContaId(e.target.value)}
                className="h-9 w-full rounded border border-[#d4d4d4] bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9]"
              >
                <option value="">Selecione</option>
                {contasAtivas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-12 md:col-span-2">
              <label className="mb-1 block text-[11px] text-slate-600">Período</label>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="h-9 w-full rounded border border-[#d4d4d4] bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9]"
              >
                <option value="hoje">Hoje</option>
                <option value="semana">Esta Semana</option>
                <option value="mes">Este Mês</option>
                <option value="todos">Mostrar Todos</option>
                <option value="outro">Outro Período</option>
              </select>
            </div>
            <div className="col-span-6 md:col-span-2">
              <CampoDataBr
                label="Data Início"
                value={dataInicio}
                onChange={(v) => {
                  setDataInicio(v);
                  setPeriodo("outro");
                }}
                className="space-y-0"
                inputClassName="h-9 w-full rounded border border-[#d4d4d4] bg-white px-2.5 text-[12px]"
              />
            </div>
            <div className="col-span-6 md:col-span-2">
              <CampoDataBr
                label="Data Final"
                value={dataFinal}
                onChange={(v) => {
                  setDataFinal(v);
                  setPeriodo("outro");
                }}
                className="space-y-0"
                inputClassName="h-9 w-full rounded border border-[#d4d4d4] bg-white px-2.5 text-[12px]"
              />
            </div>
            <div className="col-span-12 md:col-span-3">
              <button
                type="button"
                onClick={() => setBuscou(true)}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded bg-[#4cae4c] px-4 text-[13px] text-white hover:bg-[#449d44]"
              >
                <Search className="h-4 w-4" />
                Buscar
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-[220px] px-4 py-3">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#b8d4f0] bg-[#e8f2fc] text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-3 py-2.5">Descrição</th>
                <th className="px-3 py-2.5">Data Transação</th>
                <th className="px-3 py-2.5 text-right">Valor</th>
                <th className="w-20 px-3 py-2.5 text-center">Opções</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-14 text-center text-[13px] text-[#4a90d9]">
                    Nenhuma transação encontrada! Tente outros filtros de busca!
                  </td>
                </tr>
              ) : (
                linhas.map((linha) => (
                  <tr
                    key={linha.id}
                    className="border-b border-[#ececec] text-slate-700"
                  >
                    <td className="px-3 py-2.5">{linha.descricao}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatData(linha.data)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-medium tabular-nums",
                        linha.tipo === "entrada"
                          ? "text-[#4cae4c]"
                          : "text-[#dc2626]"
                      )}
                    >
                      {money(linha.valor)}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-400">—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t border-[#e5e5e5] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded border border-[#6b7280] bg-[#6b7280] px-6 text-[13px] text-white hover:bg-[#5b6370]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
