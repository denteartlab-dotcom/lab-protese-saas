"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { excluirUploadPorUrl } from "@/lib/uploads-armazenamento";

type Props = {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
};

export function ProdutoFotoCampo({ value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function onSelecionarArquivo(file: File | null) {
    if (!file || disabled || enviando) return;
    setErro("");
    if (!file.type.startsWith("image/")) {
      setErro("Selecione um arquivo de imagem.");
      return;
    }
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch("/api/uploads?pasta=produtos", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      if (!res.ok) {
        const { lerErroUploadResponse, tratarErroUploadArmazenamento } = await import(
          "@/lib/uploads-erro-armazenamento"
        );
        const err = await lerErroUploadResponse(res);
        if (tratarErroUploadArmazenamento(err)) {
          throw new Error(err.message);
        }
        throw new Error(err.message || "Não foi possível enviar a foto.");
      }
      const uploaded = (await res.json()) as Array<{ url?: string }>;
      const url = uploaded[0]?.url?.trim();
      if (!url) throw new Error("Resposta de upload inválida.");
      const anterior = value.trim();
      if (anterior && anterior !== url) {
        void excluirUploadPorUrl(anterior);
      }
      onChange(url);
    } catch (err) {
      const { tratarErroUploadArmazenamento } = await import(
        "@/lib/uploads-erro-armazenamento"
      );
      if (!tratarErroUploadArmazenamento(err)) {
        setErro(err instanceof Error ? err.message : "Falha no upload da foto.");
      } else {
        setErro("");
      }
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-slate-600">Foto do produto</p>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Foto do produto" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-5 w-5 text-slate-300" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled || enviando}
            onChange={(e) => void onSelecionarArquivo(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={disabled || enviando}
            onClick={() => inputRef.current?.click()}
            className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {enviando ? "Enviando..." : value ? "Trocar foto" : "Adicionar foto"}
          </button>
          {value ? (
            <button
              type="button"
              disabled={disabled || enviando}
              onClick={() => {
                const anterior = value.trim();
                onChange("");
                if (anterior) void excluirUploadPorUrl(anterior);
              }}
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover
            </button>
          ) : null}
        </div>
      </div>
      {erro ? <p className="text-[10px] text-rose-600">{erro}</p> : null}
      <p className="text-[10px] text-slate-400">
        A foto aparece automaticamente nos orçamentos deste produto. Máx. 4 MB.
      </p>
    </div>
  );
}
