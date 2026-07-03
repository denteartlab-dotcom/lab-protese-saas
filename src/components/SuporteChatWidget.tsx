"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import type { SuporteMensagemDto } from "@/lib/suporte-chat-types";
import { SuporteChatInput } from "@/components/suporte/SuporteChatInput";
import { SuporteMensagemBubble } from "@/components/suporte/SuporteMensagemBubble";
import { useSuporteChatRealtime } from "@/hooks/useSuporteChatRealtime";

export const EVENTO_ABRIR_SUPORTE_CHAT = "lab-protese:abrir-suporte-chat";

export function SuporteChatWidget() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<SuporteMensagemDto[]>([]);
  const [suporteEmail, setSuporteEmail] = useState("admin@labprotese.com");
  const [texto, setTexto] = useState("");
  const [imagemArquivo, setImagemArquivo] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);
  const [suporteOnline, setSuporteOnline] = useState(false);
  const [conversaExpirada, setConversaExpirada] = useState(false);
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
      const res = await fetch("/api/suporte/conversa/contexto?marcarLidas=0", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { naoLidas?: number; suporteOnline?: boolean };
      setNaoLidas(data.naoLidas ?? 0);
      if (typeof data.suporteOnline === "boolean") setSuporteOnline(data.suporteOnline);
    } catch {
      /* ignore */
    }
  }, []);

  const carregarMensagens = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/suporte/conversa/contexto", { cache: "no-store" });
      if (!res.ok) {
        setErro("Não foi possível carregar o chat.");
        return;
      }
      const data = (await res.json()) as {
        mensagens: SuporteMensagemDto[];
        suporteEmail?: string;
        naoLidas?: number;
        suporteOnline?: boolean;
      };
      setMensagens(data.mensagens ?? []);
      if (data.suporteEmail) setSuporteEmail(data.suporteEmail);
      setNaoLidas(data.naoLidas ?? 0);
      if (typeof data.suporteOnline === "boolean") setSuporteOnline(data.suporteOnline);
      setConversaExpirada(false);
      rolarParaFim();
    } catch {
      setErro("Não foi possível carregar o chat.");
    } finally {
      setCarregando(false);
    }
  }, [rolarParaFim]);

  useEffect(() => {
    void carregarContagem();
  }, [carregarContagem]);

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENTO_ABRIR_SUPORTE_CHAT, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_SUPORTE_CHAT, abrir);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    void carregarMensagens();
  }, [aberto, carregarMensagens]);

  useEffect(() => {
    return () => {
      if (imagemPreview) URL.revokeObjectURL(imagemPreview);
    };
  }, [imagemPreview]);

  useSuporteChatRealtime({
    modo: "empresa",
    ativo: true,
    chatAberto: aberto,
    onNovaMensagem: ({ mensagem }) => {
      setMensagens((prev) => {
        if (prev.some((m) => m.id === mensagem.id)) return prev;
        return [...prev, mensagem];
      });
      if (!aberto && mensagem.remetenteTipo === "suporte") {
        setNaoLidas((n) => n + 1);
      }
      rolarParaFim();
    },
    onNaoLidas: setNaoLidas,
    onStatusAdmin: setSuporteOnline,
    onConversaExpirada: () => {
      setMensagens([]);
      setNaoLidas(0);
      setTexto("");
      selecionarImagem(null);
      setConversaExpirada(true);
      setErro("");
    },
  });

  function selecionarImagem(file: File | null) {
    if (imagemPreview) URL.revokeObjectURL(imagemPreview);
    setImagemArquivo(file);
    setImagemPreview(file ? URL.createObjectURL(file) : null);
  }

  async function enviar() {
    const msg = texto.trim();
    if ((!msg && !imagemArquivo) || enviando || !suporteOnline) return;

    setEnviando(true);
    setErro("");
    try {
      const formData = new FormData();
      if (msg) formData.append("texto", msg);
      if (imagemArquivo) formData.append("imagem", imagemArquivo);

      const res = await fetch("/api/suporte/chat", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { error?: string }).error || "Erro ao enviar.");
        return;
      }
      setTexto("");
      selecionarImagem(null);
      setConversaExpirada(false);
      const nova = (data as { mensagem?: SuporteMensagemDto }).mensagem;
      if (nova) {
        setMensagens((prev) => {
          if (prev.some((m) => m.id === nova.id)) return prev;
          return [...prev, nova];
        });
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

  const chatBloqueado = !suporteOnline;
  const motivoDesabilitado = conversaExpirada
    ? "Esta conversa expirou por inatividade (10 min). Inicie um novo chat quando o suporte estiver online."
    : chatBloqueado
      ? "O suporte está offline. Aguarde um atendente ficar disponível para iniciar ou continuar a conversa."
      : undefined;

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
        <div className="fixed bottom-36 right-4 z-50 flex w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:bottom-20">
          <div className="flex items-center justify-between border-b border-slate-100 bg-[#4a90d9] px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Suporte Lab Prótese</p>
              <p className="text-[11px] text-white/80">{suporteEmail}</p>
              <p className="text-[10px] text-white/70">
                {suporteOnline ? "● Online" : "○ Offline"}
              </p>
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
            className="flex max-h-[min(50vh,360px)] min-h-[220px] flex-1 flex-col gap-2 overflow-y-auto bg-slate-50 p-3 dark:bg-slate-950"
          >
            {carregando && mensagens.length === 0 && (
              <p className="text-center text-xs text-slate-400">Carregando...</p>
            )}
            {!carregando && mensagens.length === 0 && (
              <p className="text-center text-xs text-slate-500">
                {conversaExpirada
                  ? "Sua conversa anterior foi encerrada por inatividade. Envie uma nova mensagem para recomeçar."
                  : suporteOnline
                    ? "Envie uma mensagem para falar com nossa equipe de suporte."
                    : "O suporte está offline no momento. Você poderá enviar mensagens quando um atendente estiver disponível."}
              </p>
            )}
            {mensagens.map((m) => (
              <SuporteMensagemBubble
                key={m.id}
                mensagem={m}
                alinhamento={m.remetenteTipo === "suporte" ? "esquerda" : "direita"}
              />
            ))}
          </div>

          {erro && (
            <p className="border-t border-red-100 bg-red-50 px-3 py-1.5 text-[11px] text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
              {erro}
            </p>
          )}

          <SuporteChatInput
            texto={texto}
            onTextoChange={setTexto}
            imagemPreview={imagemPreview}
            onImagemSelecionada={selecionarImagem}
            onEnviar={() => void enviar()}
            enviando={enviando}
            disabled={chatBloqueado}
            motivoDesabilitado={motivoDesabilitado}
            placeholder={
              chatBloqueado
                ? "Aguardando suporte online..."
                : "Digite sua mensagem..."
            }
          />
        </div>
      )}
    </>
  );
}

export function abrirSuporteChat() {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_SUPORTE_CHAT));
}
