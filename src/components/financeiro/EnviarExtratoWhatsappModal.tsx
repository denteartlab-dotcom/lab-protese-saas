"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X } from "lucide-react";
import {
  mensagemWhatsappExtratoConferencia,
  publicarExtratoPublica,
} from "@/lib/extrato-publica-cliente";
import { nomeArquivoExtratoCliente } from "@/lib/extrato-arquivo-nome";
import { formatWhatsAppPhone, formatWhatsappInput } from "@/lib/whatsapp";
import { dispararOuAbrirWhatsapp } from "@/lib/whatsapp-disparo-cliente";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  clienteNome: string;
  telefoneInicial?: string | null;
  gerarPdf: () => Promise<Blob>;
};

function reservarJanelaWhatsapp(): Window | null {
  if (typeof window === "undefined") return null;
  try {
    const w = window.open("about:blank", "_blank");
    if (!w) return null;
    try {
      w.document.title = "Abrindo WhatsApp…";
      w.document.body.innerHTML =
        "<div style='font-family:system-ui,sans-serif;padding:32px;color:#334155'>Gerando PDF do extrato e abrindo o WhatsApp…</div>";
    } catch {
      /* Aba aberta; location.replace ainda pode funcionar. */
    }
    return w;
  } catch {
    return null;
  }
}

function fecharJanela(janela: Window | null | undefined) {
  if (!janela || janela.closed) return;
  try {
    janela.close();
  } catch {
    /* ignore */
  }
}

function baixarPdfLocal(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function mensagemErro(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  if (typeof err === "string" && err.trim()) return err.trim();
  return fallback;
}

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
    setTelefone(
      telefoneInicial?.trim() ? formatWhatsappInput(telefoneInicial.trim()) : ""
    );
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

    const telefoneNorm = formatWhatsAppPhone(telefone);
    if (!telefoneNorm) {
      window.alert(
        "Informe o WhatsApp do cliente. Se já estiver no cadastro, confira o campo Celular/WhatsApp."
      );
      return;
    }

    // Reserva a aba no clique (antes do await) para não ser bloqueada pelo navegador.
    const janela = reservarJanelaWhatsapp();
    const nomeArquivo = nomeArquivoExtratoCliente(clienteNome);
    const titulo = `Extrato Financeiro - ${clienteNome}`.slice(0, 240);

    setEnviando(true);
    try {
      let blob: Blob;
      try {
        blob = await gerarPdf();
      } catch (err) {
        throw new Error(
          mensagemErro(err, "Falha ao gerar o PDF do extrato.")
        );
      }

      if (!blob || blob.size < 50) {
        throw new Error("O PDF do extrato foi gerado vazio. Tente imprimir o PDF primeiro.");
      }

      let publicUrl = "";
      try {
        const publicado = await publicarExtratoPublica({
          blob,
          clienteNome,
          nomeArquivo,
          titulo,
        });
        publicUrl = publicado.pdfUrl;
      } catch (err) {
        // Fallback: baixa o PDF e abre o WhatsApp para o usuário anexar manualmente.
        console.error("[EnviarExtratoWhatsappModal] publicar", err);
        baixarPdfLocal(blob, nomeArquivo);
        const textoFallback = `Extrato Financeiro — ${clienteNome}\nSegue o extrato em PDF. O arquivo foi baixado neste computador — anexe-o nesta conversa.`;
        const resultadoFallback = await dispararOuAbrirWhatsapp(
          telefoneNorm,
          textoFallback,
          { forcarWhatsAppWeb: true, janelaWhatsapp: janela }
        );
        if (resultadoFallback.modo === "erro") {
          fecharJanela(janela);
        }
        window.alert(
          `${mensagemErro(err, "Não foi possível criar o link público do PDF.")}\n\nO PDF foi baixado. Anexe o arquivo na conversa do WhatsApp.`
        );
        onClose();
        return;
      }

      const texto = mensagemWhatsappExtratoConferencia({
        clienteNome,
        publicUrl,
      });
      const resultado = await dispararOuAbrirWhatsapp(telefoneNorm, texto, {
        forcarWhatsAppWeb: true,
        janelaWhatsapp: janela,
      });
      if (resultado.modo === "erro") {
        fecharJanela(janela);
        baixarPdfLocal(blob, nomeArquivo);
        window.alert(
          `${resultado.error || "Não foi possível abrir o WhatsApp Web."}\n\nO PDF foi baixado para você anexar manualmente.`
        );
        return;
      }
      onClose();
    } catch (err) {
      fecharJanela(janela);
      console.error("[EnviarExtratoWhatsappModal]", err);
      window.alert(
        mensagemErro(
          err,
          "Não foi possível gerar o PDF do extrato para o WhatsApp. Tente novamente."
        )
      );
    } finally {
      setEnviando(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <I18nPortal>
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
                Gera o PDF do extrato e abre o WhatsApp Web com o número preenchido e o
                link do arquivo PDF pronto para enviar.
                {telefoneInicial?.trim()
                  ? " Número preenchido automaticamente do cadastro."
                  : " Cadastre o WhatsApp do cliente para preencher automaticamente."}
              </p>
            </div>

            {enviando ? (
              <p className="text-center text-xs text-[#6b7280]">
                Gerando PDF e abrindo o WhatsApp Web…
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
      </div>
    </I18nPortal>,
    document.body
  );
}
