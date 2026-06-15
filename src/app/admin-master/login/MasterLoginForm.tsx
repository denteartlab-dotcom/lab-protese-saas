"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Shield } from "lucide-react";

export default function MasterLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("admin@labprotese.com");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    fetch("/api/admin-master/auth/me")
      .then((r) => {
        if (r.ok) {
          const destino = searchParams.get("redirect") || "/admin-master";
          router.replace(destino);
        }
      })
      .catch(() => undefined);
  }, [router, searchParams]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const res = await fetch("/api/admin-master/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Credenciais inválidas.");
        return;
      }
      const destino = searchParams.get("redirect") || "/admin-master";
      router.replace(destino);
      router.refresh();
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4a90d9] text-white">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800">Painel Master</h1>
          <p className="mt-1 text-sm text-slate-500">Acesso exclusivo do proprietário da plataforma</p>
        </div>

        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Senha</label>
            <div className="relative">
              <input
                type={mostrarSenha ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-slate-300"
            />
            Manter conectado
          </label>
          {erro && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{erro}</p>
          )}
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-md bg-[#4a90d9] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#3a7bc8] disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar no Painel Master"}
          </button>
        </form>
      </div>
    </div>
  );
}
