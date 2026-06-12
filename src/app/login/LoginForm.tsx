"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  lerLembrarLogin,
  limparLembrarLogin,
  marcarUsuarioJaEntrou,
  salvarLembrarLogin,
  usuarioJaEntrou,
} from "@/lib/auth-client";
import { registrarAtividadeSessao } from "@/lib/sessao-inatividade";
import { LAB_CONFIG_ATUALIZADA_EVENT } from "@/lib/configuracoes-lab";
import type { LabBrandingPublico } from "@/lib/lab-branding";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import { dimensoesLogoPx } from "@/lib/lab-logo";
import { useLabConfigClient } from "@/lib/use-lab-config-client";

export type LoginBranding = {
  lab: LabImpressaoConfig;
  nomeLaboratorio: string;
  marcaSubtitulo: string;
};

type Props = {
  brandingInicial: LoginBranding;
};

export function LoginForm({ brandingInicial }: Props) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const { lab: labCtx, nomeLaboratorio: nomeCtx } = useLabConfigClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lembrarSenha, setLembrarSenha] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [jaEntrou, setJaEntrou] = useState(false);
  const [brandingRemoto, setBrandingRemoto] = useState<LabBrandingPublico | null>(
    null
  );

  const redirectDestino = searchParams.get("redirect") || "/app";

  const carregarBranding = useCallback(async () => {
    try {
      const res = await fetch("/api/lab/branding", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as LabBrandingPublico;
      setBrandingRemoto(json);
    } catch {
      /* mantém branding do servidor */
    }
  }, []);

  useEffect(() => {
    void carregarBranding();
    window.addEventListener(LAB_CONFIG_ATUALIZADA_EVENT, carregarBranding);
    return () =>
      window.removeEventListener(LAB_CONFIG_ATUALIZADA_EVENT, carregarBranding);
  }, [carregarBranding]);

  const branding = useMemo(() => {
    const nome =
      brandingRemoto?.nomeLaboratorio?.trim() ||
      nomeCtx?.trim() ||
      brandingInicial.nomeLaboratorio.trim();
    const marcaSubtitulo =
      brandingRemoto?.marcaSubtitulo?.trim() ||
      brandingInicial.marcaSubtitulo.trim() ||
      labCtx.marcaSubtitulo?.trim() ||
      "";
    const logoDataUrl =
      brandingRemoto?.logoDataUrl?.trim() ||
      labCtx.logoDataUrl?.trim() ||
      brandingInicial.lab.logoDataUrl?.trim() ||
      "";
    const logoTamanho =
      brandingRemoto?.logoTamanho ??
      labCtx.logoTamanho ??
      brandingInicial.lab.logoTamanho ??
      0;

    return {
      nomeLaboratorio: nome,
      marcaSubtitulo,
      lab: {
        ...brandingInicial.lab,
        ...labCtx,
        logoDataUrl,
        logoTamanho,
        marcaSubtitulo,
      },
    };
  }, [brandingInicial, brandingRemoto, labCtx, nomeCtx]);

  useEffect(() => {
    void (async () => {
      let emailServidor: string | null = null;
      let jaEntrouServidor = false;

      try {
        const res = await fetch("/api/auth/prefs-lembrete", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { email?: string | null; jaEntrou?: boolean };
          jaEntrouServidor = Boolean(data.jaEntrou);
          emailServidor = data.email?.trim() || null;
        }
      } catch {
        /* fallback cache local pós-login */
      }

      setJaEntrou(jaEntrouServidor || usuarioJaEntrou());

      const salvo = lerLembrarLogin();
      if (salvo?.email) {
        setEmail(salvo.email);
        if (salvo.password) setPassword(salvo.password);
        setLembrarSenha(true);
        return;
      }

      if (emailServidor) {
        setEmail(emailServidor);
        setLembrarSenha(true);
      }
    })();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          email: email.trim(),
          password,
          remember: lembrarSenha,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Erro ao entrar");
        return;
      }

      if (lembrarSenha) {
        salvarLembrarLogin({ email: email.trim(), password });
      } else {
        limparLembrarLogin();
      }

      marcarUsuarioJaEntrou();
      registrarAtividadeSessao();
      window.location.assign(redirectDestino);
    } catch {
      setError(
        "Não foi possível conectar ao servidor. Recarregue a página (Ctrl+Shift+R) e tente de novo."
      );
    } finally {
      setLoading(false);
    }
  }

  const { lab, nomeLaboratorio, marcaSubtitulo } = branding;
  const logoLogin = dimensoesLogoPx(lab, { largura: 120, altura: 72 });
  const logoSrc = lab.logoDataUrl?.trim();

  const inputCls =
    "h-8 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

  return (
    <div className="login-hero relative flex flex-1 items-center justify-center overflow-hidden bg-[#0a2f6e] px-4">
      <img
        src="/images/login-background.png"
        alt=""
        fetchPriority="high"
        decoding="async"
        className="login-hero__bg pointer-events-none select-none"
      />

      <div className="relative z-10 w-full max-w-[300px] rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex flex-col items-center gap-1.5 text-center">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={`Logo ${nomeLaboratorio}`}
              className="object-contain"
              style={{
                width: logoLogin.largura,
                height: logoLogin.altura,
                maxWidth: "100%",
              }}
            />
          ) : null}
          <h1 className="text-base font-bold leading-tight text-slate-900">
            {nomeLaboratorio}
          </h1>
          {marcaSubtitulo ? (
            <p className="text-[9px] uppercase tracking-wide text-slate-500">
              {marcaSubtitulo}
            </p>
          ) : null}
        </div>

        <h2 className="text-sm font-bold text-slate-900">
          {!jaEntrou ? t("login.bemVindoPrimeira") : t("login.bemVindo")}
        </h2>
        <p className="mt-1 text-[10px] text-slate-500">{t("login.subtitulo")}</p>

        <form onSubmit={handleLogin} className="mt-4 space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase text-slate-700">
              {t("login.email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              className={inputCls}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase text-slate-700">
              {t("login.senha")}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                autoComplete="current-password"
                className={`${inputCls} pr-8`}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title={showPassword ? t("login.ocultarSenha") : t("login.mostrarSenha")}
                disabled={loading}
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[10px] text-slate-600">
            <input
              type="checkbox"
              checked={lembrarSenha}
              onChange={(e) => {
                const marcado = e.target.checked;
                setLembrarSenha(marcado);
                if (!marcado) limparLembrarLogin();
              }}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              disabled={loading}
            />
            {t("login.lembrarSenha")}
          </label>

          {error && (
            <p className="rounded bg-red-50 px-2 py-1.5 text-[10px] text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-8 w-full rounded bg-blue-600 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t("login.entrando") : t("login.entrar")}
          </button>
        </form>
      </div>
    </div>
  );
}
