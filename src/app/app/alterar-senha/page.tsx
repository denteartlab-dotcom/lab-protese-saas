"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, Home, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import { MfaConfiguracaoUsuario } from "@/components/auth/MfaConfiguracaoUsuario";

const INPUT_CLS =
  "h-11 w-full select-text caret-auto rounded-xl border border-teal-900/10 bg-teal-50/40 px-3.5 font-sans text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500/50 focus:bg-white focus:ring-2 focus:ring-teal-500/15 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:border-teal-400/40 dark:focus:bg-slate-900";

function CampoSenha({
  id,
  label,
  value,
  onChange,
  mostrar,
  onToggleMostrar,
  autoComplete,
  minLength = 1,
  ariaMostrar,
  ariaOcultar,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  mostrar: boolean;
  onToggleMostrar: () => void;
  autoComplete: string;
  minLength?: number;
  ariaMostrar: string;
  ariaOcultar: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block select-none font-sans text-[12px] font-semibold tracking-wide text-slate-600 dark:text-slate-300"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={mostrar ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`${INPUT_CLS} pr-11`}
          required
          minLength={minLength}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggleMostrar}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 caret-transparent transition hover:bg-teal-900/5 hover:text-teal-800 dark:hover:bg-white/10 dark:hover:text-teal-200"
          aria-label={mostrar ? ariaOcultar : ariaMostrar}
        >
          {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function AlterarSenhaPage() {
  const { t } = useI18n();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    if (novaSenha !== confirmarSenha) {
      setErro(t("login.senhasDiferentes"));
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch("/api/auth/alterar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senhaAtual,
          novaSenha,
          confirmarSenha,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error || "Não foi possível alterar a senha.");
        return;
      }
      setSucesso(data.message || "Senha alterada com sucesso.");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const ariaMostrar = t("login.mostrarSenha");
  const ariaOcultar = t("login.ocultarSenha");

  return (
    <div
      className="select-none caret-transparent pb-10 pt-1 font-sans text-slate-700 dark:text-slate-200"
      onMouseDown={(e) => {
        const el = e.target as HTMLElement | null;
        if (!el) return;
        if (el.closest("input, textarea, select, .allow-text-select")) return;
        // Evita o caret "|" ao clicar em títulos, cards e botões
        if (el.closest("button, a, h1, h2, h3, label, p, span, section, div")) {
          const tag = el.tagName;
          if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
            // não bloqueia o click do botão; só impede seleção
          }
        }
      }}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700/75 dark:text-teal-300/75">
            Conta
          </p>
          <h1 className="font-display text-[30px] font-semibold leading-none tracking-tight text-slate-800 dark:text-white">
            {t("alterarSenha.titulo")}
          </h1>
          <p className="mt-2 max-w-md font-sans text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t("alterarSenha.subtitulo")}
          </p>
        </div>
        <div className="flex items-center gap-1.5 font-sans text-[12px] text-slate-400">
          <Home className="h-3.5 w-3.5 shrink-0" />
          <Link
            href="/app"
            className="transition hover:text-teal-700 dark:hover:text-teal-300"
            onMouseDown={(e) => e.preventDefault()}
          >
            Início
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600 dark:text-slate-300">{t("alterarSenha.titulo")}</span>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-5">
        <section className="overflow-hidden rounded-2xl border border-teal-900/10 bg-white/95 shadow-[0_16px_48px_-28px_rgba(15,118,110,0.5)] dark:border-slate-700 dark:bg-slate-900/95">
          <div className="border-b border-teal-900/8 bg-gradient-to-r from-teal-50/90 via-teal-50/40 to-transparent px-6 py-5 dark:border-slate-800 dark:from-teal-950/40">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-sm shadow-teal-900/25">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-[18px] font-semibold tracking-tight text-slate-800 dark:text-white">
                  {t("alterarSenha.titulo")}
                </h2>
                <p className="mt-0.5 font-sans text-[13px] leading-snug text-slate-500 dark:text-slate-400">
                  Defina uma senha forte para proteger o acesso ao laboratório.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
            {erro ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 font-sans text-[13px] text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {erro}
              </p>
            ) : null}
            {sucesso ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 font-sans text-[13px] text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                {sucesso}
              </p>
            ) : null}

            <CampoSenha
              id="senha-atual"
              label={t("alterarSenha.senhaAtual")}
              value={senhaAtual}
              onChange={setSenhaAtual}
              mostrar={mostrarSenhaAtual}
              onToggleMostrar={() => setMostrarSenhaAtual((v) => !v)}
              autoComplete="current-password"
              ariaMostrar={ariaMostrar}
              ariaOcultar={ariaOcultar}
            />
            <CampoSenha
              id="nova-senha"
              label={t("alterarSenha.novaSenha")}
              value={novaSenha}
              onChange={setNovaSenha}
              mostrar={mostrarNovaSenha}
              onToggleMostrar={() => setMostrarNovaSenha((v) => !v)}
              autoComplete="new-password"
              minLength={6}
              ariaMostrar={ariaMostrar}
              ariaOcultar={ariaOcultar}
            />
            <CampoSenha
              id="confirmar-senha"
              label={t("alterarSenha.confirmarSenha")}
              value={confirmarSenha}
              onChange={setConfirmarSenha}
              mostrar={mostrarConfirmar}
              onToggleMostrar={() => setMostrarConfirmar((v) => !v)}
              autoComplete="new-password"
              minLength={6}
              ariaMostrar={ariaMostrar}
              ariaOcultar={ariaOcultar}
            />

            <p className="font-sans text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
              {t("alterarSenha.dicaMinimo")}
            </p>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <Button
                type="submit"
                disabled={salvando}
                onMouseDown={(e) => e.preventDefault()}
                className="h-11 rounded-xl bg-teal-700 px-5 font-sans text-[13px] font-semibold text-white shadow-sm shadow-teal-900/20 hover:bg-teal-800 disabled:opacity-60"
              >
                {salvando ? t("alterarSenha.salvando") : t("alterarSenha.salvar")}
              </Button>
              <Link href="/app" onMouseDown={(e) => e.preventDefault()}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl border-teal-900/15 px-5 font-sans text-[13px] text-slate-700 hover:bg-teal-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {t("alterarSenha.voltar")}
                </Button>
              </Link>
            </div>
          </form>
        </section>

        <MfaConfiguracaoUsuario />
      </div>
    </div>
  );
}
