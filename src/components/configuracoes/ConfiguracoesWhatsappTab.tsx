"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui";
import { RefreshCw } from "lucide-react";

type Status = {
  habilitado: boolean;
  conectado: boolean;
  baileys: boolean;
  qr: string | null;
  modo?: string;
};

export function ConfiguracoesWhatsappTab() {
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
    return <p className="text-sm text-slate-500">Carregando status do WhatsApp…</p>;
  }

  if (!status?.habilitado) {
    return (
      <div className="max-w-2xl space-y-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Automação não configurada no servidor</p>
        <p>
          Para disparos automáticos com Baileys, configure no <code className="rounded bg-slate-100 px-1">.env</code> da VPS:
        </p>
        <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed">
{`WHATSAPP_HTTP_URL=http://127.0.0.1:3100/send
WHATSAPP_HTTP_TOKEN=sua-chave-secreta
WHATSAPP_BAILEYS_PORT=3100`}
        </pre>
        <p>
          Inicie o serviço com <code className="rounded bg-slate-100 px-1">pm2 start deploy/ecosystem.config.cjs --only lab-protese-whatsapp</code> e
          reinicie o Lab Prótese.
        </p>
        <p className="text-slate-500">
          Sem isso, o sistema continua abrindo o WhatsApp Web manualmente (wa.me).
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5 text-sm text-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-800">WhatsApp automático (Baileys)</p>
          <p className="mt-1 text-slate-500">
            Mensagens de fatura, extrato e orçamento são enviadas pelo número do laboratório quando conectado.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void recarregar()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Atualizar
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
        {status.conectado ? "Conectado — disparos automáticos ativos" : "Aguardando conexão"}
      </div>

      {!status.conectado && status.baileys && qrImagem ? (
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="mb-3 font-medium text-slate-700">Escaneie o QR Code no celular</p>
          <p className="mb-4 text-[12px] text-slate-500">
            WhatsApp → Aparelhos conectados → Conectar aparelho. Use o número dedicado do laboratório.
          </p>
          <img src={qrImagem} alt="QR Code WhatsApp" className="mx-auto h-[260px] w-[260px]" />
        </div>
      ) : null}

      {!status.conectado && status.baileys && !qrImagem ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          Serviço Baileys sem QR no momento. Verifique se{" "}
          <code className="rounded bg-white px-1">lab-protese-whatsapp</code> está rodando no PM2
          ou escaneie o QR no log do servidor.
        </p>
      ) : null}

      {status.conectado ? (
        <p className="text-[12px] text-slate-500">
          Ao enviar fatura, extrato ou link pelo sistema, a mensagem sai direto deste WhatsApp. Se a conexão
          cair, o sistema volta a abrir o wa.me manualmente.
        </p>
      ) : null}
    </div>
  );
}
