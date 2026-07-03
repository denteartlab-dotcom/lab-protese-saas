"use client";

import type { SuporteMensagemDto } from "@/lib/suporte-chat-types";
import { cn } from "@/lib/utils";

function formatarHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function SuporteMensagemBubble({
  mensagem,
  alinhamento,
}: {
  mensagem: SuporteMensagemDto;
  alinhamento: "esquerda" | "direita";
}) {
  const ehDireita = alinhamento === "direita";
  const mostrarNome =
    (mensagem.remetenteTipo === "suporte" && !ehDireita) ||
    (mensagem.remetenteTipo === "usuario" && !ehDireita);

  return (
    <div className={cn("flex", ehDireita ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-xs shadow-sm",
          ehDireita
            ? "rounded-br-none bg-[#4a90d9] text-white"
            : "rounded-bl-none bg-white text-slate-700"
        )}
      >
        {mostrarNome && (
          <p
            className={cn(
              "mb-0.5 text-[10px] font-semibold",
              ehDireita ? "text-white/90" : "text-[#4a90d9]"
            )}
          >
            {mensagem.remetenteNome}
          </p>
        )}
        {mensagem.imagemUrl ? (
          <a
            href={mensagem.imagemUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-1 block overflow-hidden rounded-md"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mensagem.imagemUrl}
              alt="Imagem enviada no chat"
              className="max-h-48 max-w-full object-contain"
            />
          </a>
        ) : null}
        {mensagem.texto ? (
          <p className="whitespace-pre-wrap break-words">{mensagem.texto}</p>
        ) : null}
        <p
          className={cn(
            "mt-1 text-[9px]",
            ehDireita ? "text-white/70" : "text-slate-400"
          )}
        >
          {formatarHora(mensagem.createdAt)}
        </p>
      </div>
    </div>
  );
}
