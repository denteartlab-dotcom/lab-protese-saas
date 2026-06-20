"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, QrCode, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContagemRegressivaPixQr } from "@/components/assinatura/ContagemRegressivaPixQr";
import { PixQrCodeVisual } from "@/components/assinatura/PixQrCodeVisual";

export type CredenciaisRenovacaoPix = {
  email?: string;
  password?: string;
  empresaSlug?: string;
};

type CobrancaPix = {
  cobrancaId: string;
  valorFormatado: string;
  planoRotulo: string;
  diasRenovacao: number;
  pixPayload: string | null;
  pixEncodedImage: string | null;
  pixExpiraEm: string | null;
  pago: boolean;
  renovadoEm: string | null;
  novaDataVencimento: string | null;
};

type Props = {
  aberto: boolean;
  onFechar: () => void;
  credenciais?: CredenciaisRenovacaoPix;
  onRenovado?: () => void;
};

export function RenovarAssinaturaPixModal({
  aberto,
  onFechar,
  credenciais,
  onRenovado,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [cobranca, setCobranca] = useState<CobrancaPix | null>(null);
  const [copiado, setCopiado] = useState(false);

  const gerarPix = useCallback(async (forcarNova = false) => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/assinatura/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...(credenciais || {}),
          ...(forcarNova ? { force: true } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string; cobranca?: CobrancaPix };
      if (!res.ok) throw new Error(data.error || "Não foi possível gerar o PIX.");
      setCobranca(data.cobranca || null);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao gerar PIX.");
    } finally {
      setLoading(false);
    }
  }, [credenciais]);

  useEffect(() => {
    if (!aberto) {
      setCobranca(null);
      setErro("");
      setCopiado(false);
      return;
    }
    void gerarPix();
  }, [aberto, gerarPix]);

  useEffect(() => {
    if (!aberto || !cobranca?.cobrancaId || cobranca.pago) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/assinatura/pix?cobrancaId=${encodeURIComponent(cobranca.cobrancaId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { cobranca?: CobrancaPix };
        if (!data.cobranca) return;
        setCobranca((atual) => ({
          ...data.cobranca!,
          pixEncodedImage:
            data.cobranca!.pixEncodedImage || atual?.pixEncodedImage || null,
          pixExpiraEm: data.cobranca!.pixExpiraEm ?? atual?.pixExpiraEm ?? null,
        }));
        if (data.cobranca.pago && data.cobranca.renovadoEm) {
          onRenovado?.();
        }
      } catch {
        /* ignora */
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [aberto, cobranca?.cobrancaId, cobranca?.pago, onRenovado]);

  async function copiarPix() {
    if (!cobranca?.pixPayload) return;
    try {
      await navigator.clipboard.writeText(cobranca.pixPayload);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não foi possível copiar. Selecione o código manualmente.");
    }
  }

  if (!aberto) return null;

  const pago = Boolean(cobranca?.pago && cobranca.renovadoEm);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <button
          type="button"
          onClick={onFechar}
          className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex items-center gap-2">
          <QrCode className="h-5 w-5 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900">Renovar assinatura com PIX</h2>
        </div>

        {loading && !cobranca ? (
          <div className="flex flex-col items-center gap-3 py-8 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-xs">Gerando QR Code PIX...</p>
          </div>
        ) : pago ? (
          <div className="space-y-3 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-emerald-800">Pagamento confirmado!</p>
            <p className="text-xs text-slate-600">
              Sua assinatura foi renovada automaticamente.
              {cobranca?.novaDataVencimento
                ? ` Válida até ${new Date(cobranca.novaDataVencimento).toLocaleDateString("pt-BR")}.`
                : ""}
            </p>
            <button
              type="button"
              onClick={onFechar}
              className="mt-2 h-8 w-full rounded bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Continuar
            </button>
          </div>
        ) : cobranca ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Plano</p>
              <p className="text-sm font-semibold text-slate-800">
                {cobranca.planoRotulo} — {cobranca.valorFormatado}
              </p>
              <p className="text-[10px] text-slate-500">
                +{cobranca.diasRenovacao} dias de acesso após confirmação do pagamento
              </p>
            </div>

            <ContagemRegressivaPixQr
              expiraEm={cobranca.pixExpiraEm}
              onGerarNovo={() => void gerarPix(true)}
              gerandoNovo={loading}
              compacto
            />

            {cobranca.pixPayload || cobranca.pixEncodedImage ? (
              <div className="flex justify-center">
                <PixQrCodeVisual
                  pixEncodedImage={cobranca.pixEncodedImage}
                  pixPayload={cobranca.pixPayload}
                  className="h-44 w-44 rounded border border-slate-200"
                />
              </div>
            ) : null}

            {cobranca.pixPayload ? (
              <div className="space-y-2">
                <p className="text-[10px] font-medium uppercase text-slate-600">Pix copia e cola</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={cobranca.pixPayload}
                    className="h-8 min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 text-[10px] text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => void copiarPix()}
                    className={cn(
                      "inline-flex h-8 items-center gap-1 rounded px-3 text-[10px] font-medium text-white",
                      copiado ? "bg-emerald-600" : "bg-slate-700 hover:bg-slate-800"
                    )}
                  >
                    {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiado ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>
            ) : null}

            <p className="text-center text-[10px] text-slate-500">
              Após pagar, a renovação é automática em poucos segundos.
            </p>
          </div>
        ) : null}

        {erro ? (
          <p className="mt-3 rounded bg-red-50 px-2 py-1.5 text-[10px] text-red-700">{erro}</p>
        ) : null}
      </div>
    </div>
  );
}
