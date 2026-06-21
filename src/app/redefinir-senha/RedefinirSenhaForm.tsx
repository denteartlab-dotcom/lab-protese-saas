"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Eye, LockKeyhole } from "lucide-react";

const inputCls =
  "h-9 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

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
    <div className="login-hero relative flex flex-1 items-center justify-center overflow-hidden bg-[#0a2f6e] px-4">
      <img
        src="/images/login-background.png"
        alt=""
        fetchPriority="high"
        decoding="async"
        className="login-hero__bg pointer-events-none select-none"
      />
      <div className="relative z-10 w-full max-w-[340px] rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <h1 className="text-base font-bold text-slate-900">Nova senha</h1>
        <p className="mt-1 text-[11px] text-slate-500">
          Escolha uma nova senha para acessar o Lab Prótese.
        </p>

        {sucesso ? (
          <div className="mt-4 space-y-3">
            <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
              Senha redefinida com sucesso!
            </p>
            <Link
              href="/login"
              className="flex h-9 w-full items-center justify-center rounded bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Ir para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-medium uppercase text-slate-700">
                Nova senha
              </label>
              <div className="relative">
                <input
                  type={mostrar ? "text" : "password"}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  className={`${inputCls} pr-8`}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setMostrar((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium uppercase text-slate-700">
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
              <p className="rounded bg-red-50 px-2 py-1.5 text-[10px] text-red-700">{erro}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-9 w-full rounded bg-blue-600 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}

        {!sucesso && (
          <Link
            href="/recuperar-senha"
            className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Solicitar novo link
          </Link>
        )}
      </div>
    </div>
  );
}

export function RedefinirSenhaForm() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center bg-[#0a2f6e] text-sm text-white">
          Carregando...
        </div>
      }
    >
      <RedefinirSenhaInner />
    </Suspense>
  );
}
