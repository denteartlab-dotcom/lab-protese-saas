"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, Home, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import { MfaConfiguracaoUsuario } from "@/components/auth/MfaConfiguracaoUsuario";

const INPUT_CLS =
  "h-[38px] w-full rounded-sm border border-[#d1d5db] bg-white px-3 text-[13px] text-[#374151] outline-none transition focus:border-[#4a90d9] focus:ring-2 focus:ring-[#4a90d9]/15";

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
    <div className="space-y-1">
      <label htmlFor={id} className="text-[11px] font-normal text-[#6b7280]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={mostrar ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`${INPUT_CLS} pr-10`}
          required
          minLength={minLength}
        />
        <button
          type="button"
          onClick={onToggleMostrar}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#9ca3af] hover:text-[#6b7280]"
          aria-label={mostrar ? ariaOcultar : ariaMostrar}
        >
          <Eye className="h-4 w-4" />
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
    <div className="bg-[#f3f4f6] pb-8 pt-1 text-[12px] text-[#374151]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-normal leading-none text-[#6b7280]">
          {t("alterarSenha.titulo")}
        </h1>
        <div className="flex items-center gap-1.5 text-[12px] text-[#9ca3af]">
          <Home className="h-3.5 w-3.5 shrink-0" />
          <Link href="/app" className="hover:text-[#4a90d9]">
            Início
          </Link>
          <span className="text-[#d1d5db]">/</span>
          <span className="text-[#6b7280]">{t("alterarSenha.titulo")}</span>
        </div>
      </div>

      <div className="mx-auto max-w-md">
        <div className="overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm">
          <div className="border-b border-[#e5e7eb] px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef2ff] text-[#4a90d9]">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[#374151]">
                  {t("alterarSenha.titulo")}
                </h2>
                <p className="text-[11px] text-[#9ca3af]">{t("alterarSenha.subtitulo")}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
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

            <p className="text-[10px] text-[#9ca3af]">{t("alterarSenha.dicaMinimo")}</p>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="submit"
                disabled={salvando}
                className="h-[38px] rounded-sm bg-[#4a90d9] px-5 text-[13px] font-semibold text-white hover:bg-[#3d7fc4] disabled:opacity-60"
              >
                {salvando ? t("alterarSenha.salvando") : t("alterarSenha.salvar")}
              </Button>
              <Link href="/app">
                <Button
                  type="button"
                  variant="outline"
                  className="h-[38px] rounded-sm border-[#d1d5db] px-5 text-[13px]"
                >
                  {t("alterarSenha.voltar")}
                </Button>
              </Link>
            </div>
          </form>
        </div>

        <MfaConfiguracaoUsuario />
      </div>
    </div>
  );
}
