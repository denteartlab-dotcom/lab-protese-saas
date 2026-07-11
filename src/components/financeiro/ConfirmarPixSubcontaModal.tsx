"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui";

type Props = {
  open: boolean;
  valor: string;
  chavePix: string;
  tipoChave: string;
  processando?: boolean;
  erro?: string | null;
  onClose: () => void;
  onConfirmar: (senhaProprietario: string) => void | Promise<void>;
};

const rotuloTipoChave: Record<string, string> = {
  EVP: "Aleatória",
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "E-mail",
  PHONE: "Telefone",
};

export function ConfirmarPixSubcontaModal({
  open,
  valor,
  chavePix,
  tipoChave,
  processando = false,
  erro,
  onClose,
  onConfirmar,
}: Props) {
  const [senha, setSenha] = useState("");

  if (!open) return null;

  function fechar() {
    if (processando) return;
    setSenha("");
    onClose();
  }

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    if (processando || !senha.trim()) return;
    await onConfirmar(senha);
  }

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/45 p-4"
      onClick={fechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmar-pix-subconta-titulo"
        className="relative w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-start gap-3 pr-8">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-[#4a90d9]" />
            <div>
              <h2
                id="confirmar-pix-subconta-titulo"
                className="text-base font-medium text-slate-700"
              >
                Confirmar transferência Pix
              </h2>
              <p className="mt-1 text-[12px] text-slate-500">
                Subcontas exigem a senha do proprietário antes de enviar ao Asaas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fechar}
            disabled={processando}
            className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-40"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void enviar(e)} className="space-y-4 px-5 py-4">
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
            <p>
              <strong>Valor:</strong> {valor || "—"}
            </p>
            <p className="mt-1">
              <strong>Chave ({rotuloTipoChave[tipoChave] || tipoChave}):</strong>{" "}
              {chavePix || "—"}
            </p>
          </div>

          <div>
            <label
              htmlFor="senha-proprietario-pix"
              className="mb-1 block text-[11px] font-medium text-slate-600"
            >
              Senha do proprietário
            </label>
            <input
              id="senha-proprietario-pix"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="h-9 w-full rounded border border-slate-300 px-2.5 text-[12px] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
              placeholder="Digite sua senha de acesso"
              disabled={processando}
            />
          </div>

          {erro ? (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {erro}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" disabled={processando} onClick={fechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={processando || !senha.trim()}>
              {processando ? "Enviando…" : "Confirmar Pix"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
