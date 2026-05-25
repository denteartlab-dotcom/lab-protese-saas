"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Upload } from "lucide-react";
import type { DadosFormContaBancaria } from "@/lib/conta-bancaria";
import type { ExtratoMovimentacao } from "@/lib/extrato-bancario";
import { parseCsvExtrato, parseOfxExtrato } from "@/lib/extrato-ofx";

const PLUGGY_CONNECT_SCRIPT =
  "https://cdn.pluggy.ai/pluggy-connect/v2.8.2/pluggy-connect.js";

type PluggySuccess = { item: { id: string } };

type PluggyConnectInstance = { init: () => void; destroy?: () => void };

type PluggyConnectCtor = new (config: {
  connectToken: string;
  includeSandbox?: boolean;
  onSuccess: (data: PluggySuccess) => void;
  onError: (error: { message?: string }) => void;
  onClose?: () => void;
}) => PluggyConnectInstance;

declare global {
  interface Window {
    PluggyConnect?: PluggyConnectCtor;
  }
}

type Props = {
  form: DadosFormContaBancaria;
  onChange: (partial: Partial<DadosFormContaBancaria>) => void;
  /** Movimentações parseadas do arquivo (contaId preenchido no submit). */
  onExtratoArquivo: (movs: Omit<ExtratoMovimentacao, "contaId">[]) => void;
  contaIdPreview?: string;
};

