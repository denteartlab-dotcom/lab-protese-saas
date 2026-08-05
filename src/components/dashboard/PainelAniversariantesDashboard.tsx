"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Cake, Search } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { AniversarianteMesItem } from "@/lib/dashboard-clientes-servico";
import { nomesMesesLocale } from "@/lib/i18n/meses-locale";
import { linkWhatsappWeb } from "@/lib/mensagem-aniversario";
import { telefoneParaEnvioWhatsapp } from "@/lib/whatsapp-disparos/telefone-br";

function telefoneAniversariante(c: AniversarianteMesItem) {
  return (
    telefoneParaEnvioWhatsapp(c.whatsapp) ||
    telefoneParaEnvioWhatsapp(c.celular) ||
    telefoneParaEnvioWhatsapp(c.telefone)
  );
}

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
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [erroLinha, setErroLinha] = useState("");

  const aniversariantesHoje = useMemo(() => {
    const diaHoje = new Date().getDate();
    return lista.filter((c) => c.aniversarioHoje === true || c.dia === diaHoje);
  }, [lista]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return aniversariantesHoje;
    return aniversariantesHoje.filter((c) => c.nome.toLowerCase().includes(q));
  }, [aniversariantesHoje, busca]);

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
      <body><h1>${titulo} — ${t("dashboard.hoje")}</h1><table><thead><tr><th>${t("dashboard.cliente")}</th><th>${t("dashboard.data")}</th><th>Dia</th></tr></thead><tbody>${linhas || `<tr><td colspan=3>${t("dashboard.nenhumAniversarianteHoje")}</td></tr>`}</tbody></table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  async function abrirWhatsappFelicitacoes(c: AniversarianteMesItem) {
    setErroLinha("");
    const telefone = telefoneAniversariante(c);
    if (!telefone) {
      setErroLinha(t("dashboard.aniversarianteSemWhatsapp"));
      return;
    }

    setEnviandoId(c.id);
    try {
      const res = await fetch("/api/dashboard/aniversariantes/mensagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId: c.id, nomeCliente: c.nome }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.mensagem) {
        setErroLinha(data.error || t("dashboard.erroMensagemAniversario"));
        return;
      }

      const url = linkWhatsappWeb(telefone, String(data.mensagem));
      if (!url) {
        setErroLinha(t("dashboard.aniversarianteSemWhatsapp"));
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setErroLinha(t("dashboard.erroMensagemAniversario"));
    } finally {
      setEnviandoId(null);
    }
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
                  {t("dashboard.nenhumAniversarianteHoje")}
                </p>
              ) : (
                filtrados.slice(0, 6).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={enviandoId === c.id}
                    onClick={() => void abrirWhatsappFelicitacoes(c)}
                    title={t("dashboard.cliqueWhatsappAniversario")}
                    className="flex w-full items-center justify-between rounded px-1 py-0.5 text-left hover:bg-emerald-50 disabled:opacity-60"
                  >
                    <span className="truncate text-[12px] font-medium text-slate-700">
                      {enviandoId === c.id
                        ? t("dashboard.gerandoMensagemAniversario")
                        : c.nome}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {c.dataNascimento}
                    </span>
                  </button>
                ))
              )}
            </div>
            {erroLinha ? (
              <p className="mt-2 text-[11px] text-rose-600">{erroLinha}</p>
            ) : null}
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
