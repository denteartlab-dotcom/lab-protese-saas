"use client";

import { useCallback, useEffect, useRef } from "react";
import { Eraser, ImageUp, PenLine } from "lucide-react";
import { Button } from "@/components/ui";

const LARGURA = 420;
const ALTURA = 130;

type Props = {
  value: string;
  onChange: (dataUrl: string) => void;
};

export function AssinaturaReciboCampo({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const ultimoPonto = useRef<{ x: number; y: number } | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const ignorarProximaCarga = useRef(false);

  const limparCanvas = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, LARGURA, ALTURA);
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
        const escala = Math.min(LARGURA / img.width, ALTURA / img.height, 1);
        const w = img.width * escala;
        const h = img.height * escala;
        const x = (LARGURA - w) / 2;
        const y = (ALTURA - h) / 2;
        ctx.drawImage(img, x, y, w, h);
      };
      img.src = dataUrl;
    },
    [limparCanvas]
  );

  useEffect(() => {
    if (ignorarProximaCarga.current) {
      ignorarProximaCarga.current = false;
      return;
    }
    carregarImagem(value);
  }, [value, carregarImagem]);

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
  }

  function aoEnviarArquivo(arquivo: File | null) {
    if (!arquivo || !arquivo.type.startsWith("image/")) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      const dataUrl = String(leitor.result || "");
      ignorarProximaCarga.current = true;
      onChange(dataUrl);
      carregarImagem(dataUrl);
    };
    leitor.readAsDataURL(arquivo);
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
        <PenLine className="h-4 w-4 text-slate-600 dark:text-slate-400" strokeWidth={1.75} />
        <h2 className="text-[15px] font-normal">Assinatura do recibo</h2>
      </div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Desenhe com o mouse ou toque, ou envie uma imagem. A assinatura aparece automaticamente nos
        recibos de recebimento.
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
          onClick={() => inputArquivo.current?.click()}
        >
          <ImageUp className="h-3.5 w-3.5" />
          Enviar imagem
        </Button>
        <input
          ref={inputArquivo}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            aoEnviarArquivo(e.target.files?.[0] ?? null);
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
    </section>
  );
}
