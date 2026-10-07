"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  formatarMoedaComissao,
  type LinhaComissaoColaborador,
} from "@/lib/comissoes-colaboradores";

export function DetalheComissaoColaboradorModal({
  open,
  colaborador,
  linhas,
  efetivadas,
  efetivando,
  onClose,
  onEfetivar,
  onEfetivarTodas,
}: {
  open: boolean;
  colaborador: string;
  linhas: LinhaComissaoColaborador[];
  efetivadas: Set<string>;
  efetivando: boolean;
  onClose: () => void;
  onEfetivar: (linha: LinhaComissaoColaborador) => void;
  onEfetivarTodas: () => void;
}) {
  const { t } = useI18n();
  if (!open) return null;

  const total = linhas.reduce((s, l) => s + l.comissaoValor, 0);
  const totalAPagar = linhas
    .filter((l) => efetivadas.has(l.id))
    .reduce((s, l) => s + l.comissaoValor, 0);
  const pendentes = linhas.filter((l) => !efetivadas.has(l.id) && l.comissaoValor > 0);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalhe-comissao-titulo"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="detalhe-comissao-titulo" className="text-sm font-semibold text-slate-800">
              {t("producao.comum.detalhesComissao")}
            </h2>
            <p className="mt-1 text-[12px] text-slate-500">{colaborador}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={t("producao.comum.fechar")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-4 border-b border-slate-100 px-5 py-3 text-[12px]">
          <div>
            <p className="text-slate-500">{t("producao.comum.valorComissoes")}</p>
            <p className="font-semibold text-slate-800">{formatarMoedaComissao(total)}</p>
          </div>
          <div>
            <p className="text-slate-500">{t("producao.comum.aPagar")}</p>
            <p className="font-semibold text-emerald-700">{formatarMoedaComissao(totalAPagar)}</p>
          </div>
          <div className="ml-auto flex items-end">
            <button
              type="button"
              onClick={onEfetivarTodas}
              disabled={efetivando || pendentes.length === 0}
              className="rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("producao.comum.efetivarTodas")}
            </button>
          </div>
        </div>

        <div className="overflow-auto px-5 py-3">
          {linhas.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-slate-500">
              {t("producao.comum.semRegistroComissao")}
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">{t("producao.controle.tabela.os")}</th>
                  <th className="px-2 py-2">{t("producao.comum.data")}</th>
                  <th className="px-2 py-2">{t("producao.controle.tabela.servico")}</th>
                  <th className="px-2 py-2">{t("producao.comum.etapa")}</th>
                  <th className="px-2 py-2">{t("producao.modulo.situacaoEtapa")}</th>
                  <th className="px-2 py-2 text-right">{t("producao.comum.comissao")}</th>
                  <th className="px-2 py-2 text-center">{t("common.opcoes")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map((linha) => {
                  const efetivada = efetivadas.has(linha.id);
                  return (
                    <tr key={linha.id} className="hover:bg-slate-50">
                      <td className="px-2 py-2">
                        <Link
                          href={`/app/producao/os?os=${linha.numeroOs}`}
                          className="inline-flex min-w-9 items-center justify-center rounded bg-red-100 px-2 py-0.5 text-[12px] font-bold text-red-700 hover:bg-red-200"
                        >
                          {linha.numeroOs}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">{linha.dataLancamento}</td>
                      <td className="max-w-[180px] truncate px-2 py-2" title={linha.servico}>
                        {linha.servico}
                      </td>
                      <td className="px-2 py-2 text-slate-600">{linha.etapa || "—"}</td>
                      <td className="px-2 py-2 text-slate-600">{linha.situacaoEtapa}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right font-medium">
                        {formatarMoedaComissao(linha.comissaoValor)}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => onEfetivar(linha)}
                            disabled={efetivando || linha.comissaoValor <= 0}
                            title={
                              efetivada
                                ? t("producao.comum.desefetivarComissao")
                                : t("producao.comum.efetivarComissao")
                            }
                            className={`rounded-full p-1 ${
                              efetivada
                                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                : "border border-emerald-400 text-emerald-600 hover:bg-emerald-50"
                            } disabled:cursor-not-allowed disabled:opacity-40`}
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
