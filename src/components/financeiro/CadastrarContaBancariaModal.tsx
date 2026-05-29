"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Landmark } from "lucide-react";
import { VinculoContaBancariaSection } from "@/components/financeiro/VinculoContaBancariaSection";
import {
  FORM_CONTA_BANCARIA_VAZIO,
  formFromConta,
  type ContaBancaria,
  type DadosFormContaBancaria,
} from "@/lib/conta-bancaria";
import type { ExtratoMovimentacao } from "@/lib/extrato-bancario";

const inputClass =
  "h-9 w-full rounded border border-[#d4d4d4] bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-[#4a90d9]";

const labelClass = "mb-1 block text-[12px] text-slate-700";

type ExtratoPendente = Omit<ExtratoMovimentacao, "contaId">[];

type Props = {
  open: boolean;
  onClose: () => void;
  onCadastrar: (dados: DadosFormContaBancaria, extratoPendente?: ExtratoPendente) => void;
  /** Se informado, modo edição (título e botão diferentes). */
  contaEdicao?: ContaBancaria | null;
  onSalvarEdicao?: (
    dados: DadosFormContaBancaria,
    extratoPendente?: ExtratoPendente
  ) => void;
  onExcluir?: () => void;
};

const TIPOS_CHAVE_PIX: { value: DadosFormContaBancaria["tipoChavePix"]; label: string }[] =
  [
    { value: "", label: "Selecione o Tipo de Chave Pix" },
    { value: "cpf", label: "CPF" },
    { value: "cnpj", label: "CNPJ" },
    { value: "email", label: "E-mail" },
    { value: "telefone", label: "Telefone" },
    { value: "aleatoria", label: "Chave aleatória" },
  ];

export function CadastrarContaBancariaModal({
  open,
  onClose,
  onCadastrar,
  contaEdicao = null,
  onSalvarEdicao,
  onExcluir,
}: Props) {
  const [portalPronto, setPortalPronto] = useState(false);
  const [form, setForm] = useState<DadosFormContaBancaria>(FORM_CONTA_BANCARIA_VAZIO);
  const [extratoPendente, setExtratoPendente] = useState<ExtratoPendente>([]);

  const editando = Boolean(contaEdicao);

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm(contaEdicao ? formFromConta(contaEdicao) : FORM_CONTA_BANCARIA_VAZIO);
    setExtratoPendente([]);
  }, [open, contaEdicao]);

  if (!open || !portalPronto) return null;

  function patch(partial: Partial<DadosFormContaBancaria>) {
    setForm((atual) => ({ ...atual, ...partial }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    const pendente =
      form.modoVinculo === "extrato_arquivo" && extratoPendente.length > 0
        ? extratoPendente
        : undefined;
    if (editando && onSalvarEdicao) {
      onSalvarEdicao(form, pendente);
    } else {
      onCadastrar(form, pendente);
    }
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cadastrar-conta-titulo"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative my-auto w-full max-w-[820px] rounded border border-[#d4d4d4] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.2)] dark:border-slate-600 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
          <h2
            id="cadastrar-conta-titulo"
            className="text-[15px] font-normal text-slate-800"
          >
            {editando ? "Editar Conta" : "Cadastrar Conta"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-4 text-[11px] text-slate-700">
          <div className="mb-4 flex items-center gap-2 text-[13px] text-slate-600">
            <Landmark className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
            <span>Dados da Conta</span>
          </div>

          <div className="grid grid-cols-12 gap-x-3 gap-y-3">
            <div className="col-span-12 md:col-span-6">
              <label className={labelClass}>
                Nome<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={(e) => patch({ nome: e.target.value })}
                className={inputClass}
                autoFocus
              />
            </div>
            <div className="col-span-6 md:col-span-3">
              <label className={labelClass}>Cód. Banco</label>
              <input
                type="text"
                value={form.codBanco}
                onChange={(e) => patch({ codBanco: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="col-span-6 md:col-span-3">
              <label className={labelClass}>Agência</label>
              <input
                type="text"
                value={form.agencia}
                onChange={(e) => patch({ agencia: e.target.value })}
                className={inputClass}
              />
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className={labelClass}>Número da Conta</label>
              <input
                type="text"
                value={form.numeroConta}
                onChange={(e) => patch({ numeroConta: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className={labelClass}>Tipo de Chave Pix</label>
              <select
                value={form.tipoChavePix}
                onChange={(e) =>
                  patch({
                    tipoChavePix: e.target
                      .value as DadosFormContaBancaria["tipoChavePix"],
                  })
                }
                className={inputClass}
              >
                {TIPOS_CHAVE_PIX.map((opt) => (
                  <option key={opt.value || "vazio"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className={labelClass}>Chave Pix</label>
              <input
                type="text"
                value={form.chavePix}
                onChange={(e) => patch({ chavePix: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className={labelClass}>Saldo Inicial</label>
              <input
                type="text"
                value={form.saldoInicial}
                onChange={(e) => patch({ saldoInicial: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <VinculoContaBancariaSection
            form={form}
            onChange={patch}
            contaIdPreview={contaEdicao?.id ?? "nova-conta"}
            onExtratoArquivo={setExtratoPendente}
          />

          <div className="mt-5 flex items-center gap-2 border-t border-[#e5e5e5] pt-4">
            <button
              type="submit"
              disabled={!form.nome.trim()}
              className="h-9 rounded border border-[#4a90d9] bg-[#4a90d9] px-5 text-[13px] text-white hover:bg-[#3d7fc4] disabled:opacity-50"
            >
              {editando ? "Salvar" : "Cadastrar"}
            </button>
            {editando && onExcluir ? (
              <button
                type="button"
                onClick={() => {
                  onExcluir();
                  onClose();
                }}
                className="h-9 rounded border border-red-300 bg-white px-5 text-[13px] text-red-600 hover:bg-red-50"
              >
                Excluir
              </button>
            ) : null}
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
