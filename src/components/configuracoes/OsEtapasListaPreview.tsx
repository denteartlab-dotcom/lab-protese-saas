"use client";

import { useI18n } from "@/components/i18n-provider";
import {
  formatarDataHoraEtapaImpressao,
  nomeEtapaSemSetor,
  type EtapaOsLinha,
} from "@/lib/etapas-os";

export function OsEtapasListaPreview({
  etapas,
  dataEntrada = "",
  fontSize = 11,
  gapMm = "1.5mm",
  marginTop,
  exibirDatas = true,
  tituloServico,
}: {
  etapas: EtapaOsLinha[];
  colaboradores?: unknown;
  dataEntrada?: string;
  fontSize?: number;
  gapMm?: string;
  marginTop?: string;
  exibirColaborador?: boolean;
  exibirDatas?: boolean;
  tituloServico?: string;
}) {
  const { t } = useI18n();
  const lista = etapas.filter((e) => nomeEtapaSemSetor(e.nome));
  if (lista.length === 0) return null;

  const rotulo = tituloServico
    ? t("print.os.etapasServico", { servico: tituloServico })
    : `${t("print.os.etapas")}:`;

  return (
    <div
      style={{
        fontSize: `${fontSize}px`,
        ...(marginTop ? { marginTop } : undefined),
      }}
    >
      <p>{rotulo}</p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: gapMm,
          marginTop: "1mm",
        }}
      >
        {lista.map((etapa) => {
          const nome = nomeEtapaSemSetor(etapa.nome);
          const dataHora = exibirDatas
            ? formatarDataHoraEtapaImpressao(etapa.prazo, dataEntrada)
            : "";
          return (
            <div
              key={`${etapa.indice}-${nome}`}
              className="inline-flex max-w-full items-start gap-2 leading-snug"
            >
              <span
                className="mt-0.5 inline-block shrink-0 border border-slate-900"
                style={{ width: "3mm", height: "3mm" }}
                aria-hidden
              />
              <span className="whitespace-normal">
                {dataHora ? <>{dataHora} </> : null}
                <span className="font-bold">{nome}</span>
                {etapa.observacao?.trim() ? (
                  <span> {etapa.observacao.trim()}</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
