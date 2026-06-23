"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AsaasSeloInstitucional } from "@/components/AsaasSeloInstitucional";
import { LogoMarcaDenteArt } from "@/components/LogoMarcaDenteArt";
import { SeletorPaisComBusca } from "@/components/cadastro/SeletorPaisComBusca";
import { salvarUltimoLaboratorioLogin } from "@/lib/auth-client";
import { WHATSAPP_LANDING_URL } from "@/lib/landing-content";
import { paisPorIso } from "@/lib/paises-telefone";
import { cn } from "@/lib/utils";
import { formatarTelefone } from "@/lib/validar-documento";
import { validarForcaSenha } from "@/lib/validar-senha";

export function CriarContaForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [infoCodigo, setInfoCodigo] = useState("");
  const [error, setError] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

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
      setError("Informe o e-mail antes de solicitar o código.");
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
        setError(data.error || "Não foi possível enviar o código.");
        return;
      }
      setCodigoEnviado(true);
      setInfoCodigo(data.message || "Código enviado! Verifique sua caixa de entrada.");
    } catch {
      setError("Erro de conexão ao enviar o código.");
    } finally {
      setEnviandoCodigo(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.adminSenha !== form.confirmarSenha) {
      setError("As senhas não conferem.");
      return;
    }

    if (!forcaSenha.valida) {
      setError(forcaSenha.erros[0] || "Senha fraca. Use maiúscula, minúscula e número.");
      return;
    }

    const codigo = form.codigoVerificacao.replace(/\D/g, "");
    if (codigo.length !== 6) {
      setError("Informe o código de 6 dígitos enviado por e-mail.");
      return;
    }

    if (!codigoEnviado) {
      setError("Clique em \"Enviar código\" para receber a verificação no e-mail.");
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
          aceiteTermos: true,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        empresa?: { slug?: string; nome?: string };
      };
      if (!res.ok) {
        setError(data.error || "Não foi possível criar a conta.");
        return;
      }
      const slug = data.empresa?.slug?.trim();
      const nome = data.empresa?.nome?.trim();
      if (slug && nome) {
        salvarUltimoLaboratorioLogin({ slug, nome });
        router.push(`/login?cadastro=ok&lab=${encodeURIComponent(slug)}`);
        return;
      }
      router.push("/login?cadastro=ok");
    } catch {
      setError("Erro de conexão. Tente novamente.");
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
            Crie sua conta grátis 🚀
          </h1>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className={labelCls} htmlFor="cadastro-nome">
                Nome do Laboratório
              </label>
              <input
                id="cadastro-nome"
                className={inputCls}
                value={form.nome}
                onChange={(e) => atualizar("nome", e.target.value)}
                placeholder="Digite o nome do laboratório"
                required
                autoComplete="organization"
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="cadastro-email">
                E-mail
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
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                />
                <button
                  type="button"
                  onClick={() => void enviarCodigoVerificacao()}
                  disabled={enviandoCodigo || !form.email.trim()}
                  className="shrink-0 rounded-lg border border-[#0066FF] px-3 text-xs font-semibold text-[#0066FF] transition hover:bg-blue-50 disabled:opacity-50"
                >
                  {enviandoCodigo ? "..." : codigoEnviado ? "Reenviar" : "Enviar código"}
                </button>
              </div>
              {infoCodigo ? (
                <p className="mt-1.5 text-[11px] text-emerald-600">{infoCodigo}</p>
              ) : null}
            </div>

            {codigoEnviado ? (
              <div>
                <label className={labelCls} htmlFor="cadastro-codigo">
                  Código de verificação
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
                  placeholder="000000"
                  required
                  autoComplete="one-time-code"
                  autoFocus
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Enviamos um código de 6 dígitos para o seu e-mail. Válido por 10 minutos.
                </p>
              </div>
            ) : null}

            <div>
              <label className={labelCls} htmlFor="cadastro-pais">
                País
              </label>
              <SeletorPaisComBusca
                id="cadastro-pais"
                modo="pais"
                value={form.pais}
                onChange={(iso) => selecionarPais(iso)}
                aria-label="País"
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="cadastro-whatsapp">
                Celular (WhatsApp)
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
                  aria-label="Código telefone país"
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
                  placeholder={form.pais === "BR" ? "(00) 00000-0000" : "Número com DDD"}
                  required
                  autoComplete="tel"
                />
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="cadastro-senha">
                Nova Senha
              </label>
              <div className="relative">
                <input
                  id="cadastro-senha"
                  type={mostrarSenha ? "text" : "password"}
                  className={cn(inputCls, "pr-10")}
                  value={form.adminSenha}
                  onChange={(e) => atualizar("adminSenha", e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="cadastro-confirmar">
                Confirmar a Senha
              </label>
              <div className="relative">
                <input
                  id="cadastro-confirmar"
                  type={mostrarConfirmar ? "text" : "password"}
                  className={cn(inputCls, "pr-10")}
                  value={form.confirmarSenha}
                  onChange={(e) => atualizar("confirmarSenha", e.target.value)}
                  placeholder="Repita a senha"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarConfirmar((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={mostrarConfirmar ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarConfirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 h-11 w-full rounded-lg bg-[#0066FF] text-sm font-semibold text-white transition hover:bg-[#0052cc] disabled:opacity-60"
            >
              {loading ? "Cadastrando..." : "Cadastrar"}
            </button>

            <p className="pt-1 text-center text-[11px] leading-relaxed text-slate-500">
              Ao cadastrar você concorda com os{" "}
              <Link href="/termos" className="text-[#0066FF] hover:underline">
                Termos de Uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" className="text-[#0066FF] hover:underline">
                Política de Privacidade
              </Link>
              .
            </p>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Já tem uma conta?{" "}
          <Link href="/login" className="font-medium text-[#0066FF] hover:underline">
            Entrar
          </Link>
          {" · "}
          <a
            href={WHATSAPP_LANDING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#0066FF] hover:underline"
          >
            Fale conosco
          </a>
        </p>

        <AsaasSeloInstitucional className="mt-6 max-w-sm" />
      </div>
    </div>
  );
}
