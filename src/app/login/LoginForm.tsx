"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  lerLembrarLogin,
  lerLogoLaboratorioLogin,
  limparLembrarLogin,
  marcarUsuarioJaEntrou,
  salvarLembrarLogin,
  salvarLogoLaboratorioLogin,
  salvarUltimoLaboratorioLogin,
  lerUltimoLaboratorioLogin,
  usuarioJaEntrou,
  ULTIMO_LAB_SLUG_COOKIE,
  JA_ENTROU_COOKIE,
} from "@/lib/auth-client";
import { registrarAtividadeSessao } from "@/lib/sessao-inatividade";
import { montarTituloDocumento } from "@/lib/document-title";
import { LAB_CONFIG_ATUALIZADA_EVENT } from "@/lib/configuracoes-lab";
import type { LabBrandingPublico } from "@/lib/lab-branding-types";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import { dimensoesLogoPx } from "@/lib/lab-logo";
import { analisarCaminhoApp } from "@/lib/rotas-app";

async function aguardarSessaoConfirmada(): Promise<boolean> {
  for (let tentativa = 0; tentativa < 6; tentativa += 1) {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.ok) return true;
    } catch {
      /* nova tentativa */
    }
    await new Promise((resolve) => window.setTimeout(resolve, 200 + tentativa * 150));
  }
  return false;
}

async function entrarNoApp(destino: string) {
  const sessaoOk = await aguardarSessaoConfirmada();
  const path = destino.startsWith("/") ? destino : `/${destino}`;
  // Sempre no MESMO host da página (evita 301 apex↔www roubar o cookie).
  const url = `${window.location.origin}${path}`;
  if (!sessaoOk) {
    throw new Error("SESSAO_NAO_CONFIRMADA");
  }
  window.location.assign(url);
}
export type LoginBranding = {
  lab: LabImpressaoConfig;
  nomeLaboratorio: string;
  marcaSubtitulo: string;
};

type EmpresaLogin = {
  slug: string;
  nome: string;
};

type Props = {
  brandingInicial: LoginBranding;
  brandingLaboratorio?: LabBrandingPublico | null;
  jaEntrouInicial?: boolean;
};

function brandingDeRemoto(
  remoto: LabBrandingPublico,
  plataforma: LoginBranding,
  slugFallback?: string
) {
  const slug = remoto.empresaSlug?.trim() || slugFallback?.trim() || "";
  const logoCache = slug ? lerLogoLaboratorioLogin(slug) : "";
  const logoDataUrl =
    remoto.logoDataUrl?.trim() || logoCache || plataforma.lab.logoDataUrl;
  return {
    nomeLaboratorio: remoto.nomeLaboratorio?.trim() || plataforma.nomeLaboratorio,
    marcaSubtitulo: remoto.marcaSubtitulo?.trim() || plataforma.marcaSubtitulo,
    labIdentificado: true,
    lab: {
      ...plataforma.lab,
      logoDataUrl,
      logoTamanho: remoto.logoTamanho ?? plataforma.lab.logoTamanho ?? 0,
      marcaSubtitulo: remoto.marcaSubtitulo?.trim() || plataforma.marcaSubtitulo,
    },
  };
}

