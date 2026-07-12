"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { htmlLangAttr } from "@/lib/i18n";
import type { SuporteConversaResumoDto, SuporteMensagemDto } from "@/lib/suporte-chat-types";
import { SuporteChatInput } from "@/components/suporte/SuporteChatInput";
import { SuporteMensagemBubble } from "@/components/suporte/SuporteMensagemBubble";
import { useSuporteChatRealtime } from "@/hooks/useSuporteChatRealtime";
import { cn } from "@/lib/utils";

export function SuporteChatMaster() {
  const { t, locale } = useI18n();
  const [conversas, setConversas] = useState<SuporteConversaResumoDto[]>([]);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [mensagens, setMensagens] = useState<SuporteMensagemDto[]>([]);
  const [texto, setTexto] = useState("");
  const [imagemArquivo, setImagemArquivo] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [carregandoChat, setCarregandoChat] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const listaRef = useRef<HTMLDivElement>(null);

  const formatarData = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleString(htmlLangAttr(locale), {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [locale]
  );

  const rolarParaFim = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listaRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const carregarConversas = useCallback(async () => {
    try {
      const res = await fetch("/api/admin-master/suporte/conversas", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        conversas?: SuporteConversaResumoDto[];
        totalNaoLidas?: number;
      };
      setConversas(data.conversas ?? []);
      setTotalNaoLidas(data.totalNaoLidas ?? 0);
    } finally {
      setCarregandoLista(false);
    }
  }, []);

  const carregarMensagens = useCallback(
    async (empresaId: string) => {
      setCarregandoChat(true);
      setErro("");
      try {
        const res = await fetch(
          `/api/admin-master/suporte/conversas/${encodeURIComponent(empresaId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          setErro(t("suporte.erroCarregarConversa"));
          return;
        }
        const data = (await res.json()) as {
          empresaNome?: string;
          mensagens?: SuporteMensagemDto[];
        };
        setEmpresaNome(data.empresaNome ?? "");
        setMensagens(data.mensagens ?? []);
        rolarParaFim();
        await carregarConversas();
      } catch {
        setErro(t("suporte.erroCarregarConversa"));
      } finally {
        setCarregandoChat(false);
      }
    },
    [carregarConversas, rolarParaFim, t]
  );

  useEffect(() => {
    void carregarConversas();
  }, [carregarConversas]);

  useEffect(() => {
    if (!empresaSelecionada) return;
    void carregarMensagens(empresaSelecionada);
  }, [empresaSelecionada, carregarMensagens]);

  useEffect(() => {
    return () => {
      if (imagemPreview) URL.revokeObjectURL(imagemPreview);
    };
  }, [imagemPreview]);

  useSuporteChatRealtime({
    modo: "master",
    ativo: true,
    chatAberto: Boolean(empresaSelecionada),
    empresaSelecionada,
    onNovaMensagem: ({ empresaId, mensagem }) => {
      if (empresaId === empresaSelecionada) {
        setMensagens((prev) => {
          if (prev.some((m) => m.id === mensagem.id)) return prev;
          return [...prev, mensagem];
        });
        rolarParaFim();
      }
      void carregarConversas();
    },
    onConversasAtualizadas: () => {
      void carregarConversas();
    },
  });

  function selecionarImagem(file: File | null) {
    if (imagemPreview) URL.revokeObjectURL(imagemPreview);
    setImagemArquivo(file);
    setImagemPreview(file ? URL.createObjectURL(file) : null);
  }

  async function enviar() {
    if (!empresaSelecionada) return;
    const msg = texto.trim();
    if ((!msg && !imagemArquivo) || enviando) return;

    setEnviando(true);
    setErro("");
    try {
      const formData = new FormData();
      if (msg) formData.append("texto", msg);
      if (imagemArquivo) formData.append("imagem", imagemArquivo);

      const res = await fetch(
        `/api/admin-master/suporte/conversas/${encodeURIComponent(empresaSelecionada)}`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { error?: string }).error || t("suporte.erroEnviar"));
        return;
      }
      setTexto("");
      selecionarImagem(null);
      const nova = (data as { mensagem?: SuporteMensagemDto }).mensagem;
      if (nova) {
        setMensagens((prev) => {
          if (prev.some((m) => m.id === nova.id)) return prev;
          return [...prev, nova];
        });
        rolarParaFim();
      } else {
        await carregarMensagens(empresaSelecionada);
      }
      await carregarConversas();
    } catch {
      setErro(t("suporte.erroEnviarMensagem"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">{t("suporte.chatMasterTitulo")}</h1>
          <p className="text-xs text-slate-500">{t("suporte.chatMasterSubtitulo")}</p>
        </div>
        {totalNaoLidas > 0 && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            {t("suporte.naoLidas", {
              n: totalNaoLidas,
              plural: totalNaoLidas !== 1 ? "s" : "",
            })}
          </span>
        )}
      </div>

      <div className="grid min-h-[520px] grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t("suporte.conversas")}
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {carregandoLista && conversas.length === 0 && (
              <p className="p-4 text-center text-xs text-slate-400">{t("suporte.carregando")}</p>
            )}
            {!carregandoLista && conversas.length === 0 && (
              <p className="p-4 text-center text-xs text-slate-400">
                {t("suporte.nenhumaConversa")}
              </p>
            )}
            {conversas.map((c) => (
              <button
                key={c.empresaId}
                type="button"
                onClick={() => setEmpresaSelecionada(c.empresaId)}
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b border-slate-50 px-3 py-3 text-left transition hover:bg-slate-50",
                  empresaSelecionada === c.empresaId && "bg-blue-50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-slate-800">
                    {c.empresaNome}
                  </span>
                  {c.naoLidas > 0 && (
                    <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      {c.naoLidas}
                    </span>
                  )}
                </div>
                {c.ultimaMensagemTexto && (
                  <span className="truncate text-[10px] text-slate-500">
                    {c.ultimaMensagemTexto}
                  </span>
                )}
                <span className="text-[9px] text-slate-400">
                  {formatarData(c.ultimaMensagemEm)}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[400px] flex-col">
          {!empresaSelecionada ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-slate-400">
              <MessageCircle className="h-10 w-10 opacity-40" />
              <p className="text-sm">{t("suporte.selecionarConversa")}</p>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{empresaNome}</p>
              </div>

              <div
                ref={listaRef}
                className="flex flex-1 flex-col gap-2 overflow-y-auto bg-slate-50 p-4"
              >
                {carregandoChat && mensagens.length === 0 && (
                  <p className="text-center text-xs text-slate-400">{t("suporte.carregando")}</p>
                )}
                {!carregandoChat && mensagens.length === 0 && (
                  <p className="text-center text-xs text-slate-500">
                    {t("suporte.nenhumaMensagemConversa")}
                  </p>
                )}
                {mensagens.map((m) => (
                  <SuporteMensagemBubble
                    key={m.id}
                    mensagem={m}
                    alinhamento={m.remetenteTipo === "suporte" ? "direita" : "esquerda"}
                  />
                ))}
              </div>

              {erro && (
                <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">
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
                placeholder={t("suporte.responderLaboratorio")}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
