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
import { FileText, ImageUp, Trash2 } from "lucide-react";
import {
  ACCEPT_ANEXOS_FINANCEIRO,
  arquivoEhAnexoFinanceiro,
  LIMITE_ANEXOS_FINANCEIRO,
  type AnexoDespesa,
  type PastaAnexoFinanceiro,
} from "@/lib/lancamento-despesa";
import { notificarUploadsAtualizados } from "@/lib/uploads-armazenamento";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 w-full max-w-[220px] rounded border border-slate-300 bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";
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

async function uploadAnexos(pasta: PastaAnexoFinanceiro, arquivos: File[]): Promise<AnexoDespesa[]> {
  if (!arquivos.length) return [];
  const formData = new FormData();
  arquivos.forEach((arquivo) => formData.append("files", arquivo));
  const res = await fetch(`/api/uploads?pasta=${pasta}`, {
    method: "POST",
    body: formData,
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
    const [anexosNovos, setAnexosNovos] = useState<File[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const previewsNovos = useMemo(
      () =>
        anexosNovos.map((file) => ({
          file,
          url: URL.createObjectURL(file),
          isImage: file.type.startsWith("image/"),
          isPdf: file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
        })),
      [anexosNovos]
    );

    useEffect(() => {
      return () => {
        previewsNovos.forEach((p) => URL.revokeObjectURL(p.url));
      };
    }, [previewsNovos]);

    useEffect(() => {
      setAnexosSalvos([...anexosIniciais]);
      setAnexosNovos([]);
    }, [resetToken, anexosIniciais]);

    const totalAnexos = anexosSalvos.length + anexosNovos.length;

    useImperativeHandle(ref, () => ({
      async resolverAnexos() {
        const enviados =
          anexosNovos.length > 0 ? await uploadAnexos(pasta, anexosNovos) : [];
        return [...anexosSalvos, ...enviados].slice(0, LIMITE_ANEXOS_FINANCEIRO);
      },
    }));

    function adicionarArquivos(lista: FileList | null) {
      if (!lista?.length) return;
      const vagas = LIMITE_ANEXOS_FINANCEIRO - totalAnexos;
      if (vagas <= 0) return;
      const candidatos = Array.from(lista).filter(arquivoEhAnexoFinanceiro);
      if (!candidatos.length) {
        alert("Selecione imagens (JPEG, PNG, etc.) ou arquivos PDF.");
        return;
      }
      setAnexosNovos((atual) => [...atual, ...candidatos.slice(0, vagas)]);
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

    return (
      <div className={cn("rounded border border-slate-200 bg-slate-50/80 p-3", className)}>
        <label className={labelClass}>Recibos e comprovantes (imagens ou PDF)</label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={selectClass}
            value=""
            disabled={totalAnexos >= LIMITE_ANEXOS_FINANCEIRO}
            onChange={(e) => {
              if (e.target.value === "adicionar") inputRef.current?.click();
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              {totalAnexos >= LIMITE_ANEXOS_FINANCEIRO
                ? `Limite de ${LIMITE_ANEXOS_FINANCEIRO} arquivos`
                : "Escolha uma opção…"}
            </option>
            <option value="adicionar">+ Adicionar arquivos</option>
          </select>
          <span className="text-[10px] text-slate-500">
            {totalAnexos}/{LIMITE_ANEXOS_FINANCEIRO} arquivos (máx. {LIMITE_ANEXOS_FINANCEIRO})
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ANEXOS_FINANCEIRO}
          multiple
          className="sr-only"
          onChange={(e) => {
            adicionarArquivos(e.target.files);
            e.target.value = "";
          }}
        />
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
            {previewsNovos.map((preview, index) => (
              <div
                key={`${preview.file.name}-${preview.file.size}`}
                className="relative overflow-hidden rounded border border-emerald-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    setAnexosNovos((lista) => lista.filter((_, i) => i !== index))
                  }
                  className="absolute right-1 top-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-red-600 shadow hover:bg-red-50"
                  title="Remover arquivo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                {preview.isImage ? (
                  <Image
                    src={preview.url}
                    alt={preview.file.name}
                    width={120}
                    height={96}
                    unoptimized
                    className="h-20 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-20 flex-col items-center justify-center gap-1 bg-slate-50 text-emerald-700">
                    <FileText className="h-8 w-8" />
                    <span className="text-[9px] font-medium uppercase">PDF</span>
                  </div>
                )}
                <p className="truncate px-1 py-0.5 text-[9px] text-slate-500">
                  {preview.file.name}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-2 inline-flex items-center gap-1.5 rounded border border-dashed border-slate-300 bg-white px-3 py-2 text-[11px] text-slate-600 hover:border-[#4a90d9] hover:text-[#4a90d9]"
          >
            <ImageUp className="h-3.5 w-3.5" />
            Selecionar imagens ou PDF
          </button>
        )}
      </div>
    );
  }
);
