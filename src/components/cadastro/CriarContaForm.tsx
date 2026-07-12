"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AsaasSeloInstitucional } from "@/components/AsaasSeloInstitucional";
import { useI18n } from "@/components/i18n-provider";
import { LogoMarcaDenteArt } from "@/components/LogoMarcaDenteArt";
import { SeletorPaisComBusca } from "@/components/cadastro/SeletorPaisComBusca";
import { salvarUltimoLaboratorioLogin } from "@/lib/auth-client";
import type { MessageKey } from "@/lib/i18n/messages";
import { WHATSAPP_LANDING_URL } from "@/lib/landing-content";
import { paisPorIso } from "@/lib/paises-telefone";
import { cn } from "@/lib/utils";
import { formatarTelefone } from "@/lib/validar-documento";
import { validarForcaSenha } from "@/lib/validar-senha";

const ERROS_SENHA_PARA_CHAVE: Record<string, MessageKey> = {
  "Mínimo de 8 caracteres.": "cadastro.senhaErroMinimo",
  "Inclua uma letra minúscula.": "cadastro.senhaErroMinuscula",
  "Inclua uma letra maiúscula.": "cadastro.senhaErroMaiuscula",
  "Inclua um número.": "cadastro.senhaErroNumero",
};

export function CriarContaForm({ versaoSeloAsaas }: { versaoSeloAsaas?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [infoCodigo, setInfoCodigo] = useState("");
  const [error, setError] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [aceiteTermos, setAceiteTermos] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    email: "",
    pais: "BR",
    codigoTelefone: "+55",
    whatsapp: "",
    adminSenha: "",
    confirmarSenha: "",
    codigoVerificacao: "",
  });

  const forcaSenha = validarForcaSenha(form.adminSenha);

  function traduzirErroSenha(msg: string) {
    const chave = ERROS_SENHA_PARA_CHAVE[msg];
    return chave ? t(chave) : msg;
  }

  function atualizar<K extends keyof typeof form>(campo: K, valor: typeof form[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function selecionarPais(iso: string) {
    const pais = paisPorIso(iso);
    setForm((f) => ({
      ...f,
      pais: iso,
      codigoTelefone: pais?.dial ?? f.codigoTelefone,
    }));
  }

  async function enviarCodigoVerificacao() {
    setError("");
    setInfoCodigo("");
    const email = form.email.trim();
    if (!email) {
      setError(t("login.informeEmailCodigo"));
      return;
    }

    setEnviandoCodigo(true);
    try {
      const res = await fetch("/api/empresas/cadastro/enviar-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        aguardarSegundos?: number;
      };
      if (!res.ok) {
        setError(data.error || t("cadastro.erroEnviarCodigo"));
        return;
      }
      setCodigoEnviado(true);
      setInfoCodigo(data.message || t("cadastro.codigoEnviadoSucesso"));
    } catch {
      setError(t("cadastro.erroConexaoCodigo"));
    } finally {
      setEnviandoCodigo(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.adminSenha !== form.confirmarSenha) {
      setError(t("login.senhasDiferentes"));
      return;
    }

    if (!forcaSenha.valida) {
      setError(
        forcaSenha.erros[0]
          ? traduzirErroSenha(forcaSenha.erros[0])
          : t("cadastro.senhaFraca")
      );
      return;
    }

    const codigo = form.codigoVerificacao.replace(/\D/g, "");
    if (codigo.length !== 6) {
      setError(t("cadastro.informeCodigoEmail"));
      return;
    }

    if (!codigoEnviado) {
      setError(t("cadastro.cliqueEnviarCodigo"));
      return;
    }

    if (!aceiteTermos) {
      setError(t("cadastro.aceiteTermosObrigatorio"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/empresas/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim(),
          pais: form.pais,
          codigoTelefone: form.codigoTelefone,
          whatsapp: form.whatsapp.trim(),
          adminSenha: form.adminSenha,
          confirmarSenha: form.confirmarSenha,
          codigoVerificacao: codigo,
          aceiteTermos: true as const,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        autoLogin?: boolean;
        redirect?: string;
        empresa?: { slug?: string; nome?: string };
      };
      if (!res.ok) {
        setError(data.error || t("cadastro.erroCriarConta"));
        return;
      }
      const slug = data.empresa?.slug?.trim();
      const nome = data.empresa?.nome?.trim();
      if (slug && nome) {
        salvarUltimoLaboratorioLogin({ slug, nome });
      }
      if (data.autoLogin && data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      if (data.redirect) {
        router.push(data.redirect);
        return;
      }
      if (slug) {
        router.push(`/login?cadastro=ok&lab=${encodeURIComponent(slug)}`);
        return;
      }
      router.push("/login?cadastro=ok");
    } catch {
      setError(t("cadastro.erroConexao"));
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/15";

  const labelCls = "mb-1.5 block text-xs font-medium text-slate-600";

  return (
    <div className="relative flex min-h-[calc(100dvh/var(--site-zoom,0.9))] items-center justify-center overflow-hidden bg-[#f4f6f9] px-4 py-10">
      <div
        className="pointer-events-none absolute -left-16 top-16 h-56 w-72 rotate-[-8deg] rounded-[2rem] border border-dashed border-slate-300/60 bg-white/40"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-12 bottom-20 h-48 w-64 rotate-[6deg] rounded-[2rem] border border-dashed border-blue-200/70 bg-blue-50/50"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-8 h-40 w-52 -translate-x-1/2 rounded-[1.75rem] border border-dashed border-violet-200/60 bg-violet-50/40"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-[360px]">
        <div className="rounded-2xl border border-slate-100 bg-white px-6 py-7 shadow-[0_8px_30px_rgba(15,23,42,0.08)] sm:px-7">
          <div className="mb-5 flex justify-center">
            <LogoMarcaDenteArt variant="topo" className="!h-10 !w-auto max-w-[180px]" />
          </div>

          <h1 className="mb-6 text-center text-lg font-bold text-slate-900">
            {t("cadastro.titulo")}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className={labelCls} htmlFor="cadastro-nome">
                {t("login.nomeLaboratorio")}
              </label>
              <input
                id="cadastro-nome"
                className={inputCls}
                value={form.nome}
                onChange={(e) => atualizar("nome", e.target.value)}
                placeholder={t("cadastro.placeholderNomeLaboratorio")}
                required
                autoComplete="organization"
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="cadastro-email">
                {t("login.email")}
              </label>
              <div className="flex gap-2">
                <input
                  id="cadastro-email"
                  type="email"
                  className={inputCls}
                  value={form.email}
                  onChange={(e) => {
                    atualizar("email", e.target.value);
                    setCodigoEnviado(false);
                    setInfoCodigo("");
                    atualizar("codigoVerificacao", "");
                  }}
                  placeholder={t("cadastro.emailPlaceholder")}
                  required
                  autoComplete="email"
                />
                <button
                  type="button"
                  onClick={() => void enviarCodigoVerificacao()}
                  disabled={enviandoCodigo || !form.email.trim()}
                  className="shrink-0 rounded-lg border border-[#0066FF] px-3 text-xs font-semibold text-[#0066FF] transition hover:bg-blue-50 disabled:opacity-50"
                >
                  {enviandoCodigo
                    ? t("login.enviandoCodigo")
                    : codigoEnviado
                      ? t("login.reenviarCodigo")
                      : t("cadastro.enviarCodigo")}
                </button>
              </div>
              {infoCodigo ? (
                <p className="mt-1.5 text-[11px] text-emerald-600">{infoCodigo}</p>
              ) : null}
            </div>

            {codigoEnviado ? (
              <div>
                <label className={labelCls} htmlFor="cadastro-codigo">
                  {t("cadastro.codigoVerificacao")}
                </label>
                <input
                  id="cadastro-codigo"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className={cn(inputCls, "tracking-[0.35em] text-center font-semibold")}
                  value={form.codigoVerificacao}
                  onChange={(e) =>
                    atualizar("codigoVerificacao", e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder={t("login.codigoPlaceholder")}
                  required
                  autoComplete="one-time-code"
                  autoFocus
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  {t("cadastro.codigoEnviadoEmail")}
                </p>
              </div>
            ) : null}

            <div>
              <label className={labelCls} htmlFor="cadastro-pais">
                {t("idioma.labelPais")}
              </label>
              <SeletorPaisComBusca
                id="cadastro-pais"
                modo="pais"
                value={form.pais}
                onChange={(iso) => selecionarPais(iso)}
                aria-label={t("cadastro.paisAria")}
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="cadastro-whatsapp">
                {t("cadastro.celularWhatsapp")}
              </label>
              <div className="flex gap-2">
                <SeletorPaisComBusca
                  modo="telefone"
                  value={form.codigoTelefone}
                  paisIso={form.pais}
                  onChange={(dial, pais) => {
                    setForm((f) => ({
                      ...f,
                      codigoTelefone: dial,
                      pais: pais?.iso ?? f.pais,
                    }));
                  }}
                  className="w-[112px] shrink-0"
                  aria-label={t("cadastro.codigoTelefoneAria")}
                />
                <input
                  id="cadastro-whatsapp"
                  type="tel"
                  className={inputCls}
                  value={form.whatsapp}
                  onChange={(e) =>
                    atualizar(
                      "whatsapp",
                      form.pais === "BR" ? formatarTelefone(e.target.value) : e.target.value
                    )
                  }
                  placeholder={
                    form.pais === "BR"
                      ? t("login.whatsappPlaceholder")
                      : t("cadastro.numeroComDdd")
                  }
                  required
                  autoComplete="tel"
                />
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="cadastro-senha">
                {t("cadastro.novaSenha")}
              </label>
              <div className="relative">
                <input
                  id="cadastro-senha"
                  type={mostrarSenha ? "text" : "password"}
                  className={cn(inputCls, "pr-10")}
                  value={form.adminSenha}
                  onChange={(e) => atualizar("adminSenha", e.target.value)}
                  placeholder={t("cadastro.senhaMinimo")}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={mostrarSenha ? t("login.ocultarSenha") : t("login.mostrarSenha")}
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="cadastro-confirmar">
                {t("cadastro.confirmarSenhaLabel")}
              </label>
              <div className="relative">
                <input
                  id="cadastro-confirmar"
                  type={mostrarConfirmar ? "text" : "password"}
                  className={cn(inputCls, "pr-10")}
                  value={form.confirmarSenha}
                  onChange={(e) => atualizar("confirmarSenha", e.target.value)}
                  placeholder={t("cadastro.repitaSenha")}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarConfirmar((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={
                    mostrarConfirmar ? t("login.ocultarSenha") : t("login.mostrarSenha")
                  }
                >
                  {mostrarConfirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            ) : null}

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-left">
              <input
                type="checkbox"
                checked={aceiteTermos}
                onChange={(e) => setAceiteTermos(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#0066FF] focus:ring-[#0066FF]/30"
                required
              />
              <span className="text-[11px] leading-relaxed text-slate-600">
                {t("cadastro.aceiteTermosPrefixo")}{" "}
                <Link
                  href="/termos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#0066FF] hover:underline"
                >
                  {t("cadastro.termosUso")}
                </Link>{" "}
                {t("cadastro.eA")}{" "}
                <Link
                  href="/privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#0066FF] hover:underline"
                >
                  {t("cadastro.politicaPrivacidade")}
                </Link>{" "}
                {t("cadastro.doLabProtese")}
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !aceiteTermos}
              className="mt-1 h-11 w-full rounded-lg bg-[#0066FF] text-sm font-semibold text-white transition hover:bg-[#0052cc] disabled:opacity-60"
            >
              {loading ? t("cadastro.cadastrando") : t("cadastro.cadastrar")}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          {t("cadastro.jaTemConta")}{" "}
          <Link href="/login" className="font-medium text-[#0066FF] hover:underline">
            {t("login.entrar")}
          </Link>
          {" · "}
          <a
            href={WHATSAPP_LANDING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#0066FF] hover:underline"
          >
            {t("cadastro.faleConosco")}
          </a>
        </p>

        <AsaasSeloInstitucional className="mt-6 max-w-sm" versaoCache={versaoSeloAsaas} />
      </div>
    </div>
  );
}
