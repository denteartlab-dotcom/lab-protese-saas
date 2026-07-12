"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type Status = {
  habilitado: boolean;
  conectado: boolean;
  baileys: boolean;
  qr: string | null;
  modo?: string;
};

export function ConfiguracoesWhatsappTab() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status | null>(null);
  const [qrImagem, setQrImagem] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/whatsapp/status", { cache: "no-store" });
      const data = (await res.json()) as Status;
      setStatus(data);
      if (data.qr) {
        const img = await QRCode.toDataURL(data.qr, { width: 260, margin: 2 });
        setQrImagem(img);
      } else {
        setQrImagem(null);
      }
    } catch {
      setStatus(null);
      setQrImagem(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
    const timer = window.setInterval(() => {
      void recarregar();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [recarregar]);

  if (carregando && !status) {
    return <p className="text-sm text-slate-500">{t("settings.whatsappCarregando")}</p>;
  }

  if (!status?.habilitado) {
    return (
      <div className="max-w-2xl space-y-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">{t("settings.whatsappNaoConfigurado")}</p>
        <p>
          {t("settings.whatsappEnvDescricao")}{" "}
          <code className="rounded bg-slate-100 px-1">.env</code>:
        </p>
        <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed">
{`WHATSAPP_HTTP_URL=http://127.0.0.1:3100/send
WHATSAPP_HTTP_TOKEN=sua-chave-secreta
WHATSAPP_BAILEYS_PORT=3100`}
        </pre>
        <p>{t("settings.whatsappEnvReiniciar")}</p>
        <p className="text-slate-500">{t("settings.whatsappSemAutomacao")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5 text-sm text-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-800">{t("settings.whatsappTitulo")}</p>
          <p className="mt-1 text-slate-500">{t("settings.whatsappDescricao")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void recarregar()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {t("settings.whatsappAtualizar")}
        </Button>
      </div>

      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium ${
          status.conectado
            ? "bg-emerald-100 text-emerald-800"
            : "bg-amber-100 text-amber-800"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            status.conectado ? "bg-emerald-500" : "bg-amber-500"
          }`}
        />
        {status.conectado ? t("settings.whatsappConectado") : t("settings.whatsappAguardando")}
      </div>

      {!status.conectado && status.baileys && qrImagem ? (
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="mb-3 font-medium text-slate-700">{t("settings.whatsappQrTitulo")}</p>
          <p className="mb-4 text-[12px] text-slate-500">{t("settings.whatsappQrInstrucao")}</p>
          <img
            src={qrImagem}
            alt={t("settings.whatsappQrAlt")}
            className="mx-auto h-[260px] w-[260px]"
          />
        </div>
      ) : null}

      {!status.conectado && status.baileys && !qrImagem ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          {t("settings.whatsappSemQr")}
        </p>
      ) : null}

      {status.conectado ? (
        <p className="text-[12px] text-slate-500">{t("settings.whatsappConectadoDica")}</p>
      ) : null}
    </div>
  );
}
