"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ImageIcon, Loader2, Upload, User } from "lucide-react";
import {
  arquivoEhAnexoFinanceiro,
  ACCEPT_ANEXOS_FINANCEIRO,
  desempacotarDespesa,
  empacotarDespesa,
  LIMITE_ANEXOS_FINANCEIRO,
  type AnexoDespesa,
} from "@/lib/lancamento-despesa";
import { notificarUploadsAtualizados } from "@/lib/uploads-armazenamento";
import { cn } from "@/lib/utils";

type LancamentoBasico = {
  id: string;
  descricao: string;
};

type Props = {
  open: boolean;
  lancamentoIds: string[];
  lancamentos: LancamentoBasico[];
  onClose: () => void;
  onSalvo: () => void;
};

async function uploadAnexos(arquivos: File[]): Promise<AnexoDespesa[]> {
  if (!arquivos.length) return [];
  const formData = new FormData();
  arquivos.forEach((arquivo) => formData.append("files", arquivo));
  const res = await fetch("/api/uploads?pasta=despesas", {
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

async function salvarAnexosNosLancamentos(
  ids: string[],
  lancamentos: LancamentoBasico[],
  novosAnexos: AnexoDespesa[]
) {
  for (const id of ids) {
    const lanc = lancamentos.find((item) => item.id === id);
    if (!lanc) continue;
    const pack = desempacotarDespesa(lanc.descricao);
    const atuais = pack.meta.anexos || [];
    const merged = [...atuais, ...novosAnexos].slice(0, LIMITE_ANEXOS_FINANCEIRO);
    const novaDescricao = empacotarDespesa(pack.texto, {
      ...pack.meta,
      anexos: merged,
    });
    const res = await fetch(`/api/financeiro/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descricao: novaDescricao }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error || "Não foi possível vincular o comprovante à despesa.");
    }
  }
}

function rotuloArquivos(arquivos: File[]) {
  if (!arquivos.length) return "";
  if (arquivos.length === 1) return arquivos[0].name;
  return `${arquivos.length} arquivo(s) selecionado(s)`;
}

export function AdicionarImagensComprovanteModal({
  open,
  lancamentoIds,
  lancamentos,
  onClose,
  onSalvo,
}: Props) {
  const [portalPronto, setPortalPronto] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [webcamAtiva, setWebcamAtiva] = useState(false);
  const [webcamErro, setWebcamErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const pararWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setWebcamAtiva(false);
  }, []);

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setArquivos([]);
      setErro(null);
      setWebcamErro("");
      pararWebcam();
    }
  }, [open, pararWebcam]);

  useEffect(() => {
    return () => {
      pararWebcam();
    };
  }, [pararWebcam]);

  function adicionarArquivos(lista: FileList | null) {
    if (!lista?.length) return;
    const candidatos = Array.from(lista).filter(arquivoEhAnexoFinanceiro);
    if (!candidatos.length) {
      setErro("Use imagens (JPEG, PNG, HEIC, etc.) ou arquivos PDF.");
      return;
    }
    const vagas = LIMITE_ANEXOS_FINANCEIRO - arquivos.length;
    if (vagas <= 0) {
      setErro(`Limite de ${LIMITE_ANEXOS_FINANCEIRO} arquivos atingido.`);
      return;
    }
    setErro(null);
    setArquivos((listaAtual) => [...listaAtual, ...candidatos.slice(0, vagas)]);
  }

  async function iniciarWebcam() {
    if (webcamAtiva) {
      pararWebcam();
      return;
    }
    setWebcamErro("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setWebcamAtiva(true);
    } catch {
      setWebcamErro("Não foi possível acessar a webcam. Verifique as permissões do navegador.");
      pararWebcam();
    }
  }

  function capturarWebcam() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !webcamAtiva) return;
    const largura = video.videoWidth;
    const altura = video.videoHeight;
    if (!largura || !altura) {
      setErro("Aguarde a câmera carregar antes de capturar.");
      return;
    }
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, largura, altura);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (arquivos.length >= LIMITE_ANEXOS_FINANCEIRO) {
          setErro(`Limite de ${LIMITE_ANEXOS_FINANCEIRO} arquivos atingido.`);
          return;
        }
        const arquivo = new File([blob], `webcam-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setErro(null);
        setArquivos((lista) => [...lista, arquivo]);
        pararWebcam();
      },
      "image/jpeg",
      0.92
    );
  }

  async function gravarImagens() {
    if (!arquivos.length) {
      setErro("Selecione ao menos uma imagem ou PDF.");
      return;
    }
    if (!lancamentoIds.length) {
      onClose();
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const enviados = await uploadAnexos(arquivos);
      await salvarAnexosNosLancamentos(lancamentoIds, lancamentos, enviados);
      onSalvo();
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível gravar as imagens.");
    } finally {
      setSalvando(false);
    }
  }

  if (!open || !portalPronto) return null;

  const conteudo = (
    <div
      className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/45 p-4"
      data-modal="adicionar-imagens-comprovante"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adicionar-imagens-titulo"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-[720px] rounded-sm border border-slate-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 id="adicionar-imagens-titulo" className="text-[15px] font-normal text-slate-800">
            Adicionar Imagens
          </h2>
        </div>

        <div className="px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col items-center rounded-sm border border-slate-200 bg-white px-4 py-6">
              {webcamAtiva ? (
                <div className="w-full space-y-3">
                  <div className="overflow-hidden rounded-sm border border-slate-200 bg-black">
                    <video
                      ref={videoRef}
                      className="aspect-[4/3] w-full object-cover"
                      muted
                      playsInline
                    />
                  </div>
                  <button
                    type="button"
                    onClick={capturarWebcam}
                    className="w-full rounded-sm border border-[#4a90d9] bg-white px-3 py-2 text-[12px] text-[#4a90d9] hover:bg-[#f0f7ff]"
                  >
                    Capturar imagem
                  </button>
                </div>
              ) : (
                <>
                  <User className="h-20 w-20 text-slate-300" strokeWidth={1} />
                  <button
                    type="button"
                    onClick={() => void iniciarWebcam()}
                    className="mt-4 inline-flex items-center gap-2 rounded-sm border border-[#4a90d9] bg-white px-4 py-2 text-[12px] text-[#4a90d9] hover:bg-[#f0f7ff]"
                  >
                    <Camera className="h-4 w-4" />
                    Imagem WebCam
                  </button>
                </>
              )}
              {webcamErro ? (
                <p className="mt-2 text-center text-[11px] text-red-600">{webcamErro}</p>
              ) : null}
            </div>

            <div className="flex flex-col items-center rounded-sm border border-slate-200 bg-white px-4 py-6">
              <ImageIcon className="h-20 w-20 text-slate-300" strokeWidth={1} />
              <div className="mt-4 flex w-full max-w-[280px]">
                <input
                  type="text"
                  readOnly
                  value={rotuloArquivos(arquivos)}
                  placeholder="Selecione Imagens"
                  className="h-9 min-w-0 flex-1 rounded-l-sm border border-r-0 border-slate-300 px-3 text-[12px] text-slate-700 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => inputArquivoRef.current?.click()}
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-r-sm border border-slate-300 bg-slate-50 px-3 text-[12px] text-slate-700 hover:bg-slate-100"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-slate-500">
                Imagens ou PDF · até {LIMITE_ANEXOS_FINANCEIRO} arquivos
              </p>
            </div>
          </div>

          {arquivos.length > 0 ? (
            <ul className="mt-4 space-y-1 rounded-sm border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              {arquivos.map((arquivo, index) => (
                <li key={`${arquivo.name}-${index}`} className="truncate">
                  {arquivo.name}
                </li>
              ))}
            </ul>
          ) : null}

          {erro ? (
            <p className="mt-3 text-[11px] text-red-600" role="alert">
              {erro}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            disabled={salvando}
            onClick={() => void gravarImagens()}
            className={cn(
              "inline-flex min-w-[130px] items-center justify-center gap-2 rounded-sm bg-[#4a90d9] px-4 py-2 text-[12px] text-white hover:bg-[#3d7fc4] disabled:opacity-60"
            )}
          >
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Gravar Imagens
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={onClose}
            className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Fechar
          </button>
        </div>
      </div>

      <input
        ref={inputArquivoRef}
        type="file"
        accept={ACCEPT_ANEXOS_FINANCEIRO}
        multiple
        className="sr-only"
        onChange={(e) => {
          adicionarArquivos(e.target.files);
          e.target.value = "";
        }}
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );

  return createPortal(conteudo, document.body);
}
