"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScanBarcode } from "lucide-react";
import { Modal } from "@/components/ui";
import { extrairNumeroOsCodigo } from "@/lib/codigo-barras-os";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCodigoLido: (numeroOs: string) => void;
};

export function LeitorCodigoBarrasModal({ open, onClose, onCodigoLido }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [valor, setValor] = useState("");
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [cameraErro, setCameraErro] = useState("");
  const [suportaCamera, setSuportaCamera] = useState(false);

  const confirmarLeitura = useCallback(
    (bruto: string) => {
      const numero = extrairNumeroOsCodigo(bruto);
      if (!numero) return;
      onCodigoLido(numero);
      setValor("");
      onClose();
    },
    [onCodigoLido, onClose]
  );

  useEffect(() => {
    if (!open) {
      setValor("");
      setCameraAtiva(false);
      setCameraErro("");
      return;
    }
    setSuportaCamera(
      typeof window !== "undefined" &&
        "BarcodeDetector" in window &&
        Boolean(navigator.mediaDevices?.getUserMedia)
    );
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !cameraAtiva || !suportaCamera) return;

    let stream: MediaStream | null = null;
    let ativo = true;
    let frame = 0;

    async function iniciar() {
      setCameraErro("");
      try {
        const Detector = (
          window as unknown as { BarcodeDetector: new (opts?: object) => BarcodeDetectorLike }
        ).BarcodeDetector;
        const detector = new Detector({
          formats: ["code_39", "code_128", "ean_13", "ean_8"],
        });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        const video = videoRef.current;
        if (!video || !ativo) return;
        video.srcObject = stream;
        await video.play();

        const loop = async () => {
          if (!ativo || !videoRef.current) return;
          try {
            const codigos = await detector.detect(videoRef.current);
            const lido = codigos[0]?.rawValue;
            if (lido) {
              confirmarLeitura(lido);
              return;
            }
          } catch {
            /* próximo frame */
          }
          frame = window.requestAnimationFrame(() => void loop());
        };
        void loop();
      } catch {
        setCameraErro(
          "Não foi possível usar a câmera. Use o leitor USB no campo abaixo."
        );
        setCameraAtiva(false);
      }
    }

    void iniciar();

    return () => {
      ativo = false;
      window.cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open, cameraAtiva, suportaCamera, confirmarLeitura]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Leitor de código de barras"
      size="md"
      layerClassName="z-[60]"
    >
      <div className="space-y-4 text-[13px] text-slate-600">
        <div className="flex flex-col items-center rounded-lg border border-dashed border-blue-200 bg-blue-50/60 px-4 py-6">
          <ScanBarcode className="h-14 w-14 text-blue-600" strokeWidth={1.5} />
          <p className="mt-3 text-center text-[12px] leading-relaxed text-slate-600">
            Passe o leitor na etiqueta da OS ou digite o código. Formatos aceitos:{" "}
            <strong>OS7</strong>, <strong>7</strong> ou código de barras da requisição.
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-500">
            Código lido
          </label>
          <input
            ref={inputRef}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmarLeitura(valor);
              }
            }}
            placeholder="Aguardando leitura..."
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-center text-lg tracking-wide outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            autoComplete="off"
          />
        </div>

        {suportaCamera && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setCameraAtiva((v) => !v)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
            >
              {cameraAtiva ? "Desligar câmera" : "Ler pela câmera do celular / webcam"}
            </button>
            {cameraAtiva && (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-black">
                <video
                  ref={videoRef}
                  className="aspect-video w-full object-cover"
                  muted
                  playsInline
                />
              </div>
            )}
            {cameraErro && (
              <p className="text-[11px] text-amber-700">{cameraErro}</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => confirmarLeitura(valor)}
            disabled={!valor.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Buscar OS
          </button>
        </div>
      </div>
    </Modal>
  );
}
