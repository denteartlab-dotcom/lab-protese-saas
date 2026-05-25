"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Upload, X } from "lucide-react";
import { Button } from "@/components/ui";
import {
  LOGO_TAMANHO_MAX,
  LOGO_TAMANHO_MIN,
  LOGO_TAMANHO_PADRAO,
  normalizarLogoTamanho,
} from "@/lib/lab-impressao";
import { arquivoParaLogoDataUrl, escalaLogoMultiplicador } from "@/lib/lab-logo";
import type { TipoMensagemForm } from "@/components/DadosLaboratorioForm";

type Props = {
  logoDataUrl: string;
  logoTamanho: number;
  onChange: (patch: { logoDataUrl?: string; logoTamanho?: number }) => void;
  onSalvar: (patch: { logoDataUrl: string; logoTamanho: number }) => void | Promise<void>;
  mensagem?: string;
  mensagemTipo?: TipoMensagemForm;
  onMensagem?: (texto: string, tipo?: TipoMensagemForm) => void;
};

export function LogoLaboratorioTab({
  logoDataUrl,
  logoTamanho,
  onChange,
  onSalvar,
  mensagem = "",
  mensagemTipo = "info",
  onMensagem,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(logoDataUrl);
  const [tamanho, setTamanho] = useState(() => normalizarLogoTamanho(logoTamanho));
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    setPreview(logoDataUrl);
    setTamanho(normalizarLogoTamanho(logoTamanho));
  }, [logoDataUrl, logoTamanho]);

  async function selecionarArquivo(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onMensagem?.("Selecione um arquivo de imagem (JPG, PNG ou WebP).", "erro");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onMensagem?.("A imagem deve ter no máximo 5 MB.", "erro");
      return;
    }
    setProcessando(true);
    try {
      const dataUrl = await arquivoParaLogoDataUrl(file);
      setPreview(dataUrl);
      setTamanho(LOGO_TAMANHO_PADRAO);
      onChange({ logoDataUrl: dataUrl, logoTamanho: LOGO_TAMANHO_PADRAO });
      onMensagem?.("Imagem carregada. Clique em Gravar Imagem para salvar.", "info");
    } catch {
      onMensagem?.("Não foi possível processar a imagem.", "erro");
    } finally {
      setProcessando(false);
    }
  }

  async function gravar() {
    if (!preview) return;
    const patch = { logoDataUrl: preview, logoTamanho: tamanho };
    onChange(patch);
    setProcessando(true);
    try {
      await onSalvar(patch);
      onMensagem?.("Foto do logo salva com sucesso.", "sucesso");
    } catch {
      onMensagem?.("Não foi possível gravar o logo. Tente novamente.", "erro");
    } finally {
      setProcessando(false);
    }
  }

  async function limpar() {
    setPreview("");
    setTamanho(LOGO_TAMANHO_PADRAO);
    const patch = { logoDataUrl: "", logoTamanho: LOGO_TAMANHO_PADRAO };
    onChange(patch);
    setProcessando(true);
    try {
      await onSalvar(patch);
      onMensagem?.(
        "Logo removido do login, das impressões da OS e das notas de cobrança.",
        "sucesso"
      );
    } catch {
      onMensagem?.("Não foi possível remover o logo no servidor.", "erro");
    } finally {
      setProcessando(false);
    }
  }

  const escalaPreview = escalaLogoMultiplicador(tamanho);

  return (
    <div className="mx-auto max-w-lg py-4">
      <h2 className="mb-4 text-center text-[15px] font-normal text-slate-800">
        Logomarca do Laboratório
      </h2>

      <div className="rounded border border-slate-200 bg-[#f8f9fb] px-6 py-8">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processando}
          className="mx-auto flex w-full max-w-[320px] flex-col items-center justify-center rounded border-2 border-dashed border-slate-300 bg-white py-10 transition hover:border-[#4a90d9] hover:bg-slate-50"
        >
          {preview ? (
            <img
              src={preview}
              alt="Pré-visualização do logo"
              className={
                tamanho === 0
                  ? "max-w-full object-contain"
                  : "max-h-28 object-contain transition-transform"
              }
              style={
                tamanho > 0
                  ? { transform: `scale(${escalaPreview})`, transformOrigin: "center" }
                  : undefined
              }
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-slate-300 bg-slate-50 text-slate-400">
              <Upload className="h-10 w-10" strokeWidth={1.5} />
            </div>
          )}
          <span className="mt-3 text-xs text-slate-500">
            {processando ? "Processando..." : "Clique para enviar a logomarca"}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            void selecionarArquivo(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        <div className="mx-auto mt-6 max-w-[280px]">
          <label className="mb-1 block text-center text-[12px] text-slate-600">
            Tamanho do logo: {tamanho}%
          </label>
          <input
            type="range"
            min={LOGO_TAMANHO_MIN}
            max={LOGO_TAMANHO_MAX}
            step={1}
            value={tamanho}
            onChange={(e) => {
              const v = Number(e.target.value);
              setTamanho(v);
              if (preview) onChange({ logoTamanho: v });
            }}
            className="h-2 w-full cursor-pointer accent-[#4a90d9]"
          />
        </div>
      </div>

      {mensagem ? (
        <p
          role="alert"
          className={`mt-4 text-center text-sm font-medium ${
            mensagemTipo === "sucesso"
              ? "text-emerald-600"
              : mensagemTipo === "erro"
                ? "text-red-600"
                : "text-slate-600"
          }`}
        >
          {mensagem}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          onClick={gravar}
          disabled={!preview}
          className="inline-flex items-center gap-2 rounded bg-emerald-600 px-5 py-2 text-sm font-normal text-white hover:bg-emerald-700"
        >
          <Save className="h-4 w-4" />
          Gravar Imagem
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={limpar}
          className="inline-flex items-center gap-2 rounded border-[#4a90d9] px-5 py-2 text-sm font-normal text-[#4a90d9] hover:bg-[#4a90d9]/5"
        >
          <X className="h-4 w-4" />
          Limpar
        </Button>
      </div>

      <p className="mt-4 text-center text-[11px] text-slate-500">
        O logo aparece no perfil do topo, na requisição/OS, no login e na nota de
        cobrança.
      </p>
    </div>
  );
}
