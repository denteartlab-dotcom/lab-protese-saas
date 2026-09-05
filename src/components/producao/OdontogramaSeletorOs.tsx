"use client";

import { useMemo, useState } from "react";
import {
  DENTES_DECIDUOS_INFERIORES,
  DENTES_DECIDUOS_SUPERIORES,
  tipoDenticaoFromNumerosDentes,
  urlImagemDente,
} from "@/lib/dentes-imagens";
import {
  DENTES_PERMANENTES_INFERIORES,
  DENTES_PERMANENTES_SUPERIORES,
} from "@/lib/dentes-os-resumo";
import { cn } from "@/lib/utils";

export type TipoDenticaoOs = "permanente" | "deciduos";

type Props = {
  value: string;
  onChange: (resumo: string) => void;
  className?: string;
  titulo?: string;
  labelSelecionados?: string;
  labelNenhum?: string;
  labelPermanente?: string;
  labelDeciduos?: string;
};

function listasDenticao(tipo: TipoDenticaoOs) {
  return tipo === "deciduos"
    ? {
        superiores: [...DENTES_DECIDUOS_SUPERIORES],
        inferiores: [...DENTES_DECIDUOS_INFERIORES],
      }
    : {
        superiores: [...DENTES_PERMANENTES_SUPERIORES],
        inferiores: [...DENTES_PERMANENTES_INFERIORES],
      };
}

function dentesFromResumo(resumo: string, tipo: TipoDenticaoOs) {
  const { superiores, inferiores } = listasDenticao(tipo);
  const partes = resumo
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);
  return Array.from(
    new Set(
      partes.flatMap((parte) => {
        if (parte === "SUP") return superiores;
        if (parte === "INF") return inferiores;
        return /^\d+$/.test(parte) ? [parte] : [];
      })
    )
  );
}

function resumoFromDentes(dentes: string[], tipo: TipoDenticaoOs) {
  const { superiores, inferiores } = listasDenticao(tipo);
  const todosSuperiores = superiores.every((dente) => dentes.includes(dente));
  const todosInferiores = inferiores.every((dente) => dentes.includes(dente));
  const superioresExtras = dentes.filter((dente) => !superiores.includes(dente));
  const inferioresExtras = dentes.filter((dente) => !inferiores.includes(dente));
  const partes = [
    todosSuperiores ? "SUP" : "",
    todosInferiores ? "INF" : "",
    ...(!todosSuperiores ? dentes.filter((dente) => superiores.includes(dente)) : []),
    ...(!todosInferiores ? dentes.filter((dente) => inferiores.includes(dente)) : []),
  ].filter(Boolean);

  if (todosSuperiores && todosInferiores) return "SUP, INF";
  if (todosSuperiores && superioresExtras.length === inferiores.length) return "SUP, INF";
  if (todosInferiores && inferioresExtras.length === superiores.length) return "SUP, INF";
  return partes.length ? partes.join(", ") : "";
}

function BadgesDentesSelecionados({
  resumo,
  labelNenhum,
}: {
  resumo: string;
  labelNenhum: string;
}) {
  if (!resumo.trim()) {
    return <span className="font-normal text-slate-600">{labelNenhum}</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {resumo.split(", ").map((parte) =>
        parte === "SUP" || parte === "INF" ? (
          <span
            key={parte}
            className="rounded bg-emerald-500 px-2 py-1 text-[11px] font-bold text-white"
          >
            {parte}
          </span>
        ) : (
          <span
            key={parte}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-emerald-500 px-1.5 text-[10px] font-bold text-white"
          >
            {parte}
          </span>
        )
      )}
    </span>
  );
}

