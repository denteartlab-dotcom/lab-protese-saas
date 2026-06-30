"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import type { SuporteMensagemDto } from "@/lib/suporte-chat";
import { cn } from "@/lib/utils";

export const EVENTO_ABRIR_SUPORTE_CHAT = "lab-protese:abrir-suporte-chat";

function formatarHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function SuporteChatWidget() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<SuporteMensagemDto[]>([]);
  const [suporteEmail, setSuporteEmail] = useState("admin@labprotese.com");
  const [texto, setTexto] = useState("");
  const [naoLidas, setNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const listaRef = useRef<HTMLDivElement>(null);

  const rolarParaFim = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listaRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const carregarContagem = useCallback(async () => {
    try {
      const res = await fetch("/api/suporte/chat?contagem=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { naoLidas?: number };
      setNaoLidas(data.naoLidas ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  const carregarMensagens = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/suporte/chat", { cache: "no-store" });
      if (!res.ok) {
        setErro("Não foi possível carregar o chat.");
        return;
      }
      const data = (await res.json()) as {
        mensagens: SuporteMensagemDto[];
        suporteEmail?: string;
        naoLidas?: number;
      };
      setMensagens(data.mensagens ?? []);
      if (data.suporteEmail) setSuporteEmail(data.suporteEmail);
      setNaoLidas(data.naoLidas ?? 0);
      rolarParaFim();
    } catch {
      setErro("Não foi possível carregar o chat.");
    } finally {
      setCarregando(false);
    }
  }, [rolarParaFim]);

  useEffect(() => {
    void carregarContagem();
    const id = window.setInterval(() => void carregarContagem(), 30000);
    return () => window.clearInterval(id);
  }, [carregarContagem]);

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENTO_ABRIR_SUPORTE_CHAT, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_SUPORTE_CHAT, abrir);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    void carregarMensagens();
    const id = window.setInterval(() => void carregarMensagens(), 5000);
    return () => window.clearInterval(id);
  }, [aberto, carregarMensagens]);

  async function enviar() {
    const msg = texto.trim();
    if (!msg || enviando) return;

    setEnviando(true);
    setErro("");
    try {
      const res = await fetch("/api/suporte/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: msg }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { error?: string }).error || "Erro ao enviar.");
        return;
      }
      setTexto("");
      const nova = (data as { mensagem?: SuporteMensagemDto }).mensagem;
      if (nova) {
        setMensagens((prev) => [...prev, nova]);
        rolarParaFim();
      } else {
        await carregarMensagens();
      }
    } catch {
      setErro("Erro ao enviar mensagem.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#4a90d9] text-white shadow-lg transition hover:bg-[#3a7bc8] sm:bottom-6 sm:right-6"
        title="Chat com suporte"
        aria-label="Abrir chat com suporte"
      >
        <MessageCircle className="h-5 w-5" />
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="fixed bottom-36 right-4 z-50 flex w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl sm:bottom-20">
          <div className="flex items-center justify-between border-b border-slate-100 bg-[#4a90d9] px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Suporte Lab Prótese</p>
              <p className="text-[11px] text-white/80">{suporteEmail}</p>
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded p-1 hover:bg-white/15"
              aria-label="Fechar chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={listaRef}
            className="flex max-h-[min(50vh,360px)] min-h-[220px] flex-1 flex-col gap-2 overflow-y-auto bg-slate-50 p-3"
          >
            {carregando && mensagens.length === 0 && (
              <p className="text-center text-xs text-slate-400">Carregando...</p>
            )}
            {!carregando && mensagens.length === 0 && (
              <p className="text-center text-xs text-slate-500">
                Envie uma mensagem para falar com nossa equipe de suporte.
              </p>
            )}
            {mensagens.map((m) => {
              const ehSuporte = m.remetenteTipo === "suporte";
              return (
                <div
                  key={m.id}
                  className={cn("flex", ehSuporte ? "justify-start" : "justify-end")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-xs shadow-sm",
                      ehSuporte
                        ? "rounded-bl-none bg-white text-slate-700"
                        : "rounded-br-none bg-[#4a90d9] text-white"
                    )}
                  >
                    {ehSuporte && (
                      <p className="mb-0.5 text-[10px] font-semibold text-[#4a90d9]">
                        {m.remetenteNome}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                    <p
                      className={cn(
                        "mt-1 text-[9px]",
                        ehSuporte ? "text-slate-400" : "text-white/70"
                      )}
                    >
                      {formatarHora(m.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {erro && (
            <p className="border-t border-red-100 bg-red-50 px-3 py-1.5 text-[11px] text-red-600">
              {erro}
            </p>
          )}

          <div className="flex gap-2 border-t border-slate-100 bg-white p-3">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar();
                }
              }}
              rows={2}
              placeholder="Digite sua mensagem..."
              className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#4a90d9]"
            />
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={enviando || !texto.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#4a90d9] text-white transition hover:bg-[#3a7bc8] disabled:opacity-50"
              aria-label="Enviar mensagem"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function abrirSuporteChat() {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_SUPORTE_CHAT));
}
