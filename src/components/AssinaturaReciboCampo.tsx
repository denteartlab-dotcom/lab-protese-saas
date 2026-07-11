"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, FileUp, ImageUp, PenLine } from "lucide-react";
import { Button } from "@/components/ui";
import { pdfPrimeiraPaginaParaDataUrl } from "@/lib/pdf-pagina-imagem";

const LARGURA = 420;
const ALTURA = 130;
/** Posição Y da linha-guia (assinatura apoiada aqui no recibo). */
const LINHA_ASSINATURA_Y = ALTURA - 28;
const MARGEM_LINHA = 24;

type Props = {
  value: string;
  onChange: (dataUrl: string) => void;
};

function desenharGuiaAssinatura(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(MARGEM_LINHA, LINHA_ASSINATURA_Y);
  ctx.lineTo(LARGURA - MARGEM_LINHA, LINHA_ASSINATURA_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function AssinaturaReciboCampo({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const ultimoPonto = useRef<{ x: number; y: number } | null>(null);
  const inputImagem = useRef<HTMLInputElement>(null);
  const inputPdf = useRef<HTMLInputElement>(null);
  const ignorarProximaCarga = useRef(false);
  const [carregandoPdf, setCarregandoPdf] = useState(false);
  const [erroUpload, setErroUpload] = useState("");

  const limparCanvas = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, LARGURA, ALTURA);
    desenharGuiaAssinatura(ctx);
  }, []);

  const carregarImagem = useCallback(
    (dataUrl: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      limparCanvas(ctx);
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(
          (LARGURA - MARGEM_LINHA * 2) / img.width,
          (LINHA_ASSINATURA_Y - 8) / img.height,
          1
        );
        const w = img.width * escala;
        const h = img.height * escala;
        const x = (LARGURA - w) / 2;
        const y = LINHA_ASSINATURA_Y - h - 2;
        ctx.drawImage(img, x, y, w, h);
        desenharGuiaAssinatura(ctx);
      };
      img.src = dataUrl;
    },
    [limparCanvas]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    if (ignorarProximaCarga.current) {
      ignorarProximaCarga.current = false;
      return;
    }
    carregarImagem(value);
  }, [value, carregarImagem]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || value) return;
    limparCanvas(ctx);
  }, [value, limparCanvas]);

  function posicaoCanvas(event: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const escalaX = LARGURA / rect.width;
    const escalaY = ALTURA / rect.height;
    if ("touches" in event) {
      const toque = event.touches[0] || event.changedTouches[0];
      return {
        x: (toque.clientX - rect.left) * escalaX,
        y: (toque.clientY - rect.top) * escalaY,
      };
    }
    return {
      x: (event.clientX - rect.left) * escalaX,
      y: (event.clientY - rect.top) * escalaY,
    };
  }

  function iniciarDesenho(event: React.MouseEvent | React.TouchEvent) {
    event.preventDefault();
    desenhando.current = true;
    ultimoPonto.current = posicaoCanvas(event);
  }

  function desenhar(event: React.MouseEvent | React.TouchEvent) {
    if (!desenhando.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !ultimoPonto.current) return;
    const ponto = posicaoCanvas(event);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(ultimoPonto.current.x, ultimoPonto.current.y);
    ctx.lineTo(ponto.x, ponto.y);
    ctx.stroke();
    ultimoPonto.current = ponto;
  }

  function finalizarDesenho() {
    if (!desenhando.current) return;
    desenhando.current = false;
    ultimoPonto.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    ignorarProximaCarga.current = true;
    onChange(canvas.toDataURL("image/png"));
  }

  function limpar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    limparCanvas(ctx);
    ignorarProximaCarga.current = true;
    onChange("");
    setErroUpload("");
  }

  function aoEnviarImagem(arquivo: File | null) {
    if (!arquivo || !arquivo.type.startsWith("image/")) return;
    setErroUpload("");
    const leitor = new FileReader();
    leitor.onload = () => {
      const dataUrl = String(leitor.result || "");
      ignorarProximaCarga.current = true;
      onChange(dataUrl);
      carregarImagem(dataUrl);
    };
    leitor.readAsDataURL(arquivo);
  }

  async function aoEnviarPdf(arquivo: File | null) {
    if (!arquivo) return;
    if (arquivo.type !== "application/pdf" && !arquivo.name.toLowerCase().endsWith(".pdf")) {
      setErroUpload("Envie um arquivo PDF válido.");
      return;
    }
    setErroUpload("");
    setCarregandoPdf(true);
    try {
      const dataUrl = await pdfPrimeiraPaginaParaDataUrl(arquivo);
      ignorarProximaCarga.current = true;
      onChange(dataUrl);
      carregarImagem(dataUrl);
    } catch {
      setErroUpload("Não foi possível ler o PDF. Tente uma imagem PNG ou JPG.");
    } finally {
      setCarregandoPdf(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
        <PenLine className="h-4 w-4 text-slate-600 dark:text-slate-400" strokeWidth={1.75} />
        <h2 className="text-[15px] font-normal">Assinatura do recibo</h2>
      </div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Desenhe acima da linha tracejada, envie uma imagem ou um PDF com o scan da assinatura. Ela
        aparece alinhada à linha nos recibos de recebimento.
      </p>
      <div className="inline-block max-w-full rounded border border-slate-300 bg-white p-2 shadow-sm dark:border-slate-600 dark:bg-slate-950">
        <canvas
          ref={canvasRef}
          width={LARGURA}
          height={ALTURA}
          className="block w-full max-w-[420px] cursor-crosshair touch-none"
          onMouseDown={iniciarDesenho}
          onMouseMove={desenhar}
          onMouseUp={finalizarDesenho}
          onMouseLeave={finalizarDesenho}
          onTouchStart={iniciarDesenho}
          onTouchMove={desenhar}
          onTouchEnd={finalizarDesenho}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => inputImagem.current?.click()}
        >
          <ImageUp className="h-3.5 w-3.5" />
          Enviar imagem
        </Button>
        <input
          ref={inputImagem}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            aoEnviarImagem(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={carregandoPdf}
          onClick={() => inputPdf.current?.click()}
        >
          <FileUp className="h-3.5 w-3.5" />
          {carregandoPdf ? "Lendo PDF…" : "Enviar PDF (scan)"}
        </Button>
        <input
          ref={inputPdf}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            void aoEnviarPdf(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={limpar}
        >
          <Eraser className="h-3.5 w-3.5" />
          Limpar
        </Button>
      </div>
      {erroUpload ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{erroUpload}</p>
      ) : null}
    </section>
  );
}
