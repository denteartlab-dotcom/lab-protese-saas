"use client";

import {
  colaboradorDaEtapaImpressao,
  formatarDataHoraEtapaImpressao,
  nomeEtapaSemSetor,
  type ColaboradorOsLinha,
  type EtapaOsLinha,
} from "@/lib/etapas-os";

export function OsEtapasListaPreview({
  etapas,
  colaboradores = [],
  dataEntrada = "",
  fontSize = 11,
  gapMm = "1.5mm",
  marginTop,
  exibirColaborador = true,
}: {
  etapas: EtapaOsLinha[];
  colaboradores?: ColaboradorOsLinha[];
  dataEntrada?: string;
  fontSize?: number;
  gapMm?: string;
  marginTop?: string;
  exibirColaborador?: boolean;
}) {
  const lista = etapas.filter((e) => nomeEtapaSemSetor(e.nome));
  if (lista.length === 0) return null;

  return (
    <div
      style={{
        fontSize: `${fontSize}px`,
        ...(marginTop ? { marginTop } : undefined),
      }}
    >
      <p>Etapas:</p>
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
          const dataHora = formatarDataHoraEtapaImpressao(etapa.prazo, dataEntrada);
          const colaborador = exibirColaborador
            ? colaboradorDaEtapaImpressao(etapa, colaboradores)
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
                {colaborador ? <span className="font-bold">{colaborador} </span> : null}
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
