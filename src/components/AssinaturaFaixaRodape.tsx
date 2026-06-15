"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { formatarDataAssinatura, diasRestantesAssinatura } from "@/lib/assinatura-empresa";
import { RenovarAssinaturaPixModal } from "@/components/assinatura/RenovarAssinaturaPixModal";
import { cn } from "@/lib/utils";

type Props = {
  dataVencimento: string | null;
  whatsappSuporte?: string | null;
};

function iconeWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.09 1.505 5.82L0 24l6.335-1.662A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82a9.78 9.78 0 01-4.93-1.33l-.353-.21-3.76.987 1.004-3.66-.23-.376A9.82 9.82 0 012.18 12C2.18 6.57 6.57 2.18 12 2.18S21.82 6.57 21.82 12 17.43 21.82 12 21.82z" />
    </svg>
  );
}

export function AssinaturaFaixaRodape({
  dataVencimento,
  whatsappSuporte,
}: Props) {
  const [modalPixAberto, setModalPixAberto] = useState(false);

  if (!dataVencimento) return null;

  const dataFormatada = formatarDataAssinatura(dataVencimento);
  const diasRestantes = diasRestantesAssinatura(dataVencimento);
  const urgente = diasRestantes !== null && diasRestantes <= 7;
  const whatsapp = (whatsappSuporte || "").replace(/\D/g, "");
  const linkWhatsapp = whatsapp
    ? `https://wa.me/55${whatsapp}?text=${encodeURIComponent("Olá, preciso renovar minha assinatura do Lab Prótese.")}`
    : undefined;

  return (
    <>
      <footer className="sticky bottom-0 z-30 border-t border-slate-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            <span>Está com dúvidas?</span>
            <span className="text-slate-400">—</span>
            <span className="font-medium text-slate-700">Suporte</span>
            {linkWhatsapp ? (
              <a
                href={linkWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#1fb855]"
              >
                {iconeWhatsApp()}
                Whatsapp
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1 text-[11px] font-medium text-white opacity-80">
                {iconeWhatsApp()}
                Whatsapp
              </span>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4a90d9] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#3a7bc8]"
              onClick={() => {
                if (linkWhatsapp) window.open(linkWhatsapp, "_blank");
              }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Chat
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                urgente && "font-medium text-amber-700"
              )}
            >
              <span className="text-base leading-none" aria-hidden>
                ⚠
              </span>
              Sua Assinatura expira em <strong className="text-slate-800">{dataFormatada}</strong>
            </span>
            <button
              type="button"
              onClick={() => setModalPixAberto(true)}
              className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
            >
              renovar
            </button>
          </div>
        </div>
      </footer>

      <RenovarAssinaturaPixModal
        aberto={modalPixAberto}
        onFechar={() => setModalPixAberto(false)}
        onRenovado={() => window.location.reload()}
      />
    </>
  );
}
