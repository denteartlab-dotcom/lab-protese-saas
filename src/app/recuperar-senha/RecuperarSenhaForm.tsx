"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { LoginAuthShell } from "@/components/auth/LoginAuthShell";

const inputCls =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15";

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
    <LoginAuthShell marcaTitulo="Lab Prótese" logoSrc="/logo-lab-protese.png">
      <h1 className="text-[22px] font-bold leading-tight tracking-tight text-slate-800">
        Esqueceu sua senha?
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-slate-600">E-mail</label>
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
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{erro}</p>
        )}
        {sucesso && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
            {sucesso}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || Boolean(sucesso)}
          className="h-11 w-full rounded-lg bg-teal-600 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Enviando..." : "Enviar link por e-mail"}
        </button>
      </form>

      <Link
        href="/login"
        className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-teal-600 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar ao login
      </Link>
    </LoginAuthShell>
  );
}
