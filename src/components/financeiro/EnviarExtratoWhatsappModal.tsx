"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X } from "lucide-react";
import {
  mensagemWhatsappExtratoConferencia,
  publicarExtratoPublica,
} from "@/lib/extrato-publica-cliente";
import { formatWhatsappInput } from "@/lib/whatsapp";
import { dispararOuAbrirWhatsapp } from "@/lib/whatsapp-disparo-cliente";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  clienteNome: string;
  telefoneInicial?: string | null;
  gerarPdf: () => Promise<Blob>;
};

export function EnviarExtratoWhatsappModal({
  open,
  onClose,
  clienteNome,
  telefoneInicial,
  gerarPdf,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setTelefone(telefoneInicial?.trim() ? formatWhatsappInput(telefoneInicial.trim()) : "");
  }, [open, telefoneInicial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function enviar() {
    if (enviando) return;
    const nomeArquivo = `extrato-${clienteNome.replace(/\s+/g, "-").slice(0, 40)}.pdf`;
    const titulo = `Extrato Financeiro — ${clienteNome}`;

    setEnviando(true);
    try {
      const blob = await gerarPdf();
      const publicUrl = await publicarExtratoPublica({
        blob,
        clienteNome,
        nomeArquivo,
        titulo,
      });
      const texto = mensagemWhatsappExtratoConferencia({
        clienteNome,
        publicUrl,
      });
      const resultado = await dispararOuAbrirWhatsapp(telefone, texto);
      if (resultado.modo === "erro") {
        window.alert(
          resultado.error ||
            "Não foi possível enviar pelo WhatsApp. Verifique o número ou a conexão em Configurações → WhatsApp."
        );
        return;
      }
      onClose();
    } catch (err) {
      console.error("[EnviarExtratoWhatsappModal]", err);
      window.alert("Não foi possível gerar o link do extrato para o WhatsApp.");
    } finally {
      setEnviando(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-md overflow-hidden rounded-md border border-[#e5e7eb] bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="enviar-extrato-whatsapp-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
          <h2
            id="enviar-extrato-whatsapp-titulo"
            className="text-[13px] font-normal text-[#374151]"
          >
            Enviar Extrato por WhatsApp
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="rounded-sm border border-[#bfdbfe] bg-[#eff6ff] px-4 py-2.5 text-center text-[13px] font-semibold text-[#1d4ed8]">
            {clienteNome}
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[#374151]">
              WhatsApp do cliente
            </label>
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(formatWhatsappInput(e.target.value))}
              placeholder="(00) 00000-0000"
              className="h-9 w-full rounded-sm border border-[#d1d5db] px-3 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
            />
            <p className="mt-1.5 text-[11px] text-[#9ca3af]">
              Será enviada uma mensagem com o link do PDF do extrato para conferência.
            </p>
          </div>

          {enviando ? (
            <p className="text-center text-xs text-[#6b7280]">
              Gerando PDF e preparando link para o WhatsApp…
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3">
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={enviando}
            className="inline-flex h-9 items-center gap-2 rounded-sm bg-[#25D366] px-4 text-[12px] font-medium text-white hover:bg-[#1ebe57] disabled:opacity-50"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar pelo WhatsApp
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-sm border border-[#f87171] bg-white px-3",
              "text-[12px] font-normal text-[#ef4444] hover:bg-[#fef2f2] disabled:opacity-50"
            )}
          >
            <X className="h-3.5 w-3.5" />
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
