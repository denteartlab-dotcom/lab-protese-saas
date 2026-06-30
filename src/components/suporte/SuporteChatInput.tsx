"use client";

import { useRef } from "react";
import { ImagePlus, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  texto: string;
  onTextoChange: (valor: string) => void;
  imagemPreview?: string | null;
  onImagemSelecionada: (file: File | null) => void;
  onEnviar: () => void;
  enviando: boolean;
  placeholder?: string;
};

export function SuporteChatInput({
  texto,
  onTextoChange,
  imagemPreview,
  onImagemSelecionada,
  onEnviar,
  enviando,
  placeholder = "Digite sua mensagem...",
}: Props) {
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  function selecionarImagem(file: File | null) {
    if (!file) {
      onImagemSelecionada(null);
      return;
    }
    if (!file.type.startsWith("image/")) return;
    onImagemSelecionada(file);
  }

  const podeEnviar = Boolean(texto.trim() || imagemPreview) && !enviando;

  return (
    <div className="border-t border-slate-100 bg-white p-3">
      {imagemPreview ? (
        <div className="relative mb-2 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagemPreview}
            alt="Pré-visualização"
            className="max-h-24 rounded-md border border-slate-200 object-contain"
          />
          <button
            type="button"
            onClick={() => {
              onImagemSelecionada(null);
              if (inputArquivoRef.current) inputArquivoRef.current.value = "";
            }}
            className="absolute -right-2 -top-2 rounded-full bg-slate-700 p-0.5 text-white hover:bg-slate-900"
            aria-label="Remover imagem"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      <div className="flex gap-2">
        <input
          ref={inputArquivoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => selecionarImagem(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => inputArquivoRef.current?.click()}
          disabled={enviando}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
          title="Enviar imagem"
          aria-label="Enviar imagem"
        >
          <ImagePlus className="h-4 w-4" />
        </button>
        <textarea
          value={texto}
          onChange={(e) => onTextoChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (podeEnviar) onEnviar();
            }
          }}
          rows={2}
          placeholder={placeholder}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#4a90d9]"
        />
        <button
          type="button"
          onClick={onEnviar}
          disabled={!podeEnviar}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#4a90d9] text-white transition hover:bg-[#3a7bc8] disabled:opacity-50"
          )}
          aria-label="Enviar mensagem"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
