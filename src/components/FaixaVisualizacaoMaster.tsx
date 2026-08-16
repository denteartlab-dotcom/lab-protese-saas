"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, LogOut } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type Props = {
  empresaNome: string;
  expiraEm: string | null;
};

export function FaixaVisualizacaoMaster({ empresaNome, expiraEm }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [encerrando, setEncerrando] = useState(false);
  const [erro, setErro] = useState("");

  const expiraTexto = (() => {
    if (!expiraEm) return null;
    const data = new Date(expiraEm);
    if (Number.isNaN(data.getTime())) return null;
    return data.toLocaleTimeString(locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  })();

  async function encerrar() {
    if (encerrando) return;
    setEncerrando(true);
    setErro("");
    try {
      const res = await fetch("/api/admin-master/impersonacao/encerrar", {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
      };
      if (!res.ok) {
        setErro(data.error || t("admin.master.acesso.erroEncerrar"));
        setEncerrando(false);
        return;
      }
      router.replace(data.redirectTo || "/admin-master");
      router.refresh();
    } catch {
      setErro(t("admin.master.acesso.erroEncerrar"));
      setEncerrando(false);
    }
  }

  return (
    <div className="border-b border-amber-700/40 bg-amber-500 px-3 py-2 text-amber-950 shadow-sm">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 text-xs sm:text-sm">
            <p className="font-semibold leading-snug">
              {t("admin.master.acesso.faixa", { empresa: empresaNome })}
            </p>
            <p className="text-[11px] opacity-90">
              {expiraTexto
                ? t("admin.master.acesso.expiraEm", { hora: expiraTexto })
                : t("admin.master.acesso.somenteLeitura")}
              {erro ? ` — ${erro}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void encerrar()}
          disabled={encerrando}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-black disabled:opacity-60"
        >
          <LogOut className="h-3.5 w-3.5" />
          {encerrando
            ? t("admin.master.acesso.encerrando")
            : t("admin.master.acesso.voltarPainel")}
        </button>
      </div>
    </div>
  );
}
