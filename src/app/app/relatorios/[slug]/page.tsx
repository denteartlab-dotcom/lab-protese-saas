"use client";

import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useI18n } from "@/components/i18n-provider";
import { labelKeyRelatorio, relatoriosNav } from "@/lib/relatorios-nav";

const SLUGS_COM_PAGINA_DEDICADA = new Set([
  "fluxo-de-caixa",
  "dre",
  "margem-contribuicao",
  "producao",
  "tempo-producao",
  "curva-abc-clientes",
  "estoque",
  "recibos-emitidos",
  "logs-auditoria",
  "dashboard-gerencial",
  "relatorio-financeiro-geral",
  "clientes-prejuizo",
  "servicos-nao-concluidos",
]);

const SLUGS_REDIRECIONAR: Record<string, string> = {
  "dashboard-comercial": "dashboard-gerencial",
};

export default function RelatorioPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    if (slug && SLUGS_REDIRECIONAR[slug]) {
      router.replace(`/app/relatorios/${SLUGS_REDIRECIONAR[slug]}`);
      return;
    }
    if (slug && SLUGS_COM_PAGINA_DEDICADA.has(slug)) {
      router.replace(`/app/relatorios/${slug}`);
    }
  }, [slug, router]);

  if (slug && (SLUGS_COM_PAGINA_DEDICADA.has(slug) || SLUGS_REDIRECIONAR[slug])) {
    return null;
  }
  const { t } = useI18n();
  const labelKey = labelKeyRelatorio(slug);
  if (!labelKey) notFound();

  const titulo = t(labelKey);

  return (
    <div className="space-y-4 text-sm text-slate-600">
      <div className="flex items-center gap-2 text-slate-500">
        <Link href="/app" className="hover:text-primary-700">
          Início
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-700">{t("nav.relatorios")}</span>
        <span>/</span>
        <span>{titulo}</span>
      </div>

      <div className="rounded border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">{titulo}</h1>
        <p className="mt-3 max-w-lg text-slate-600">{t("relatorio.emBreve")}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {relatoriosNav
            .filter((item) => item.href.startsWith("/app/relatorios/"))
            .map((item) => {
              const itemSlug = item.href.replace("/app/relatorios/", "");
              const ativo = itemSlug === slug;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    ativo
                      ? "rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white"
                      : "rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  }
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
        </div>
      </div>
    </div>
  );
}