export function LoginForm({
  brandingInicial,
  brandingLaboratorio = null,
  jaEntrouInicial = false,
}: Props) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lembrarSenha, setLembrarSenha] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [aguardandoServidor, setAguardandoServidor] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [jaEntrou, setJaEntrou] = useState(jaEntrouInicial);
  const [clientePronto, setClientePronto] = useState(false);
  const [brandingRemoto, setBrandingRemoto] = useState<LabBrandingPublico | null>(
    brandingLaboratorio
  );
  const [empresasDisponiveis, setEmpresasDisponiveis] = useState<EmpresaLogin[]>([]);
  const [empresaSlugSelecionado, setEmpresaSlugSelecionado] = useState("");
  const redirectDestino = searchParams.get("redirect") || "/app";
  const cadastroOk = searchParams.get("cadastro") === "ok";
  const labSlugQuery =
    searchParams.get("lab")?.trim() || searchParams.get("slug")?.trim() || "";

  const empresaSlugRedirect = useMemo(() => {
    if (!redirectDestino.startsWith("/app")) return "";
    const { slug } = analisarCaminhoApp(redirectDestino);
    return slug || "";
  }, [redirectDestino]);

  const labSlugAtivo = useMemo(() => {
    return (
      empresaSlugSelecionado.trim() ||
      labSlugQuery ||
      empresaSlugRedirect ||
      brandingRemoto?.empresaSlug ||
      ""
    );
  }, [
    empresaSlugSelecionado,
    labSlugQuery,
    empresaSlugRedirect,
    brandingRemoto?.empresaSlug,
  ]);

  const carregarBranding = useCallback(async (opts: { slug?: string; email?: string }) => {
    try {
      const slug = opts.slug?.trim() || "";
      const emailBusca = opts.email?.trim() || "";
      const params = new URLSearchParams();
      if (slug) {
        params.set("slug", slug);
      } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailBusca)) {
        params.set("email", emailBusca);
      } else {
        return;
      }

      const res = await fetch(`/api/lab/branding?${params}`, { cache: "no-store" });
      if (!res.ok) return;

      const json = (await res.json()) as LabBrandingPublico;
      if (!json.empresaSlug) return;

      setBrandingRemoto((atual) => {
        const ref = atual ?? brandingLaboratorio;
        const logoDataUrl =
          json.logoDataUrl?.trim() ||
          ref?.logoDataUrl?.trim() ||
          (json.empresaSlug ? lerLogoLaboratorioLogin(json.empresaSlug) : "") ||
          "";
        return {
          ...json,
          logoDataUrl,
          logoTamanho: json.logoDataUrl?.trim()
            ? json.logoTamanho
            : (ref?.logoTamanho ?? json.logoTamanho),
        };
      });
    } catch {
      /* mantém branding atual */
    }
  }, [brandingLaboratorio]);

  useEffect(() => {
    if (!jaEntrou) return;
    const ultimo = lerUltimoLaboratorioLogin();
    if (!ultimo?.slug) return;
    document.cookie = `${ULTIMO_LAB_SLUG_COOKIE}=${encodeURIComponent(ultimo.slug)}; path=/; max-age=31536000; samesite=lax`;
    if (brandingLaboratorio?.empresaSlug || labSlugQuery || empresaSlugRedirect) return;
    void carregarBranding({ slug: ultimo.slug });
  }, [
    jaEntrou,
    brandingLaboratorio?.empresaSlug,
    labSlugQuery,
    empresaSlugRedirect,
    carregarBranding,
  ]);

  useEffect(() => {
    if (!jaEntrou) return;
    if (!labSlugAtivo) return;
    if (brandingRemoto?.empresaSlug === labSlugAtivo) return;
    void carregarBranding({ slug: labSlugAtivo });
  }, [jaEntrou, labSlugAtivo, brandingRemoto?.empresaSlug, carregarBranding]);

  useEffect(() => {
    if (!jaEntrou) return;
    if (labSlugAtivo) return;
    const valor = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return;
    void carregarBranding({ email: valor });
  }, [jaEntrou, email, labSlugAtivo, carregarBranding]);

  const branding = useMemo(() => {
    const plataforma = brandingInicial;
    if (!jaEntrou) {
      return {
        nomeLaboratorio: plataforma.nomeLaboratorio,
        marcaSubtitulo: plataforma.marcaSubtitulo,
        labIdentificado: false,
        lab: plataforma.lab,
      };
    }
    const remoto = brandingRemoto ?? brandingLaboratorio;
    if (remoto?.empresaSlug) {
      return brandingDeRemoto(remoto, plataforma, labSlugAtivo);
    }
    return {
      nomeLaboratorio: plataforma.nomeLaboratorio,
      marcaSubtitulo: plataforma.marcaSubtitulo,
      labIdentificado: false,
      lab: plataforma.lab,
    };
  }, [brandingInicial, brandingRemoto, brandingLaboratorio, labSlugAtivo, jaEntrou]);

  useEffect(() => {
    const slug =
      brandingRemoto?.empresaSlug?.trim() ||
      brandingLaboratorio?.empresaSlug?.trim() ||
      labSlugAtivo.trim();
    const logo =
      brandingRemoto?.logoDataUrl?.trim() ||
      brandingLaboratorio?.logoDataUrl?.trim() ||
      branding.lab.logoDataUrl?.trim() ||
      "";
    if (slug && logo.startsWith("data:image")) {
      salvarLogoLaboratorioLogin(slug, logo);
    }
  }, [
    brandingRemoto,
    brandingLaboratorio,
    labSlugAtivo,
    branding.lab.logoDataUrl,
  ]);

  useEffect(() => {
    if (!jaEntrou) return;
    const atualizar = () => {
      if (labSlugAtivo) void carregarBranding({ slug: labSlugAtivo });
    };
    window.addEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizar);
    return () => window.removeEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizar);
  }, [jaEntrou, carregarBranding, labSlugAtivo]);

  useEffect(() => {
    document.title = montarTituloDocumento();
  }, []);

  // Cloudflare faz 301 apex→www no /api; login no apex perde o cookie.
  // Força a página de login a ficar no www antes de qualquer POST.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname.toLowerCase();
    if (host !== "denteartlab.com.br") return;
    const dest = `https://www.denteartlab.com.br${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(dest);
  }, []);

  useEffect(() => {
    setClientePronto(true);
    if (jaEntrouInicial) return;
    if (usuarioJaEntrou()) {
      setJaEntrou(true);
      document.cookie = `${JA_ENTROU_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
    }
  }, [jaEntrouInicial]);

  useEffect(() => {
    const salvo = lerLembrarLogin();
    if (salvo?.email) {
      setEmail(salvo.email);
      setLembrarSenha(true);
    }
  }, []);

  async function tentarEntrar(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setAguardandoServidor(false);
    setError("");

    const avisoLento = window.setTimeout(() => setAguardandoServidor(true), 8000);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 120_000);

    const slugLogin =
      empresaSlugSelecionado.trim() ||
      empresaSlugRedirect ||
      undefined;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          email: email.trim(),
          password,
          remember: lembrarSenha,
          ...(slugLogin ? { empresaSlug: slugLogin } : {}),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        redirect?: string;
        empresas?: EmpresaLogin[];
        user?: { empresaSlug?: string; empresaNome?: string };
      };

      if (res.status === 409 && data.code === "MULTIPLAS_CONTAS" && data.empresas?.length) {
        setEmpresasDisponiveis(data.empresas);
        setEmpresaSlugSelecionado(data.empresas[0]?.slug || "");
        setError(
          data.error ||
            "Este e-mail está em mais de um laboratório. Escolha qual deseja acessar."
        );
        return;
      }

      if (!res.ok) {
        setError(data.error || "Erro ao entrar");
        return;
      }

      if (data.code === "ASSINATURA_VENCIDA" || data.redirect === "/assinatura-vencida") {
        if (lembrarSenha) {
          salvarLembrarLogin({ email: email.trim() });
        } else {
          limparLembrarLogin();
        }
        marcarUsuarioJaEntrou();
        await entrarNoApp(data.redirect || "/assinatura-vencida");
        return;
      }

      if (data.redirect?.trim()) {
        if (lembrarSenha) {
          salvarLembrarLogin({ email: email.trim() });
        } else {
          limparLembrarLogin();
        }
        marcarUsuarioJaEntrou();
        await entrarNoApp(data.redirect.trim());
        return;
      }

      setEmpresasDisponiveis([]);

      const slug = data.user?.empresaSlug?.trim();
      const nomeLab = data.user?.empresaNome?.trim();
      if (slug && nomeLab) {
        salvarUltimoLaboratorioLogin({ slug, nome: nomeLab });
      }
      const logoAtual =
        brandingRemoto?.logoDataUrl?.trim() ||
        brandingLaboratorio?.logoDataUrl?.trim() ||
        (slug ? lerLogoLaboratorioLogin(slug) : "");
      if (slug && logoAtual.startsWith("data:image")) {
        salvarLogoLaboratorioLogin(slug, logoAtual);
      }

      let destino = redirectDestino;
      if (destino === "/app" && slug) {
        destino = `/app/${slug}`;
      } else if (destino.startsWith("/app/") && slug) {
        const segundo = destino.split("/")[2];
        const rotasLegadas = new Set([
          "alterar-senha",
          "cadastros",
          "clientes",
          "configuracoes",
          "financeiro",
          "orcamentos",
          "pacientes",
          "producao",
          "produtos",
          "relatorios",
          "trabalhos",
        ]);
        if (segundo && rotasLegadas.has(segundo)) {
          destino = `/app/${slug}${destino.slice(4)}`;
        }
      }

      if (lembrarSenha) {
        salvarLembrarLogin({ email: email.trim() });
      } else {
        limparLembrarLogin();
      }

      marcarUsuarioJaEntrou();
      registrarAtividadeSessao();
      await entrarNoApp(destino);
    } catch (erro) {
      const abortado =
        erro instanceof DOMException && erro.name === "AbortError";
      const sessaoFalhou =
        erro instanceof Error && erro.message === "SESSAO_NAO_CONFIRMADA";
      setError(
        sessaoFalhou
          ? "Login ok, mas o cookie não ficou neste domínio (nginx redireciona apex↔www). Use https://www.denteartlab.com.br/login ou corrija o nginx sem 301 entre os hosts."
          : abortado
            ? "O servidor demorou demais para responder. Aguarde e tente de novo."
            : "Não foi possível conectar ao servidor. Recarregue a página (Ctrl+Shift+R) e tente de novo."
      );
    } finally {
      window.clearTimeout(avisoLento);
      window.clearTimeout(timeoutId);
      setAguardandoServidor(false);
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    await tentarEntrar(e);
  }

  const { lab, nomeLaboratorio, marcaSubtitulo, labIdentificado } = branding;
  const logoLogin = dimensoesLogoPx(lab, { largura: 120, altura: 72 });
  const logoLab = lab.logoDataUrl?.trim();
  const logoSrc = !jaEntrou
    ? brandingInicial.lab.logoDataUrl?.trim() || "/logo-lab-protese.png"
    : logoLab || (!labIdentificado ? brandingInicial.lab.logoDataUrl : "");

  const inputCls =
    "h-8 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

  return (
    <div className="login-hero relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-[#0a2f6e] px-4 py-8">
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
          ) : labIdentificado && nomeLaboratorio ? (
            <div
              className="flex items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-600"
              style={{
                width: logoLogin.largura,
                height: logoLogin.altura,
                fontSize: Math.min(logoLogin.altura * 0.45, 32),
              }}
              aria-hidden
            >
              {nomeLaboratorio.charAt(0).toUpperCase()}
            </div>
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

        <h2 className="text-sm font-bold text-slate-900" suppressHydrationWarning>
          {!(clientePronto ? jaEntrou : jaEntrouInicial)
            ? t("login.bemVindoPrimeira")
            : t("login.bemVindo")}
        </h2>
        <p className="mt-1 text-[10px] text-slate-500">{t("login.subtitulo")}</p>

        {cadastroOk && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-emerald-800">
              Conta criada com sucesso!
            </p>
            <p className="mt-0.5 text-[10px] text-emerald-700">
              Faça login para começar seu teste grátis de 14 dias no plano Premium.
            </p>
          </div>
        )}

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
            <div className="flex justify-end">
              <a
                href="/recuperar-senha"
                className="text-[10px] font-medium text-blue-600 hover:underline"
              >
                Esqueceu sua senha?
              </a>
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

          {aguardandoServidor && loading ? (
            <p className="rounded bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
              Primeira entrada após iniciar o servidor pode levar até 1 minuto (compilação local).
              Aguarde…
            </p>
          ) : null}

          {error && (
            <p className="rounded bg-red-50 px-2 py-1.5 text-[10px] text-red-700">{error}</p>
          )}

          {empresasDisponiveis.length > 1 ? (
            <div className="space-y-1 rounded border border-blue-100 bg-blue-50/80 p-3">
              <p className="text-[10px] font-medium text-slate-700">Laboratório</p>
              <select
                value={empresaSlugSelecionado}
                onChange={(e) => setEmpresaSlugSelecionado(e.target.value)}
                className={inputCls}
                disabled={loading}
              >
                {empresasDisponiveis.map((empresa) => (
                  <option key={empresa.slug} value={empresa.slug}>
                    {empresa.nome} ({empresa.slug})
                  </option>
                ))}
              </select>
            </div>
          ) : empresaSlugRedirect ? (
            <p className="rounded bg-slate-50 px-2 py-1.5 text-[10px] text-slate-600">
              Entrando em: <strong>/app/{empresaSlugRedirect}</strong>
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="h-8 w-full rounded bg-blue-600 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t("login.entrando") : t("login.entrar")}
          </button>

          <p className="text-center text-[10px] text-slate-500">
            Novo laboratório?{" "}
            <a href="/cadastro" className="font-medium text-blue-600 hover:underline">
              Cadastre-se
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
