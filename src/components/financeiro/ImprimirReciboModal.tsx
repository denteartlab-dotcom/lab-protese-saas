"use client";

import { useEffect, useState } from "react";
import { Mail, MessageCircle, Printer, X } from "lucide-react";
import {
  carregarConfigLaboratorio,
  telefoneWhatsappLaboratorio,
} from "@/lib/configuracoes-lab";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import { gerarReciboRecebimentoPdf } from "@/lib/recibo-recebimento-pdf";
import {
  montarTextoReciboCompartilhar,
  type LinhaReciboRecebimento,
  type ModeloReciboRecebimento,
} from "@/lib/recibo-recebimento";
import { cn } from "@/lib/utils";

type ImprimirReciboModalProps = {
  open: boolean;
  onClose: () => void;
  clienteNome: string;
  linhas: LinhaReciboRecebimento[];
};

export function ImprimirReciboModal({
  open,
  onClose,
  clienteNome,
  linhas,
}: ImprimirReciboModalProps) {
  const [modelo, setModelo] = useState<ModeloReciboRecebimento>("detalhado");

  useEffect(() => {
    if (open) setModelo("detalhado");
  }, [open]);

  if (!open) return null;

  function imprimir() {
    void abrirPdfGerando(
      () => gerarReciboRecebimentoPdf(modelo, { clienteNome, linhas }),
      "recibo.pdf"
    );
  }

  function enviarEmail() {
    const assunto = encodeURIComponent(`Recibo — ${clienteNome}`);
    const corpo = encodeURIComponent(
      montarTextoReciboCompartilhar({ clienteNome, linhas })
    );
    window.location.href = `mailto:?subject=${assunto}&body=${corpo}`;
  }

  function enviarWhatsapp() {
    const cfg = carregarConfigLaboratorio();
    const digits = (telefoneWhatsappLaboratorio(cfg) || cfg.whatsapp || "")
      .replace(/\D/g, "");
    const texto = encodeURIComponent(
      montarTextoReciboCompartilhar({ clienteNome, linhas })
    );
    const base = digits
      ? `https://wa.me/55${digits.replace(/^55/, "")}`
      : "https://wa.me/";
    window.open(`${base}?text=${texto}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-md border border-[#e5e7eb] bg-white shadow-xl"
        role="dialog"
        aria-labelledby="imprimir-recibo-titulo"
      >
        <div className="border-b border-[#e5e7eb] px-4 py-3">
          <h2
            id="imprimir-recibo-titulo"
            className="text-[13px] font-normal text-[#374151]"
          >
            Imprimir Recibo
          </h2>
        </div>

        <div className="p-4">
          <div className="rounded-sm border border-[#e5e7eb] bg-white px-4 py-4">
            <p className="text-[13px] font-semibold text-[#374151]">Modelo Recibo</p>
            <p className="mt-0.5 text-[11px] text-[#9ca3af]">
              Escolha o modelo de impressão
            </p>
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-[12px] text-[#374151]">
                <input
                  type="radio"
                  name="modelo-recibo"
                  checked={modelo === "simples"}
                  onChange={() => setModelo("simples")}
                  className="h-4 w-4 accent-[#4a90d9]"
                />
                Simples
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-[12px] text-[#374151]">
                <input
                  type="radio"
                  name="modelo-recibo"
                  checked={modelo === "detalhado"}
                  onChange={() => setModelo("detalhado")}
                  className="h-4 w-4 accent-[#4a90d9]"
                />
                Detalhado
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Imprimir"
              onClick={imprimir}
              className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#4a90d9] text-white hover:bg-[#3d7fc4]"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Enviar por e-mail"
              onClick={enviarEmail}
              className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#4a90d9] text-white hover:bg-[#3d7fc4]"
            >
              <Mail className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Enviar por WhatsApp"
              onClick={enviarWhatsapp}
              className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#5cb85c] text-white hover:bg-[#4cae4c]"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-sm border border-[#f87171] bg-white px-3",
              "text-[12px] font-normal text-[#ef4444] hover:bg-[#fef2f2]"
            )}
          >
            <X className="h-3.5 w-3.5" />
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
