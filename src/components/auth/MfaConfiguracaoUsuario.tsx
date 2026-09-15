"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui";

const INPUT_CLS =
  "h-11 w-full rounded-xl border border-teal-900/10 bg-teal-50/40 px-3.5 font-sans text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500/50 focus:bg-white focus:ring-2 focus:ring-teal-500/15 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";

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
    <div className="mt-0 overflow-hidden rounded-2xl border border-teal-900/10 bg-white/95 shadow-[0_12px_40px_-24px_rgba(15,118,110,0.45)] dark:border-slate-700 dark:bg-slate-900/95">
      <div className="border-b border-teal-900/8 bg-gradient-to-r from-teal-50/90 to-transparent px-6 py-5 dark:border-slate-800 dark:from-teal-950/40">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-sm shadow-teal-900/20">
            {mfaEnabled ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <Shield className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 className="font-display text-[18px] font-semibold tracking-tight text-slate-800 dark:text-white">
              Autenticação em dois fatores
            </h2>
            <p className="mt-0.5 text-[13px] leading-snug text-slate-500 dark:text-slate-400">
              Opcional. Quando ativa, o login pede um código do app autenticador.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-6 py-6">
        {carregando ? (
          <p className="text-[13px] text-slate-500 dark:text-slate-400">Carregando…</p>
        ) : (
          <>
            {erro && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {erro}
              </p>
            )}
            {sucesso && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                {sucesso}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 rounded-xl border border-teal-900/10 bg-teal-50/50 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800/50">
              <div>
                <p className="font-sans text-[13px] font-medium text-slate-700 dark:text-slate-200">
                  Status: {mfaEnabled ? "Ativo" : "Desativado"}
                </p>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
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
                className="h-11 rounded-xl bg-teal-700 px-5 font-sans text-[13px] font-semibold text-white shadow-sm shadow-teal-900/20 hover:bg-teal-800 disabled:opacity-60"
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
                className="h-11 rounded-xl border-red-200 px-5 font-sans text-[13px] text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30"
              >
                <ShieldOff className="mr-1.5 h-4 w-4" />
                Desativar
              </Button>
            )}

            {modo === "ativando" && (
              <div className="space-y-3">
                <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
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
                        Chave manual:{" "}
                        <span className="allow-text-select font-mono tracking-wide">
                          {secret}
                        </span>
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-slate-600 dark:text-slate-300">Código de 6 dígitos</label>
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
                    className="h-11 rounded-xl bg-teal-700 px-5 font-sans text-[13px] font-semibold text-white shadow-sm shadow-teal-900/20 hover:bg-teal-800 disabled:opacity-60"
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
                    className="h-11 rounded-xl border-teal-900/15 px-5 font-sans text-[13px] text-slate-700 hover:bg-teal-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {modo === "desativando" && (
              <div className="space-y-3">
                <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                  Para desativar, confirme sua senha e o código atual do autenticador.
                </p>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-slate-600 dark:text-slate-300">Senha da conta</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-slate-600 dark:text-slate-300">Código do autenticador</label>
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
                    className="h-11 rounded-xl bg-red-600 px-5 font-sans text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {salvando ? "Desativando…" : "Confirmar desativação"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={salvando}
                    onClick={() => setModo("idle")}
                    className="h-11 rounded-xl border-teal-900/15 px-5 font-sans text-[13px] text-slate-700 hover:bg-teal-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
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
