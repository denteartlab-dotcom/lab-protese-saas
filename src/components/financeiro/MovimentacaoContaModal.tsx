"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { User, X } from "lucide-react";
import type { AcaoContaBancaria, ContaBancaria } from "@/lib/conta-bancaria";
import { labelAcaoConta } from "@/lib/conta-bancaria";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  conta: ContaBancaria | null;
  saldo: number;
  contas: ContaBancaria[];
  acao?: AcaoContaBancaria;
  onConfirmar: (dados: {
    contaDestinoId: string;
    tipo: string;
    valor: number;
    descricao: string;
  }) => void;
};

const labelClass = "mb-1 block text-[11px] text-slate-600";
const inputClass =
  "h-9 w-full rounded border border-[#d4d4d4] bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-[#4a90d9]";

const TIPOS_MOVIMENTACAO = [
  "Transferência",
  "Ajuste Saldo (Creditar)",
  "Ajuste Saldo (Debitar)",
] as const;

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMoneyBr(value: string) {
  const n = Number(
    value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
  );
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyInput(value: string) {
  const amount = Number(value.replace(/\D/g, "")) / 100;
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MovimentacaoContaModal({
  open,
  onClose,
  conta,
  saldo,
  contas,
  acao = "movimentar",
  onConfirmar,
}: Props) {
  const [portalPronto, setPortalPronto] = useState(false);
  const [contaDestinoId, setContaDestinoId] = useState("");
  const [tipo, setTipo] = useState("Transferência");
  const [valor, setValor] = useState("0,00");
  const [descricao, setDescricao] = useState("");
  const [erroValor, setErroValor] = useState(false);

  useEffect(() => setPortalPronto(true), []);

  const tipoInicial =
    acao === "baixar"
      ? "Ajuste Saldo (Debitar)"
      : acao === "adicionar_credito"
        ? "Ajuste Saldo (Creditar)"
        : "Transferência";

  useEffect(() => {
    if (!open) return;
    setContaDestinoId("");
    setTipo(tipoInicial);
    setValor("0,00");
    setDescricao("");
    setErroValor(false);
  }, [open, conta?.id, tipoInicial]);

  if (!open || !portalPronto || !conta) return null;

  const contasDestino = contas.filter((c) => !c.excluida && c.id !== conta.id);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valorNum = parseMoneyBr(valor);
    if (valorNum <= 0) {
      setErroValor(true);
      return;
    }
    if (tipo === "Transferência" && !contaDestinoId) return;
    onConfirmar({
      contaDestinoId,
      tipo,
      valor: valorNum,
      descricao,
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-10">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative my-auto w-full max-w-[min(720px,92vw)] rounded border border-[#d4d4d4] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
          <h2 className="text-[15px] font-normal text-slate-800">
            {acao === "movimentar"
              ? `Movimentação de Conta: ${conta.nome}`
              : `${labelAcaoConta(acao)}: ${conta.nome}`}
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

        <form onSubmit={handleSubmit} className="px-4 py-4">
          <p className="mb-4 text-[13px] font-semibold uppercase text-slate-800">
            Saldo :{" "}
            <span
              className={
                saldo < 0
                  ? "text-[#dc2626]"
                  : saldo > 0
                    ? "text-[#4cae4c]"
                    : "text-slate-700"
              }
            >
              {money(saldo)}
            </span>
          </p>

          {tipo === "Transferência" ? (
            <div className="mb-4">
              <label className={labelClass}>Conta Destino</label>
              <select
                value={contaDestinoId}
                onChange={(e) => setContaDestinoId(e.target.value)}
                className={inputClass}
                required={tipo === "Transferência"}
              >
                <option value="">Selecione Destino</option>
                {contasDestino.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-slate-700">
            <User className="h-4 w-4 text-slate-400" />
            Dados da Movimentação do Conta
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-4">
              <label className={labelClass}>Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className={inputClass}
              >
                {TIPOS_MOVIMENTACAO.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-12 md:col-span-4">
              <label className={labelClass}>Valor</label>
              <input
                type="text"
                value={valor}
                onChange={(e) => {
                  setValor(formatMoneyInput(e.target.value));
                  setErroValor(false);
                }}
                className={cn(inputClass, "text-right")}
              />
              {erroValor ? (
                <p className="mt-1 text-[11px] text-red-600">
                  Campo Valor deve ser maior que 0
                </p>
              ) : null}
            </div>
            <div className="col-span-12 md:col-span-4" />
            <div className="col-span-12">
              <label className={labelClass}>Descrição</label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2 border-t border-[#e5e5e5] pt-4">
            <button
              type="submit"
              className="h-9 rounded border border-[#4a90d9] bg-[#4a90d9] px-5 text-[13px] text-white hover:bg-[#3d7fc4]"
            >
              Cadastrar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded border border-[#d4d4d4] bg-white px-5 text-[13px] text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
