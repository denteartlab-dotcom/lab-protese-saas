"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import type { TipoMensagemForm } from "@/components/DadosLaboratorioForm";

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";
const inputClass =
  "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

type Props = {
  onMensagem?: (texto: string, tipo?: TipoMensagemForm) => void;
};

export function ConfiguracoesBoletosTab({ onMensagem }: Props) {
  const [ambiente, setAmbiente] = useState<"sandbox" | "producao">("sandbox");
  const [apiKey, setApiKey] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [apiKeyConfigurada, setApiKeyConfigurada] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [urlBase, setUrlBase] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    void fetch("/api/asaas/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.config?.ambiente) setAmbiente(data.config.ambiente);
        setApiKeyConfigurada(Boolean(data.config?.apiKeyConfigurada));
        if (data.config?.webhookTokenConfigurado) {
          setWebhookToken("********");
        }
        setWebhookUrl(data.webhookUrl || "");
        setUrlBase(data.urlBase || "");
      })
      .finally(() => setCarregando(false));
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      const res = await fetch("/api/asaas/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ambiente,
          apiKey: apiKey.trim() || undefined,
          manterApiKey: !apiKey.trim() && apiKeyConfigurada,
          webhookToken: webhookToken.startsWith("*") ? undefined : webhookToken,
          manterWebhookToken: webhookToken.startsWith("*"),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Falha ao salvar");
      }
      setApiKey("");
      setApiKeyConfigurada(true);
      onMensagem?.("Integração Asaas salva com sucesso.", "sucesso");
    } catch (e) {
      onMensagem?.(
        e instanceof Error ? e.message : "Não foi possível salvar.",
        "erro"
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <p className="text-sm text-slate-500">Carregando…</p>;
  }

  return (
    <div className="max-w-xl space-y-5 text-sm">
      <div className="rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-[12px] text-slate-700">
        <p className="font-semibold text-slate-800">Emissão de boleto (Asaas)</p>
        <p className="mt-1">
          Ao lançar a cobrança do cliente com forma de pagamento <strong>Boleto</strong>, o
          sistema registra a fatura e emite o boleto automaticamente no Asaas.
        </p>
      </div>

      <div>
        <label className={labelClass}>Ambiente</label>
        <select
          value={ambiente}
          onChange={(e) =>
            setAmbiente(e.target.value === "producao" ? "producao" : "sandbox")
          }
          className={inputClass}
        >
          <option value="sandbox">Sandbox (testes)</option>
          <option value="producao">Produção</option>
        </select>
        {urlBase ? (
          <p className="mt-1 text-[11px] text-slate-500">API: {urlBase}</p>
        ) : null}
      </div>

      <div>
        <label className={labelClass}>Chave da API (access token)</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            apiKeyConfigurada
              ? "Deixe em branco para manter a chave atual"
              : "Cole a chave do painel Asaas"
          }
          className={inputClass}
          autoComplete="off"
        />
      </div>

      <div>
        <label className={labelClass}>Token do webhook (opcional)</label>
        <input
          type="text"
          value={webhookToken}
          onChange={(e) => setWebhookToken(e.target.value)}
          placeholder="Mesmo token configurado no painel Asaas"
          className={inputClass}
        />
        {webhookUrl ? (
          <p className="mt-2 break-all text-[11px] text-slate-500">
            URL do webhook: <span className="font-mono text-slate-700">{webhookUrl}</span>
          </p>
        ) : null}
        <p className="mt-1 text-[11px] text-slate-500">
          Quando o cliente pagar, o financeiro pode ser baixado automaticamente.
        </p>
      </div>

      <Button type="button" onClick={() => void salvar()} disabled={salvando}>
        {salvando ? "Salvando…" : "Gravar integração"}
      </Button>
    </div>
  );
}
