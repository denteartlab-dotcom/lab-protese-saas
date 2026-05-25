"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  caixaDeInstrucoes,
  formatDiaMesBr,
  prazoTrabalho,
  type TipoPrazoProducao,
} from "@/lib/controle-producao-prazos";
import { hrefControleServico } from "@/lib/notificacao-links";
import { STATUS_TRABALHO } from "@/lib/utils";

export type TrabalhoPainelServicos = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  status: string;
  dataEntrada: string;
  dataPrevista: string | null;
  instrucoes?: string | null;
  paciente: { nome: string };
};

type Props = {
  titulo: string;
  valor: number;
  tom: "warning" | "danger";
  filtros: React.ReactNode;
  trabalhos: TrabalhoPainelServicos[];
  tipoPrazo: TipoPrazoProducao;
  expandido: boolean;
  onToggleExpandir: () => void;
  labelVisualizar: string;
  labelImprimir: string;
  linkImprimir: string;
  periodoDia?: string;
};

type CampoOrdenacao = "os" | "data";
type DirecaoOrdenacao = "asc" | "desc";

function ordenarTrabalhosPainel(
  lista: TrabalhoPainelServicos[],
  campo: CampoOrdenacao,
  direcao: DirecaoOrdenacao,
  tipoPrazo: TipoPrazoProducao
) {
  const copia = [...lista];
  copia.sort((a, b) => {
    let diff = 0;
    if (campo === "os") {
      diff = a.numeroOs - b.numeroOs;
    } else {
      const pa = prazoTrabalho(a, tipoPrazo)?.getTime() ?? 0;
      const pb = prazoTrabalho(b, tipoPrazo)?.getTime() ?? 0;
      diff = pa - pb;
    }
    return direcao === "desc" ? -diff : diff;
  });
  return copia;
}

export function PainelServicosDashboard({
  titulo,
  valor,
  tom,
  filtros,
  trabalhos,
  tipoPrazo,
  expandido,
  onToggleExpandir,
  labelVisualizar,
  labelImprimir,
  linkImprimir,
}: Props) {
  const outline =
    tom === "warning"
      ? "border-amber-400 text-amber-600 hover:bg-amber-50"
      : "border-red-400 text-red-600 hover:bg-red-50";
  const solid =
    tom === "warning"
      ? "border-amber-500 bg-amber-500 text-white hover:bg-amber-600"
      : "border-red-500 bg-red-500 text-white hover:bg-red-600";
  const badgeOs =
    tom === "warning"
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-700";

  const [ordenacao, setOrdenacao] = useState<{
    campo: CampoOrdenacao;
    direcao: DirecaoOrdenacao;
  }>({ campo: "os", direcao: "desc" });

  const ordenados = useMemo(
    () => ordenarTrabalhosPainel(trabalhos, ordenacao.campo, ordenacao.direcao, tipoPrazo),
    [trabalhos, ordenacao, tipoPrazo]
  );

  function alternarOrdenacao(campo: CampoOrdenacao) {
    setOrdenacao((atual) =>
      atual.campo === campo
        ? { campo, direcao: atual.direcao === "desc" ? "asc" : "desc" }
        : { campo, direcao: "desc" }
    );
  }

  return (
    <div
      className={`relative rounded border border-slate-200 bg-white shadow-sm ${
        expandido ? "min-h-[360px]" : "min-h-[118px]"
      }`}
    >
      <div className="px-4 pb-3 pt-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-medium text-slate-700">{titulo}</p>
          <div className="flex shrink-0 items-center gap-1.5">{filtros}</div>
        </div>
        <p className="mt-2 text-[42px] font-semibold leading-none text-slate-800">{valor}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onToggleExpandir}
            className={`rounded border px-3 py-1 text-[11px] font-medium ${outline} ${
              expandido ? "ring-1 ring-offset-1" : ""
            } ${tom === "warning" ? (expandido ? "ring-amber-300" : "") : expandido ? "ring-red-300" : ""}`}
          >
            {labelVisualizar}
          </button>
          <Link
            href={linkImprimir}
            className={`rounded border px-3 py-1 text-[11px] font-medium ${solid}`}
          >
            {labelImprimir}
          </Link>
        </div>
      </div>

      {expandido && (
        <div className="border-t border-slate-100 px-3 pb-3">
          <div className="mb-1 flex justify-end gap-3 pr-1 pt-2 text-[10px]">
            <BotaoOrdenacao
              label="OS"
              ativo={ordenacao.campo === "os"}
              direcao={ordenacao.direcao}
              onClick={() => alternarOrdenacao("os")}
            />
            <BotaoOrdenacao
              label="Data"
              ativo={ordenacao.campo === "data"}
              direcao={ordenacao.direcao}
              onClick={() => alternarOrdenacao("data")}
            />
          </div>
          <div className="max-h-[min(42vh,300px)] overflow-y-auto">
            {ordenados.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-slate-400">Nenhum serviço neste filtro.</p>
            ) : (
              <ul>
                {ordenados.map((trabalho) => (
                  <li key={trabalho.id} className="border-b border-slate-100 last:border-0">
                    <Link
                      href={hrefControleServico(
                        trabalho.id,
                        tom === "warning" ? "vencendo" : "atrasados",
                        { prazo: tipoPrazo }
                      )}
                      className="grid grid-cols-[52px_1fr] gap-3 py-2.5 transition hover:bg-slate-50/80"
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded text-[13px] font-bold ${badgeOs}`}
                      >
                        {trabalho.numeroOs}
                      </span>
                      <div className="min-w-0 text-[11px] leading-snug text-slate-600">
                        <p className="font-semibold text-slate-700">
                          {[
                            dataPrazoExibicao(trabalho, tipoPrazo),
                            caixaDeInstrucoes(trabalho.instrucoes)
                              ? `Caixa: ${caixaDeInstrucoes(trabalho.instrucoes)}`
                              : "Caixa:",
                            STATUS_TRABALHO[trabalho.status]?.label || trabalho.status,
                          ].join(" | ")}
                        </p>
                        <p className="mt-0.5 truncate">
                          {trabalho.tipoProtese} | Paciente: {trabalho.paciente?.nome || "—"}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BotaoOrdenacao({
  label,
  ativo,
  direcao,
  onClick,
}: {
  label: string;
  ativo: boolean;
  direcao: DirecaoOrdenacao;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-0.5 transition hover:text-slate-600 ${
        ativo ? "font-medium text-slate-500" : "text-slate-400"
      }`}
      title={direcao === "desc" ? "Maior primeiro (clique para inverter)" : "Menor primeiro (clique para inverter)"}
    >
      {label}
      {ativo ? (direcao === "desc" ? " ↓" : " ↑") : ""}
    </button>
  );
}

function dataPrazoExibicao(trabalho: TrabalhoPainelServicos, tipo: TipoPrazoProducao) {
  const prazo = prazoTrabalho(trabalho, tipo);
  if (prazo) return formatDiaMesBr(prazo);
  if (trabalho.dataPrevista) {
    return formatDiaMesBr(new Date(trabalho.dataPrevista));
  }
  return "—";
}
