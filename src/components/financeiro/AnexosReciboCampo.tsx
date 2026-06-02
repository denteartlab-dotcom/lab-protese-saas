"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { FileText, ImageUp, Loader2, Trash2 } from "lucide-react";
import {
  ACCEPT_ANEXOS_FINANCEIRO,
  arquivoEhAnexoFinanceiro,
  LIMITE_ANEXOS_FINANCEIRO,
  type AnexoDespesa,
  type PastaAnexoFinanceiro,
} from "@/lib/lancamento-despesa";
import { notificarUploadsAtualizados } from "@/lib/uploads-armazenamento";
import { cn } from "@/lib/utils";

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";

export type AnexosReciboCampoRef = {
  resolverAnexos: () => Promise<AnexoDespesa[]>;
};

type Props = {
  pasta: PastaAnexoFinanceiro;
  anexosIniciais?: AnexoDespesa[];
  /** Quando o modal abre/fecha, reinicia a lista salva. */
  resetToken?: boolean | number;
  className?: string;
};

async function uploadAnexos(
  pasta: PastaAnexoFinanceiro,
  arquivos: File[]
): Promise<AnexoDespesa[]> {
  if (!arquivos.length) return [];
  const formData = new FormData();
  arquivos.forEach((arquivo) => formData.append("files", arquivo));
  const res = await fetch(`/api/uploads?pasta=${pasta}`, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.error === "string" ? err.error : "Não foi possível enviar os arquivos."
    );
  }
  const uploaded = (await res.json()) as AnexoDespesa[];
  notificarUploadsAtualizados();
  return uploaded;
}

export const AnexosReciboCampo = forwardRef<AnexosReciboCampoRef, Props>(
  function AnexosReciboCampo({ pasta, anexosIniciais = [], resetToken, className }, ref) {
    const [anexosSalvos, setAnexosSalvos] = useState<AnexoDespesa[]>([]);
    const [enviando, setEnviando] = useState(false);
    const [erroUpload, setErroUpload] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      setAnexosSalvos([...anexosIniciais]);
      setErroUpload(null);
    }, [resetToken, anexosIniciais]);

    const totalAnexos = anexosSalvos.length;

    useImperativeHandle(ref, () => ({
      async resolverAnexos() {
        if (enviando) {
          throw new Error("Aguarde o envio dos arquivos terminar.");
        }
        return anexosSalvos.slice(0, LIMITE_ANEXOS_FINANCEIRO);
      },
    }));

    async function adicionarArquivos(lista: FileList | null) {
      if (!lista?.length || enviando) return;
      const vagas = LIMITE_ANEXOS_FINANCEIRO - totalAnexos;
      if (vagas <= 0) return;

      const candidatos = Array.from(lista).filter(arquivoEhAnexoFinanceiro);
      if (!candidatos.length) {
        setErroUpload("Use imagens (JPEG, PNG, HEIC, etc.) ou arquivos PDF.");
        return;
      }

      const paraEnviar = candidatos.slice(0, vagas);
      setErroUpload(null);
      setEnviando(true);
      try {
        const enviados = await uploadAnexos(pasta, paraEnviar);
        setAnexosSalvos((atual) =>
          [...atual, ...enviados].slice(0, LIMITE_ANEXOS_FINANCEIRO)
        );
        if (candidatos.length > paraEnviar.length) {
          setErroUpload(
            `Somente ${paraEnviar.length} arquivo(s) foram adicionados (limite de ${LIMITE_ANEXOS_FINANCEIRO}).`
          );
        }
      } catch (err) {
        setErroUpload(
          err instanceof Error ? err.message : "Não foi possível enviar os arquivos."
        );
      } finally {
        setEnviando(false);
      }
    }

    function previewSalvo(anexo: AnexoDespesa) {
      const isPdf =
        anexo.type === "application/pdf" || anexo.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        return (
          <div className="flex h-20 flex-col items-center justify-center gap-1 bg-slate-50 text-[#4a90d9]">
            <FileText className="h-8 w-8" />
            <span className="text-[9px] font-medium uppercase">PDF</span>
          </div>
        );
      }
      return (
        <Image
          src={anexo.url}
          alt={anexo.name}
          width={120}
          height={96}
          unoptimized
          className="h-20 w-full object-cover"
        />
      );
    }

    const podeAdicionar = totalAnexos < LIMITE_ANEXOS_FINANCEIRO && !enviando;

    return (
      <div className={cn("rounded border border-slate-200 bg-slate-50/80 p-3", className)}>
        <label className={labelClass}>Recibos e comprovantes (imagens ou PDF)</label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!podeAdicionar}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded border px-3 py-2 text-[11px] font-medium transition",
              podeAdicionar
                ? "border-[#4a90d9] bg-white text-[#4a90d9] hover:bg-[#f0f7ff]"
                : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            )}
          >
            {enviando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageUp className="h-3.5 w-3.5" />
            )}
            {enviando
              ? "Enviando…"
              : totalAnexos >= LIMITE_ANEXOS_FINANCEIRO
                ? `Limite de ${LIMITE_ANEXOS_FINANCEIRO} arquivos`
                : "Adicionar imagens ou PDF"}
          </button>
          <span className="text-[10px] text-slate-500">
            {totalAnexos}/{LIMITE_ANEXOS_FINANCEIRO} · máx. 4 MB por arquivo
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ANEXOS_FINANCEIRO}
          multiple
          className="sr-only"
          disabled={!podeAdicionar}
          onChange={(e) => {
            void adicionarArquivos(e.target.files);
            e.target.value = "";
          }}
        />
        {erroUpload ? (
          <p className="mt-2 text-[11px] text-red-600" role="alert">
            {erroUpload}
          </p>
        ) : null}
        {totalAnexos > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-5">
            {anexosSalvos.map((anexo) => (
              <div
                key={anexo.url}
                className="relative overflow-hidden rounded border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    setAnexosSalvos((lista) => lista.filter((a) => a.url !== anexo.url))
                  }
                  className="absolute right-1 top-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-red-600 shadow hover:bg-red-50"
                  title="Remover arquivo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <a href={anexo.url} target="_blank" rel="noreferrer">
                  {previewSalvo(anexo)}
                </a>
                <p className="truncate px-1 py-0.5 text-[9px] text-slate-500">{anexo.name}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-slate-500">
            Os arquivos são enviados assim que você seleciona. Depois clique em Cadastrar para
            salvar a despesa.
          </p>
        )}
      </div>
    );
  }
);
