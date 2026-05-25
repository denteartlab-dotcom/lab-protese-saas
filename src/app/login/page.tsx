"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Eye } from "lucide-react";
import { I18nProvider, useI18n } from "@/components/i18n-provider";
import { marcarUsuarioJaEntrou, usuarioJaEntrou } from "@/lib/auth-client";
import { dimensoesLogoPx } from "@/lib/lab-logo";
import { useLabConfigClient } from "@/lib/use-lab-config-client";

function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [jaEntrou, setJaEntrou] = useState(false);
  const { montado, lab, nomeLaboratorio: nomeExibidoLogin } = useLabConfigClient();

  useEffect(() => {
    setJaEntrou(usuarioJaEntrou());
  }, []);

  const logoLogin = dimensoesLogoPx(lab, { largura: 120, altura: 72 });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erro ao entrar");
      return;
    }
    marcarUsuarioJaEntrou();
    const redirect = searchParams.get("redirect") || "/app";
    router.push(redirect);
    router.refresh();
  }

  const inputCls =
    "h-8 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

  return (
    <div className="login-hero relative flex min-h-screen min-h-[100dvh] items-center justify-center overflow-hidden bg-[#0a2f6e] px-4">
      {/* PNG em /public — arquivo original, sem next/image (sem recompressão) */}
      <img
        src="/images/login-background.png"
        alt=""
        fetchPriority="high"
        decoding="async"
        className="login-hero__bg pointer-events-none absolute left-1/2 top-1/2 max-h-none max-w-none -translate-x-1/2 -translate-y-1/2 select-none"
      />
      <div className="relative z-10 w-full max-w-[300px] rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex flex-col items-center gap-1.5 text-center">
          {montado && lab.logoDataUrl ? (
            <img
              src={lab.logoDataUrl}
              alt="Logo do laboratório"
              className="object-contain"
              style={{
                width: logoLogin.largura,
                height: logoLogin.altura,
                maxWidth: "100%",
              }}
            />
          ) : null}
          <h1
            suppressHydrationWarning
            className="text-base font-bold leading-tight text-slate-900"
          >
            {nomeExibidoLogin}
          </h1>
          {montado && lab.marcaSubtitulo ? (
            <p className="text-[9px] text-slate-500">{lab.marcaSubtitulo}</p>
          ) : null}
        </div>

        <h2 className="text-sm font-bold text-slate-900">
          {!montado || !jaEntrou ? t("login.bemVindoPrimeira") : t("login.bemVindo")}
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
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title={showPassword ? t("login.ocultarSenha") : t("login.mostrarSenha")}
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

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

export default function LoginPage() {
  return (
    <I18nProvider>
      <Suspense>
        <LoginForm />
      </Suspense>
    </I18nProvider>
  );
}
