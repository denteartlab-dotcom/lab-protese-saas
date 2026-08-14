"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui";

const INPUT_CLS =
  "h-[38px] w-full rounded-sm border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] outline-none transition focus:border-[#4a90d9] focus:ring-2 focus:ring-[#4a90d9]/15";

export function MfaConfiguracaoUsuario() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [modo, setModo] = useState<"idle" | "ativando" | "desativando">("idle");
  const [mfaToken, setMfaToken] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/auth/mfa/status", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error || "Não foi possível carregar o status do MFA.");
        return;
      }
      setMfaEnabled(data.mfaEnabled === true);
    } catch {
      setErro("Erro de conexão ao carregar MFA.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function iniciarAtivacao() {
    setErro("");
    setSucesso("");
    setSalvando(true);
    try {
      const res = await fetch("/api/auth/mfa/enable/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error || "Não foi possível iniciar a configuração.");
        return;
      }
      setMfaToken(data.mfaToken || "");
      setQrDataUrl(data.qrDataUrl || "");
      setSecret(data.secret || "");
      setCodigo("");
      setModo("ativando");
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarAtivacao() {
    setErro("");
    setSucesso("");
    setSalvando(true);
    try {
      const res = await fetch("/api/auth/mfa/enable/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, codigo: codigo.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error || "Código inválido.");
        return;
      }
      setSucesso(data.message || "MFA ativado.");
      setMfaEnabled(true);
      setModo("idle");
      setCodigo("");
      setQrDataUrl("");
      setSecret("");
      setMfaToken("");
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setSalvando(false);
    }
  }

  async function desativar() {
    setErro("");
    setSucesso("");
    setSalvando(true);
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senha,
          codigo: codigo.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error || "Não foi possível desativar.");
        return;
      }
      setSucesso(data.message || "MFA desativado.");
      setMfaEnabled(false);
      setModo("idle");
      setSenha("");
      setCodigo("");
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-5 overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm">
      <div className="border-b border-[#e5e7eb] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef2ff] text-[#4a90d9]">
            {mfaEnabled ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <Shield className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#374151]">
              Autenticação em dois fatores
            </h2>
            <p className="text-[11px] text-[#9ca3af]">
              Opcional. Quando ativa, o login pede um código do app autenticador.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        {carregando ? (
          <p className="text-[12px] text-[#9ca3af]">Carregando…</p>
        ) : (
          <>
            {erro && (
              <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {erro}
              </p>
            )}
            {sucesso && (
              <p className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
                {sucesso}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 rounded-sm border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2.5">
              <div>
                <p className="text-[13px] font-medium text-[#374151]">
                  Status: {mfaEnabled ? "Ativo" : "Desativado"}
                </p>
                <p className="text-[11px] text-[#9ca3af]">
                  {mfaEnabled
                    ? "No próximo login será pedido o código de 6 dígitos."
                    : "Você pode ativar quando quiser, em qualquer perfil."}
                </p>
              </div>
              {mfaEnabled ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                  ON
                </span>
              ) : (
                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                  OFF
                </span>
              )}
            </div>

            {modo === "idle" && !mfaEnabled && (
              <Button
                type="button"
                disabled={salvando}
                onClick={() => void iniciarAtivacao()}
                className="h-[38px] rounded-sm bg-[#4a90d9] px-5 text-[13px] font-semibold text-white hover:bg-[#3d7fc4] disabled:opacity-60"
              >
                {salvando ? "Gerando…" : "Ativar autenticação em dois fatores"}
              </Button>
            )}

            {modo === "idle" && mfaEnabled && (
              <Button
                type="button"
                variant="outline"
                disabled={salvando}
                onClick={() => {
                  setModo("desativando");
                  setErro("");
                  setSucesso("");
                  setSenha("");
                  setCodigo("");
                }}
                className="h-[38px] rounded-sm border-red-200 px-5 text-[13px] text-red-700 hover:bg-red-50"
              >
                <ShieldOff className="mr-1.5 h-4 w-4" />
                Desativar
              </Button>
            )}

            {modo === "ativando" && (
              <div className="space-y-3">
                <p className="text-[12px] text-[#6b7280]">
                  Escaneie o QR no Google Authenticator, Authy ou similar e confirme o
                  código de 6 dígitos.
                </p>
                {qrDataUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    <img
                      src={qrDataUrl}
                      alt="QR Code MFA"
                      className="h-[180px] w-[180px] rounded border border-[#e5e7eb]"
                    />
                    {secret ? (
                      <p className="break-all text-center text-[10px] text-[#9ca3af]">
                        Chave manual: <span className="font-mono">{secret}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-1">
                  <label className="text-[11px] text-[#6b7280]">Código de 6 dígitos</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={codigo}
                    onChange={(e) =>
                      setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className={`${INPUT_CLS} text-center tracking-widest`}
                    placeholder="000000"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={salvando || codigo.length < 6}
                    onClick={() => void confirmarAtivacao()}
                    className="h-[38px] rounded-sm bg-[#4a90d9] px-5 text-[13px] font-semibold text-white hover:bg-[#3d7fc4] disabled:opacity-60"
                  >
                    {salvando ? "Confirmando…" : "Confirmar e ativar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={salvando}
                    onClick={() => {
                      setModo("idle");
                      setCodigo("");
                      setQrDataUrl("");
                      setSecret("");
                    }}
                    className="h-[38px] rounded-sm border-[#d1d5db] px-5 text-[13px]"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {modo === "desativando" && (
              <div className="space-y-3">
                <p className="text-[12px] text-[#6b7280]">
                  Para desativar, confirme sua senha e o código atual do autenticador.
                </p>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#6b7280]">Senha da conta</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#6b7280]">Código do autenticador</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={codigo}
                    onChange={(e) =>
                      setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className={`${INPUT_CLS} text-center tracking-widest`}
                    placeholder="000000"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={salvando || !senha || codigo.length < 6}
                    onClick={() => void desativar()}
                    className="h-[38px] rounded-sm bg-red-600 px-5 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {salvando ? "Desativando…" : "Confirmar desativação"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={salvando}
                    onClick={() => setModo("idle")}
                    className="h-[38px] rounded-sm border-[#d1d5db] px-5 text-[13px]"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
