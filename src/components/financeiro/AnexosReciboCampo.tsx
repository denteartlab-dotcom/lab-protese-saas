"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { FileText, FileUp, ImageUp, Loader2, Trash2 } from "lucide-react";
import {
  arquivoEhAnexoFinanceiro,
  ACCEPT_ANEXOS_FINANCEIRO,
  ANEXOS_FINANCEIRO_VAZIOS,
  LIMITE_ANEXOS_FINANCEIRO,
  type AnexoDespesa,
  type PastaAnexoFinanceiro,
} from "@/lib/lancamento-despesa";
import {
  excluirUploadPorUrl,
  notificarUploadsAtualizados,
} from "@/lib/uploads-armazenamento";
import { useArmazenamentoGaleria } from "@/hooks/use-armazenamento-galeria";
import { cn } from "@/lib/utils";

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";

export type AnexosReciboCampoRef = {
  resolverAnexos: () => Promise<AnexoDespesa[]>;
};

type Props = {
  pasta: PastaAnexoFinanceiro;
  anexosIniciais?: AnexoDespesa[];
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
    const { lerErroUploadResponse, tratarErroUploadArmazenamento } = await import(
      "@/lib/uploads-erro-armazenamento"
    );
    const err = await lerErroUploadResponse(res);
    tratarErroUploadArmazenamento(err);
    throw new Error(err.message);
  }
  const uploaded = (await res.json()) as AnexoDespesa[];
  notificarUploadsAtualizados();
  return uploaded;
}

function chaveAnexo(anexo: AnexoDespesa, index: number) {
  return `${anexo.url}::${anexo.name}::${index}`;
}

