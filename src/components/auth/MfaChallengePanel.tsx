"use client";

import { useState } from "react";

type Props = {
  modo: "setup" | "verify";
  canSkip?: boolean;
  mfaToken: string;
  /** Prefixo da API: /api/auth/mfa ou /api/admin-master/auth/mfa */
  basePath: string;
  onSuccess: (data: Record<string, unknown>) => void | Promise<void>;
  onCancel: () => void;
  onError: (msg: string) => void;
};

export function MfaChallengePanel({
  modo,
  canSkip = false,
  mfaToken: tokenInicial,
  basePath,
  onSuccess,
  onCancel,
  onError,
}: Props) {
  const [mfaToken, setMfaToken] = useState(tokenInicial);
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [setupPronto, setSetupPronto] = useState(modo === "verify");

  async function iniciarSetup() {
    setLoading(true);
    onError("");
    try {
      const res = await fetch(`${basePath}/setup/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ mfaToken }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        mfaToken?: string;
        qrDataUrl?: string;
        secret?: string;
      };
      if (!res.ok) {
        onError(data.error || "Não foi possível iniciar o autenticador.");
        return;
      }
      if (data.mfaToken) setMfaToken(data.mfaToken);
      setQrDataUrl(data.qrDataUrl || "");
      setSecret(data.secret || "");
      setSetupPronto(true);
    } catch {
      onError("Falha de conexão ao configurar MFA.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmar() {
    setLoading(true);
    onError("");
    try {
      const endpoint =
        modo === "setup" ? `${basePath}/setup/confirm` : `${basePath}/verify`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ mfaToken, codigo: codigo.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
        error?: string;
      };
      if (!res.ok) {
        onError(data.error || "Código inválido.");
        return;
      }
      await onSuccess(data);
    } catch {
      onError("Falha de conexão ao verificar o código.");
    } finally {
      setLoading(false);
    }
  }

  async function pular() {
    setLoading(true);
    onError("");
    try {
      const res = await fetch(`${basePath}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ mfaToken }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
        error?: string;
      };
      if (!res.ok) {
        onError(data.error || "Não foi possível pular o MFA.");
        return;
      }
      await onSuccess(data);
    } catch {
      onError("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded border border-blue-100 bg-blue-50/80 p-3">
        <p className="text-[11px] font-semibold text-slate-800">
          {modo === "setup"
            ? "Configure a autenticação em dois fatores"
            : "Digite o código do autenticador"}
        </p>
        <p className="mt-1 text-[10px] text-slate-600">
          {modo === "setup"
            ? "Use Google Authenticator, Authy ou similar. Escaneie o QR e confirme o código de 6 dígitos."
            : "Abra o app autenticador e informe o código de 6 dígitos."}
        </p>
      </div>

      {modo === "setup" && !setupPronto ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void iniciarSetup()}
          className="h-8 w-full rounded bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Gerando…" : "Gerar QR Code"}
        </button>
      ) : null}

      {modo === "setup" && setupPronto && qrDataUrl ? (
        <div className="flex flex-col items-center gap-2">
          <img src={qrDataUrl} alt="QR Code MFA" className="h-[180px] w-[180px] rounded border" />
          {secret ? (
            <p className="break-all text-center text-[9px] text-slate-500">
              Chave manual: <span className="font-mono">{secret}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {(modo === "verify" || setupPronto) && (
        <div className="space-y-1">
          <label className="text-[10px] font-medium uppercase text-slate-700">
            Código de 6 dígitos
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-8 w-full rounded border border-slate-200 bg-white px-3 text-center text-sm tracking-widest outline-none focus:border-blue-500"
            placeholder="000000"
            disabled={loading}
          />
          <button
            type="button"
            disabled={loading || codigo.length < 6}
            onClick={() => void confirmar()}
            className="mt-2 h-8 w-full rounded bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Validando…" : "Confirmar"}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {modo === "setup" && canSkip ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void pular()}
            className="text-[10px] font-medium text-amber-700 hover:underline"
          >
            Configurar depois (período de graça)
          </button>
        ) : null}
        <button
          type="button"
          disabled={loading}
          onClick={onCancel}
          className="text-[10px] font-medium text-slate-500 hover:underline"
        >
          Voltar ao login
        </button>
      </div>
    </div>
  );
}