export function VinculoContaBancariaSection({
  form,
  onChange,
  onExtratoArquivo,
  contaIdPreview = "nova-conta",
}: Props) {
  const [pluggyOk, setPluggyOk] = useState<boolean | null>(null);
  const [pluggyMsg, setPluggyMsg] = useState<string>("");
  const [conectando, setConectando] = useState(false);
  const [arquivoNome, setArquivoNome] = useState("");
  const [scriptPronto, setScriptPronto] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/open-finance/status")
      .then((r) => r.json())
      .then((data: { configurado?: boolean; mensagem?: string; error?: string }) => {
        if (cancelado) return;
        if (data.error) {
          setPluggyOk(false);
          setPluggyMsg(data.error);
          return;
        }
        setPluggyOk(Boolean(data.configurado));
        setPluggyMsg(data.mensagem ?? "");
      })
      .catch(() => {
        if (!cancelado) {
          setPluggyOk(false);
          setPluggyMsg("Não foi possível verificar o Open Finance.");
        }
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (form.modoVinculo !== "open_finance" || scriptPronto) return;
    if (window.PluggyConnect) {
      setScriptPronto(true);
      return;
    }
    const existing = document.querySelector(
      `script[src="${PLUGGY_CONNECT_SCRIPT}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => setScriptPronto(true));
      return;
    }
    const script = document.createElement("script");
    script.src = PLUGGY_CONNECT_SCRIPT;
    script.async = true;
    script.onload = () => setScriptPronto(true);
    document.body.appendChild(script);
  }, [form.modoVinculo, scriptPronto]);

  const abrirPluggyConnect = useCallback(async () => {
    if (!pluggyOk) return;
    setConectando(true);
    try {
      const res = await fetch("/api/open-finance/connect-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          form.openFinanceItemId ? { itemId: form.openFinanceItemId } : {}
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setPluggyMsg(data.error || "Erro ao conectar.");
        return;
      }

      const Pluggy = window.PluggyConnect;
      if (!Pluggy) {
        setPluggyMsg("Widget Pluggy ainda carregando. Tente novamente em instantes.");
        return;
      }

      const widget = new Pluggy({
        connectToken: data.accessToken,
        includeSandbox: process.env.NODE_ENV === "development",
        onSuccess: (success) => {
          onChange({
            modoVinculo: "open_finance",
            openFinanceItemId: success.item.id,
          });
          setConectando(false);
        },
        onError: (err) => {
          setPluggyMsg(err.message || "Falha na conexão com o banco.");
          setConectando(false);
        },
        onClose: () => setConectando(false),
      });
      widget.init();
    } catch {
      setPluggyMsg("Erro de rede ao iniciar conexão.");
    } finally {
      setConectando(false);
    }
  }, [form.openFinanceItemId, onChange, pluggyOk]);

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivoNome(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const texto = String(reader.result ?? "");
      const lower = file.name.toLowerCase();
      const movs =
        lower.endsWith(".ofx") || lower.endsWith(".qfx")
          ? parseOfxExtrato(texto, contaIdPreview)
          : parseCsvExtrato(texto, contaIdPreview);
      onExtratoArquivo(
        movs.map(({ contaId: _c, ...rest }) => rest)
      );
      onChange({ modoVinculo: "extrato_arquivo" });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="mt-4 border-t border-[#e5e5e5] pt-4">
      <div className="mb-3 flex items-center gap-2 text-[13px] text-slate-600">
        <Link2 className="h-4 w-4 text-slate-400" />
        <span>Vínculo com extrato bancário</span>
      </div>

      <div className="space-y-2 text-[12px] text-slate-700">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="modoVinculo"
            checked={form.modoVinculo === "manual"}
            onChange={() =>
              onChange({ modoVinculo: "manual", openFinanceItemId: undefined })
            }
            className="mt-0.5"
          />
          <span>
            <strong className="font-medium">Manual</strong> — saldo e movimentações
            lançados só pelo sistema.
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="modoVinculo"
            checked={form.modoVinculo === "open_finance"}
            onChange={() => onChange({ modoVinculo: "open_finance" })}
            className="mt-0.5"
          />
          <span>
            <strong className="font-medium">Internet Banking (Open Finance)</strong>
            — conecte a conta PJ no banco e sincronize entradas e saídas
            automaticamente (via Pluggy, regulamentado pelo Banco Central).
          </span>
        </label>

        {form.modoVinculo === "open_finance" ? (
          <div className="ml-5 space-y-2 rounded border border-[#e8f2fc] bg-[#f8fbff] p-3">
            {pluggyOk === false ? (
              <p className="text-[11px] leading-relaxed text-amber-800">
                {pluggyMsg ||
                  "Servidor sem credenciais Pluggy. Peça ao administrador para configurar o .env ou use importação de arquivo abaixo."}
              </p>
            ) : null}
            {form.openFinanceItemId ? (
              <p className="text-[11px] text-[#4cae4c]">
                Banco conectado (item {form.openFinanceItemId.slice(0, 8)}…). Salve a
                conta e use &quot;Sincronizar extrato&quot; na lista.
              </p>
            ) : (
              <button
                type="button"
                disabled={!pluggyOk || conectando || !scriptPronto}
                onClick={() => void abrirPluggyConnect()}
                className="h-8 rounded border border-[#4a90d9] bg-[#4a90d9] px-4 text-[12px] text-white hover:bg-[#3d7fc4] disabled:opacity-50"
              >
                {conectando
                  ? "Abrindo…"
                  : "Conectar internet banking"}
              </button>
            )}
            {pluggyOk && form.openFinanceItemId ? (
              <button
                type="button"
                onClick={() => void abrirPluggyConnect()}
                className="text-[11px] text-[#4a90d9] underline"
              >
                Reconectar banco
              </button>
            ) : null}
          </div>
        ) : null}

        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="modoVinculo"
            checked={form.modoVinculo === "extrato_arquivo"}
            onChange={() => onChange({ modoVinculo: "extrato_arquivo" })}
            className="mt-0.5"
          />
          <span>
            <strong className="font-medium">Importar extrato</strong> — arquivo OFX,
            QFX ou CSV exportado do internet banking.
          </span>
        </label>

        {form.modoVinculo === "extrato_arquivo" ? (
          <div className="ml-5">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-dashed border-[#4a90d9] bg-white px-3 py-2 text-[12px] text-[#4a90d9] hover:bg-[#f0f7ff]">
              <Upload className="h-4 w-4" />
              Escolher arquivo OFX/CSV
              <input
                type="file"
                accept=".ofx,.qfx,.csv,.txt"
                className="hidden"
                onChange={handleArquivo}
              />
            </label>
            {arquivoNome ? (
              <p className="mt-1 text-[11px] text-slate-500">
                Arquivo: {arquivoNome} — movimentações serão importadas ao salvar.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