export function OdontogramaSeletorOs({
  value,
  onChange,
  className,
  titulo = "Selecione os dentes do trabalho",
  labelSelecionados = "Dentes Selecionados:",
  labelNenhum = "Nenhum dente selecionado",
  labelPermanente = "Permanente",
  labelDeciduos = "Decíduos",
}: Props) {
  const [tipoDenticao, setTipoDenticao] = useState<TipoDenticaoOs>(() => {
    const numeros = dentesFromResumo(value, "permanente");
    return tipoDenticaoFromNumerosDentes(numeros);
  });
  const [selecionados, setSelecionados] = useState<string[]>(() => {
    const tipo = tipoDenticaoFromNumerosDentes(dentesFromResumo(value, "permanente"));
    return dentesFromResumo(value, tipo);
  });

  const listas = useMemo(() => listasDenticao(tipoDenticao), [tipoDenticao]);

  function aplicar(dentes: string[], tipo: TipoDenticaoOs = tipoDenticao) {
    const resumo = resumoFromDentes(dentes, tipo);
    setSelecionados(dentes);
    onChange(resumo);
  }

  function toggleDente(dente: string) {
    const prox = selecionados.includes(dente)
      ? selecionados.filter((d) => d !== dente)
      : [...selecionados, dente];
    aplicar(prox);
  }

  function selecionarArcada(arcada: "sup" | "inf") {
    const linha = arcada === "sup" ? listas.superiores : listas.inferiores;
    const todosSelecionados = linha.every((dente) => selecionados.includes(dente));
    const prox = todosSelecionados
      ? selecionados.filter((dente) => !linha.includes(dente))
      : Array.from(new Set([...selecionados, ...linha]));
    aplicar(prox);
  }

  function trocarTipo(tipo: TipoDenticaoOs) {
    setTipoDenticao(tipo);
    aplicar([], tipo);
  }

  return (
    <div className={cn("text-center", className)}>
      <div className="mb-2 text-[11px] text-slate-500">{titulo}</div>
      <div className="mb-3 flex justify-center gap-5 text-[11px] text-slate-600">
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="radio"
            name="tipoDenticaoOdontograma"
            checked={tipoDenticao === "permanente"}
            onChange={() => trocarTipo("permanente")}
            className="h-3.5 w-3.5 accent-blue-500"
          />
          {labelPermanente}
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="radio"
            name="tipoDenticaoOdontograma"
            checked={tipoDenticao === "deciduos"}
            onChange={() => trocarTipo("deciduos")}
            className="h-3.5 w-3.5 accent-blue-500"
          />
          {labelDeciduos}
        </label>
      </div>

      <div className="mx-auto max-w-3xl rounded bg-white px-3 py-2">
        <div className="flex items-end justify-center gap-2">
          <button
            type="button"
            onClick={() => selecionarArcada("sup")}
            className="mb-1 rounded bg-slate-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-primary-600"
          >
            SUP
          </button>
          <div className="flex flex-wrap justify-center gap-0.5 border-b border-dashed border-slate-300 pb-1">
            {listas.superiores.map((dente) => {
              const selected = selecionados.includes(dente);
              return (
                <button
                  key={dente}
                  type="button"
                  onClick={() => toggleDente(dente)}
                  className={cn(
                    "group flex w-7 flex-col items-center gap-0.5 rounded px-0.5 py-1 transition",
                    selected
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <img
                    src={urlImagemDente(dente, tipoDenticao)}
                    alt={`Dente ${dente}`}
                    className={cn(
                      "h-8 w-5 object-contain transition",
                      selected
                        ? "opacity-100 drop-shadow-[0_0_7px_rgba(16,185,129,0.85)] sepia saturate-200 hue-rotate-75"
                        : "opacity-45 grayscale group-hover:opacity-80"
                    )}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                  <span
                    className={cn(
                      "text-[11px] leading-none",
                      selected ? "font-bold text-emerald-600" : "text-slate-500"
                    )}
                  >
                    {dente}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-start justify-center gap-2">
          <button
            type="button"
            onClick={() => selecionarArcada("inf")}
            className="mt-1 rounded bg-slate-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-primary-600"
          >
            INF
          </button>
          <div className="flex flex-wrap justify-center gap-0.5 pt-1">
            {listas.inferiores.map((dente) => {
              const selected = selecionados.includes(dente);
              return (
                <button
                  key={dente}
                  type="button"
                  onClick={() => toggleDente(dente)}
                  className={cn(
                    "group flex w-7 flex-col items-center gap-0.5 rounded px-0.5 py-1 transition",
                    selected
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <img
                    src={urlImagemDente(dente, tipoDenticao)}
                    alt={`Dente ${dente}`}
                    className={cn(
                      "order-2 h-8 w-5 object-contain transition",
                      selected
                        ? "opacity-100 drop-shadow-[0_0_7px_rgba(16,185,129,0.85)] sepia saturate-200 hue-rotate-75"
                        : "opacity-45 grayscale group-hover:opacity-80"
                    )}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                  <span
                    className={cn(
                      "text-[11px] leading-none",
                      selected ? "font-bold text-emerald-600" : "text-slate-500"
                    )}
                  >
                    {dente}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 text-left text-[11px] font-semibold text-emerald-600">
        {labelSelecionados}{" "}
        <BadgesDentesSelecionados resumo={value} labelNenhum={labelNenhum} />
      </div>
    </div>
  );
}
