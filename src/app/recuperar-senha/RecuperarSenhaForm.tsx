"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";

const inputCls =
  "h-9 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

export function RecuperarSenhaForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSucesso("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recuperar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error || "Não foi possível enviar o e-mail.");
        return;
      }
      setSucesso(
        data.message ||
          "Se este e-mail estiver cadastrado, você receberá um link em breve."
      );
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
          <Mail className="h-5 w-5" />
        </div>
        <h1 className="text-base font-bold text-slate-900">Esqueceu sua senha?</h1>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase text-slate-700">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              className={inputCls}
              required
              disabled={loading || Boolean(sucesso)}
            />
          </div>

          {erro && (
            <p className="rounded bg-red-50 px-2 py-1.5 text-[10px] text-red-700">{erro}</p>
          )}
          {sucesso && (
            <p className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] text-emerald-800">
              {sucesso}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || Boolean(sucesso)}
            className="h-9 w-full rounded bg-blue-600 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Enviar link por e-mail"}
          </button>
        </form>

        <Link
          href="/login"
          className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}
