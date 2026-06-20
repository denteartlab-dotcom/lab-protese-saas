"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  QrCode,
} from "lucide-react";
import {
  normalizarPlanoEmpresa,
  normalizarPeriodoCobranca,
  rotuloPlanoEmpresa,
  formatarPrecoPlanoComPeriodo,
  recursosPlanosAssinatura,
  rotuloPeriodoCobranca,
  type PeriodoCobranca,
} from "@/lib/master-planos";
import { cn } from "@/lib/utils";
import { SeletorPeriodoCobranca } from "@/components/assinatura/SeletorPeriodoCobranca";
import { ContagemRegressivaPixQr } from "@/components/assinatura/ContagemRegressivaPixQr";
import { PixQrCodeVisual } from "@/components/assinatura/PixQrCodeVisual";

type CobrancaPix = {
  cobrancaId: string;
  valorFormatado: string;
  planoRotulo: string;
  periodoCobranca?: string;
  periodoRotulo?: string;
  diasRenovacao: number;
  pixPayload: string | null;
  pixEncodedImage: string | null;
  pixExpiraEm: string | null;
  pago: boolean;
  renovadoEm: string | null;
  novaDataVencimento: string | null;
  empresaSlug: string | null;
};

export function PagamentoAssinaturaPainel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plano = normalizarPlanoEmpresa(searchParams.get("plano") || "profissional");
  const periodoInicial = normalizarPeriodoCobranca(searchParams.get("periodo") || "mensal");
  const [periodo, setPeriodo] = useState<PeriodoCobranca>(periodoInicial);
  const planoInfo = recursosPlanosAssinatura(periodo).find((item) => item.id === plano);

  const [loading, setLoading] = useState(true);
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
          plano,
          periodo,
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
  }, [plano, periodo]);

  useEffect(() => {
    setPeriodo(periodoInicial);
  }, [periodoInicial]);

  useEffect(() => {
    void gerarPix();
  }, [gerarPix]);

  useEffect(() => {
    if (!cobranca?.cobrancaId || cobranca.pago) return;

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
          const slug = data.cobranca.empresaSlug?.trim();
          router.replace(slug ? `/app/${slug}` : "/app");
          router.refresh();
        }
      } catch {
        /* ignora */
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [cobranca?.cobrancaId, cobranca?.pago, router]);

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

  const pago = Boolean(cobranca?.pago && cobranca.renovadoEm);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Link
            href="/assinatura-vencida"
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <QrCode className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Pagamento da assinatura</h1>
          <p className="mt-1 text-sm text-slate-600">
            Plano {rotuloPlanoEmpresa(plano)} ({rotuloPeriodoCobranca(periodo)}) —{" "}
            {formatarPrecoPlanoComPeriodo(plano, periodo)}
          </p>
          <div className="mt-4 flex justify-center">
            <SeletorPeriodoCobranca
              periodo={periodo}
              onChange={(novo) => {
                setPeriodo(novo);
                router.replace(`/pagamento?plano=${plano}&periodo=${novo}`);
              }}
            />
          </div>
        </div>

        {planoInfo ? (
          <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Incluso no plano
            </p>
            <ul className="space-y-1">
              {planoInfo.itens.map((item) => (
                <li key={item} className="text-sm text-slate-600">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {loading && !cobranca ? (
          <div className="flex flex-col items-center gap-3 py-12 text-slate-500">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm">Gerando QR Code PIX...</p>
          </div>
        ) : pago ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-center">
            <Check className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="mt-3 text-base font-semibold text-emerald-800">Pagamento confirmado!</p>
            <p className="mt-1 text-sm text-emerald-700">
              Redirecionando para o sistema...
            </p>
          </div>
        ) : cobranca ? (
          <div className="space-y-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Valor</p>
              <p className="text-lg font-bold text-slate-900">{cobranca.valorFormatado}</p>
              <p className="text-[10px] text-slate-500">
                +{cobranca.diasRenovacao} dias após confirmação
                {cobranca.periodoRotulo ? ` (${cobranca.periodoRotulo.toLowerCase()})` : ""}
              </p>
            </div>

            <ContagemRegressivaPixQr
              expiraEm={cobranca.pixExpiraEm}
              onGerarNovo={() => void gerarPix(true)}
              gerandoNovo={loading}
            />

            {cobranca.pixPayload || cobranca.pixEncodedImage ? (
              <div className="flex justify-center">
                <PixQrCodeVisual
                  pixEncodedImage={cobranca.pixEncodedImage}
                  pixPayload={cobranca.pixPayload}
                />
              </div>
            ) : null}

            {cobranca.pixPayload ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-slate-600">Pix copia e cola</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={cobranca.pixPayload}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => void copiarPix()}
                    className={cn(
                      "inline-flex h-10 items-center gap-1 rounded-lg px-4 text-xs font-medium text-white",
                      copiado ? "bg-emerald-600" : "bg-slate-800 hover:bg-slate-900"
                    )}
                  >
                    {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiado ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>
            ) : null}

            <p className="text-center text-xs text-slate-500">
              Após pagar, o acesso é liberado automaticamente em poucos segundos.
            </p>
          </div>
        ) : null}

        {erro ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
        ) : null}
      </main>
    </div>
  );
}
