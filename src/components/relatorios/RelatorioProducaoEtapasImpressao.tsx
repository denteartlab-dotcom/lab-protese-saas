"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import {
  cabecalhoRelatorioLaboratorio,
  carregarConfigLaboratorio,
  LAB_CONFIG_ATUALIZADA_EVENT,
} from "@/lib/configuracoes-lab";
import { BadgeSituacaoOs } from "@/components/BadgeSituacaoOs";
import type { LinhaServicoEtapas } from "@/lib/relatorio-producao";
import { cn } from "@/lib/utils";

function formatarDataHoraImpressao(data: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(data.getDate())}/${pad(data.getMonth() + 1)}/${data.getFullYear()} ${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

type Props = {
  linhas: LinhaServicoEtapas[];
  dataInicio: string;
  dataFim: string;
  className?: string;
};

export function RelatorioProducaoEtapasImpressao({
  linhas,
  dataInicio,
  dataFim,
  className,
}: Props) {
  const { t } = useI18n();
  const [agora] = useState(() => new Date());
  const [configVersao, setConfigVersao] = useState(0);

  useEffect(() => {
    const atualizar = () => setConfigVersao((n) => n + 1);
    window.addEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizar);
    return () => window.removeEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizar);
  }, []);

  const lab = useMemo(
    () => cabecalhoRelatorioLaboratorio(carregarConfigLaboratorio()),
    [configVersao]
  );

  const totalEtapas = useMemo(
    () => linhas.reduce((s, linha) => s + linha.etapas.length, 0),
    [linhas]
  );

  const periodo =
    dataInicio && dataFim
      ? t("relatorio.comum.periodoAte", { inicio: dataInicio, fim: dataFim })
      : dataInicio || dataFim || "—";

  return (
    <div
      className={cn(
        "relatorio-producao-etapas-print mx-auto max-w-[210mm] bg-white px-6 py-6 text-[11px] text-[#333]",
        className
      )}
    >
      <div className="relative mb-4 border-b border-[#333] pb-3">
        <p className="absolute right-0 top-0 text-[10px] text-[#333]">
          {formatarDataHoraImpressao(agora)}
        </p>
        <div className="pt-1 text-center">
          <p className="text-[16px] font-bold leading-tight text-[#222]">{lab.nome || "—"}</p>
          {lab.endereco ? (
            <p className="mt-1 text-[11px] leading-snug text-[#333]">{lab.endereco}</p>
          ) : null}
          {lab.telefones ? (
            <p className="mt-0.5 text-[11px] text-[#333]">{lab.telefones}</p>
          ) : null}
          {lab.email ? (
            <p className="mt-0.5 text-[11px] text-[#333]">{lab.email}</p>
          ) : null}
        </div>
      </div>

      <h1 className="mb-1 text-center text-[13px] font-bold text-[#222]">
        {t("relatorio.producao.tituloEtapas")}
      </h1>
      <p className="mb-4 text-center text-[11px] text-[#333]">{periodo}</p>

      <table className="w-full border-collapse border border-[#bbb] text-[10px]">
        <thead>
          <tr className="bg-[#e8e8e8]">
            {[
              t("relatorio.comum.data"),
              t("relatorio.comum.os"),
              t("relatorio.comum.qtd"),
              t("relatorio.comum.servico"),
              t("relatorio.comum.cor"),
              t("relatorio.comum.dente"),
              t("relatorio.comum.cliente"),
              t("relatorio.comum.paciente"),
              t("relatorio.comum.situacao"),
            ].map(
              (col) => (
                <th
                  key={col}
                  className="border border-[#bbb] px-1.5 py-1.5 text-center font-bold uppercase text-[#333]"
                >
                  {col}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <Fragment key={linha.id}>
              <tr className="break-inside-avoid bg-white">
                <td className="border border-[#bbb] px-1.5 py-1 text-center">{linha.data}</td>
                <td className="border border-[#bbb] px-1.5 py-1 text-center">{linha.os}</td>
                <td className="border border-[#bbb] px-1.5 py-1 text-center">{linha.qtd}</td>
                <td className="border border-[#bbb] px-1.5 py-1 text-center">{linha.descricao}</td>
                <td className="border border-[#bbb] px-1.5 py-1 text-center">{linha.cor || ""}</td>
                <td className="border border-[#bbb] px-1.5 py-1 text-center">{linha.dente || ""}</td>
                <td className="border border-[#bbb] px-1.5 py-1 text-center">{linha.cliente}</td>
                <td className="border border-[#bbb] px-1.5 py-1 text-center">{linha.paciente}</td>
                <td className="border border-[#bbb] px-1.5 py-1 text-center">
                  <BadgeSituacaoOs status={linha.situacaoKey} />
                </td>
              </tr>
              <tr className="break-inside-avoid">
                <td colSpan={9} className="border border-[#bbb] p-0 align-top">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-[#d9edf7]">
                      {[
                        t("relatorio.comum.etapas"),
                        t("relatorio.comum.colaborador"),
                        t("relatorio.comum.inicio"),
                        t("relatorio.comum.fim"),
                        t("relatorio.comum.tempo"),
                        t("relatorio.comum.situacao"),
                      ].map(
                        (col) => (
                          <th
                            key={col}
                            className="border border-[#bbb] px-1.5 py-1 text-center font-bold text-[#333]"
                          >
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {linha.etapas.map((etapa) => (
                      <tr key={etapa.id} className="bg-white">
                        <td className="border border-[#bbb] px-1.5 py-1 text-center">
                          {etapa.etapa}
                        </td>
                        <td className="border border-[#bbb] px-1.5 py-1 text-center">
                          {etapa.colaborador}
                        </td>
                        <td className="border border-[#bbb] px-1.5 py-1 text-center">
                          {etapa.dataInicio || "-"}
                        </td>
                        <td className="border border-[#bbb] px-1.5 py-1 text-center">
                          {etapa.dataFim || "-"}
                        </td>
                        <td className="border border-[#bbb] px-1.5 py-1 text-center">
                          {etapa.tempoMinutos}
                        </td>
                        <td className="border border-[#bbb] px-1.5 py-1 text-center">
                          <BadgeSituacaoOs status={etapa.situacaoKey} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#eef6fc]">
                      <td
                        colSpan={4}
                        className="border border-[#bbb] px-1.5 py-1 text-right font-semibold text-[#4a90d9]"
                      >
                        {t("relatorio.comum.tempoTotalMinutos")}
                      </td>
                      <td className="border border-[#bbb] px-1.5 py-1 text-center font-semibold text-[#4a90d9]">
                        {linha.tempoTotalMinutos}
                      </td>
                      <td className="border border-[#bbb] bg-[#eef6fc]" />
                    </tr>
                  </tfoot>
                </table>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-[11px] font-semibold text-[#333]">
        {t("relatorio.comum.totalEtapas", { total: totalEtapas })}
      </p>
    </div>
  );
}