export const AnexosReciboCampo = forwardRef<AnexosReciboCampoRef, Props>(
  function AnexosReciboCampo(
    { pasta, anexosIniciais = ANEXOS_FINANCEIRO_VAZIOS, className },
    ref
  ) {
    const anexosRef = useRef<AnexoDespesa[]>([...anexosIniciais]);
    const [lista, setLista] = useState<AnexoDespesa[]>(() => [...anexosIniciais]);
    const [enviando, setEnviando] = useState(false);
    const [erroUpload, setErroUpload] = useState<string | null>(null);
    const inputImagemRef = useRef<HTMLInputElement>(null);
    const inputPdfRef = useRef<HTMLInputElement>(null);
    const inputArquivoRef = useRef<HTMLInputElement>(null);
    const filaUploadRef = useRef<Promise<void>>(Promise.resolve());
    const { esgotado: galeriaEsgotada, podeEnviarArquivos, mensagemBloqueioUpload } =
      useArmazenamentoGaleria();

    const sincronizarLista = useCallback((proxima: AnexoDespesa[]) => {
      const limitada = proxima.slice(0, LIMITE_ANEXOS_FINANCEIRO);
      anexosRef.current = limitada;
      setLista(limitada);
    }, []);

    const adicionarArquivos = useCallback(
      (listaArquivos: FileList | null) => {
        if (!listaArquivos?.length) return;

        const candidatos = Array.from(listaArquivos).filter(arquivoEhAnexoFinanceiro);
        if (!candidatos.length) {
          setErroUpload(
            "Use imagens, PDF, Excel, Word, CSV, TXT ou ZIP/RAR."
          );
          return;
        }

        const vagas = LIMITE_ANEXOS_FINANCEIRO - anexosRef.current.length;
        if (vagas <= 0) {
          setErroUpload(`Limite de ${LIMITE_ANEXOS_FINANCEIRO} arquivos atingido.`);
          return;
        }

        const paraEnviar = candidatos.slice(0, vagas);
        const bloqueio = mensagemBloqueioUpload();
        if (bloqueio) {
          void import("@/lib/uploads-erro-armazenamento").then(({ notificarArmazenamentoCheio }) =>
            notificarArmazenamentoCheio()
          );
          setErroUpload(null);
          return;
        }
        if (!podeEnviarArquivos(paraEnviar)) {
          void import("@/lib/uploads-erro-armazenamento").then(({ notificarArmazenamentoCheio }) =>
            notificarArmazenamentoCheio()
          );
          setErroUpload(null);
          return;
        }
        setErroUpload(null);

        filaUploadRef.current = filaUploadRef.current
          .then(async () => {
            setEnviando(true);
            try {
              const enviados = await uploadAnexos(pasta, paraEnviar);
              const urlsExistentes = new Set(anexosRef.current.map((a) => a.url));
              const novos = enviados.filter((a) => !urlsExistentes.has(a.url));
              sincronizarLista([...anexosRef.current, ...novos]);
              if (candidatos.length > paraEnviar.length) {
                setErroUpload(
                  `Somente ${paraEnviar.length} arquivo(s) foram adicionados (limite de ${LIMITE_ANEXOS_FINANCEIRO}).`
                );
              }
            } catch (err) {
              const { tratarErroUploadArmazenamento } = await import(
                "@/lib/uploads-erro-armazenamento"
              );
              if (!tratarErroUploadArmazenamento(err)) {
                setErroUpload(
                  err instanceof Error ? err.message : "Não foi possível enviar os arquivos."
                );
              } else {
                setErroUpload(null);
              }
            } finally {
              setEnviando(false);
            }
          })
          .catch(() => {
            /* evita quebra da fila */
          });
      },
      [pasta, sincronizarLista, mensagemBloqueioUpload, podeEnviarArquivos]
    );

    useImperativeHandle(
      ref,
      () => ({
        async resolverAnexos() {
          await filaUploadRef.current;
          return [...anexosRef.current];
        },
      }),
      []
    );

    function removerAnexo(index: number) {
      const removido = anexosRef.current[index];
      sincronizarLista(anexosRef.current.filter((_, i) => i !== index));
      if (removido?.url) {
        void excluirUploadPorUrl(removido.url);
      }
    }

    function previewSalvo(anexo: AnexoDespesa) {
      const nome = anexo.name.toLowerCase();
      const isPdf = anexo.type === "application/pdf" || nome.endsWith(".pdf");
      const isImagem =
        (anexo.type || "").startsWith("image/") ||
        /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(nome);
      if (isImagem) {
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
      const ext =
        (nome.match(/\.([a-z0-9]+)$/i)?.[1] || (isPdf ? "pdf" : "arq")).toUpperCase();
      return (
        <div className="flex h-20 flex-col items-center justify-center gap-1 bg-slate-50 text-[#4a90d9]">
          <FileText className="h-8 w-8" />
          <span className="text-[9px] font-medium uppercase">{ext}</span>
        </div>
      );
    }

    const totalAnexos = lista.length;
    const podeAdicionar =
      totalAnexos < LIMITE_ANEXOS_FINANCEIRO && !enviando && !galeriaEsgotada;

    return (
      <div className={cn("rounded border border-slate-200 bg-slate-50/80 p-3", className)}>
        <label className={labelClass}>
          Comprovantes e anexos — imagens, PDF, Excel e outros (até{" "}
          {LIMITE_ANEXOS_FINANCEIRO})
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!podeAdicionar}
            onClick={() => inputImagemRef.current?.click()}
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
            Imagem
          </button>
          <button
            type="button"
            disabled={!podeAdicionar}
            onClick={() => inputPdfRef.current?.click()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded border px-3 py-2 text-[11px] font-medium transition",
              podeAdicionar
                ? "border-emerald-600 bg-white text-emerald-700 hover:bg-emerald-50"
                : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </button>
          <button
            type="button"
            disabled={!podeAdicionar}
            onClick={() => inputArquivoRef.current?.click()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded border px-3 py-2 text-[11px] font-medium transition",
              podeAdicionar
                ? "border-slate-500 bg-white text-slate-700 hover:bg-slate-100"
                : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            )}
          >
            <FileUp className="h-3.5 w-3.5" />
            Excel / arquivo
          </button>
          <span className="text-[10px] text-slate-500">
            {totalAnexos}/{LIMITE_ANEXOS_FINANCEIRO} · máx. 4 MB cada
          </span>
        </div>
        <input
          ref={inputImagemRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="sr-only"
          disabled={!podeAdicionar}
          onChange={(e) => {
            adicionarArquivos(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={inputPdfRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          disabled={!podeAdicionar}
          onChange={(e) => {
            adicionarArquivos(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={inputArquivoRef}
          type="file"
          accept={ACCEPT_ANEXOS_FINANCEIRO}
          multiple
          className="sr-only"
          disabled={!podeAdicionar}
          onChange={(e) => {
            adicionarArquivos(e.target.files);
            e.target.value = "";
          }}
        />
        {erroUpload ? (
          <p className="mt-2 text-[11px] text-red-600" role="alert">
            {erroUpload}
          </p>
        ) : galeriaEsgotada ? (
          <p className="mt-2 text-[11px] text-red-600" role="alert">
            {mensagemBloqueioUpload()}
          </p>
        ) : null}
        {totalAnexos > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-5">
            {lista.map((anexo, index) => (
              <div
                key={chaveAnexo(anexo, index)}
                className="relative overflow-hidden rounded border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => removerAnexo(index)}
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
            Anexe imagens, PDF, Excel, Word, CSV, TXT ou ZIP na mesma despesa.
          </p>
        )}
      </div>
    );
  }
);
