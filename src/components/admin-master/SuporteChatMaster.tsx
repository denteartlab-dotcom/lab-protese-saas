"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import type { SuporteConversaResumoDto, SuporteMensagemDto } from "@/lib/suporte-chat";
import { cn } from "@/lib/utils";

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function SuporteChatMaster() {
  const [conversas, setConversas] = useState<SuporteConversaResumoDto[]>([]);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string | null>(null);
  const [empresaNome, setEmpresaNome] = useState("");
  const [mensagens, setMensagens] = useState<SuporteMensagemDto[]>([]);
  const [texto, setTexto] = useState("");
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [carregandoChat, setCarregandoChat] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const listaRef = useRef<HTMLDivElement>(null);

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
          setErro("Não foi possível carregar a conversa.");
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
        setErro("Não foi possível carregar a conversa.");
      } finally {
        setCarregandoChat(false);
      }
    },
    [carregarConversas, rolarParaFim]
  );

  useEffect(() => {
    void carregarConversas();
    const id = window.setInterval(() => void carregarConversas(), 15000);
    return () => window.clearInterval(id);
  }, [carregarConversas]);

  useEffect(() => {
    if (!empresaSelecionada) return;
    void carregarMensagens(empresaSelecionada);
    const id = window.setInterval(
      () => void carregarMensagens(empresaSelecionada),
      5000
    );
    return () => window.clearInterval(id);
  }, [empresaSelecionada, carregarMensagens]);

  async function enviar() {
    if (!empresaSelecionada) return;
    const msg = texto.trim();
    if (!msg || enviando) return;

    setEnviando(true);
    setErro("");
    try {
      const res = await fetch(
        `/api/admin-master/suporte/conversas/${encodeURIComponent(empresaSelecionada)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: msg }),
        }
      );
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
        await carregarMensagens(empresaSelecionada);
      }
      await carregarConversas();
    } catch {
      setErro("Erro ao enviar mensagem.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Chat de suporte</h1>
          <p className="text-xs text-slate-500">
            Mensagens dos laboratórios — responda como suporte da plataforma
          </p>
        </div>
        {totalNaoLidas > 0 && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            {totalNaoLidas} não lida{totalNaoLidas !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="grid min-h-[520px] grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Conversas
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {carregandoLista && conversas.length === 0 && (
              <p className="p-4 text-center text-xs text-slate-400">Carregando...</p>
            )}
            {!carregandoLista && conversas.length === 0 && (
              <p className="p-4 text-center text-xs text-slate-400">
                Nenhuma conversa ainda.
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
              <p className="text-sm">Selecione uma conversa para responder</p>
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
                  <p className="text-center text-xs text-slate-400">Carregando...</p>
                )}
                {!carregandoChat && mensagens.length === 0 && (
                  <p className="text-center text-xs text-slate-500">
                    Nenhuma mensagem nesta conversa.
                  </p>
                )}
                {mensagens.map((m) => {
                  const ehSuporte = m.remetenteTipo === "suporte";
                  return (
                    <div
                      key={m.id}
                      className={cn("flex", ehSuporte ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-xs shadow-sm",
                          ehSuporte
                            ? "rounded-br-none bg-[#4a90d9] text-white"
                            : "rounded-bl-none bg-white text-slate-700"
                        )}
                      >
                        {!ehSuporte && (
                          <p className="mb-0.5 text-[10px] font-semibold text-slate-500">
                            {m.remetenteNome}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                        <p
                          className={cn(
                            "mt-1 text-[9px]",
                            ehSuporte ? "text-white/70" : "text-slate-400"
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
                <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">
                  {erro}
                </p>
              )}

              <div className="flex gap-2 border-t border-slate-100 p-3">
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
                  placeholder="Responder ao laboratório..."
                  className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#4a90d9]"
                />
                <button
                  type="button"
                  onClick={() => void enviar()}
                  disabled={enviando || !texto.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#4a90d9] text-white transition hover:bg-[#3a7bc8] disabled:opacity-50"
                  aria-label="Enviar resposta"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function formatarHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
