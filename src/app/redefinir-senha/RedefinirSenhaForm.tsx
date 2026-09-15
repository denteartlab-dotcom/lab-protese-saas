"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Eye } from "lucide-react";
import { LoginAuthShell } from "@/components/auth/LoginAuthShell";

const inputCls =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

function RedefinirSenhaInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!token) {
      setErro("Link inválido. Solicite um novo e-mail de recuperação.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/redefinir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, novaSenha, confirmarSenha }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error || "Não foi possível redefinir a senha.");
        return;
      }
      setSucesso(true);
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginAuthShell marcaTitulo="Lab Prótese" logoSrc="/logo-lab-protese.png">
      <h1 className="text-[22px] font-bold leading-tight tracking-tight text-slate-800">
        Nova senha
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Escolha uma nova senha para acessar o Lab Prótese.
      </p>

      {sucesso ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
            Senha redefinida com sucesso!
          </p>
          <Link
            href="/login"
            className="flex h-11 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Ir para o login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-600">Nova senha</label>
            <div className="relative">
              <input
                type={mostrar ? "text" : "password"}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                className={`${inputCls} pr-10`}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-600">
              Confirmar senha
            </label>
            <input
              type={mostrar ? "text" : "password"}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              className={inputCls}
              required
              disabled={loading}
            />
          </div>

          {erro && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{erro}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      )}

      {!sucesso && (
        <Link
          href="/recuperar-senha"
          className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Solicitar novo link
        </Link>
      )}
    </LoginAuthShell>
  );
}

export function RedefinirSenhaForm() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center bg-white text-sm text-slate-500">
          Carregando...
        </div>
      }
    >
      <RedefinirSenhaInner />
    </Suspense>
  );
}
