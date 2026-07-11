"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Cake, Search } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { AniversarianteMesItem } from "@/lib/dashboard-clientes-servico";
import { nomesMesesLocale } from "@/lib/i18n/meses-locale";

export function PainelAniversariantesDashboard({
  titulo,
  lista,
  mes,
}: {
  titulo: string;
  lista: AniversarianteMesItem[];
  mes: number;
}) {
  const { t, locale } = useI18n();
  const meses = nomesMesesLocale(locale);
  const [busca, setBusca] = useState("");
  const [mostrarBusca, setMostrarBusca] = useState(false);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((c) => c.nome.toLowerCase().includes(q));
  }, [lista, busca]);

  function imprimirPdf() {
    const tituloMes = meses[mes] || "";
    const linhas = filtrados
      .map(
        (c) =>
          `<tr><td>${c.nome}</td><td>${c.dataNascimento}</td><td>Dia ${c.dia}</td></tr>`
      )
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${titulo} ${tituloMes}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f5f5f5}</style></head>
      <body><h1>${titulo} — ${tituloMes}</h1><table><thead><tr><th>${t("dashboard.cliente")}</th><th>${t("dashboard.data")}</th><th>Dia</th></tr></thead><tbody>${linhas || `<tr><td colspan=3>${t("dashboard.nenhumAniversarianteMes", { mes: tituloMes })}</td></tr>`}</tbody></table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <section className="rounded border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-10 items-center justify-between border-b border-slate-100 px-4 py-2">
        <h2 className="text-sm font-medium text-slate-700">{titulo}</h2>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">{t("dashboard.envieMensagemEspecial")}</p>
            {mostrarBusca && (
              <div className="relative mt-2">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full rounded border border-slate-200 py-1.5 pl-7 pr-2 text-[11px]"
                  placeholder={t("dashboard.pesquisarCliente")}
                  autoFocus
                />
              </div>
            )}
            <div className="mt-3 max-h-28 space-y-1.5 overflow-y-auto">
              {filtrados.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  {t("dashboard.nenhumAniversarianteMes", { mes: meses[mes] || "" })}
                </p>
              ) : (
                filtrados.slice(0, 6).map((c) => (
                  <Link
                    key={c.id}
                    href={`/app/clientes`}
                    className="flex items-center justify-between rounded px-1 py-0.5 hover:bg-slate-50"
                  >
                    <span className="truncate text-[12px] font-medium text-slate-700">
                      {c.nome}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {c.dataNascimento}
                    </span>
                  </Link>
                ))
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/app/clientes"
                className="inline-flex h-7 items-center rounded bg-sky-500 px-3 text-[11px] font-medium text-white hover:bg-sky-600"
              >
                {t("dashboard.verMais")}
              </Link>
              <button
                type="button"
                onClick={() => setMostrarBusca((v) => !v)}
                className="inline-flex h-7 items-center rounded border border-slate-200 bg-white px-3 text-[11px] text-slate-600 hover:bg-slate-50"
              >
                {t("dashboard.pesquisa")}
              </button>
              <button
                type="button"
                onClick={imprimirPdf}
                className="inline-flex h-7 items-center rounded border border-slate-200 bg-white px-3 text-[11px] text-slate-600 hover:bg-slate-50"
              >
                PDF
              </button>
            </div>
          </div>
          <Cake className="h-14 w-14 shrink-0 text-amber-300" />
        </div>
      </div>
    </section>
  );
}
