"use client";

import { useState } from "react";
import { parseEtapasInstrucoes } from "@/lib/etapas-os";
import { dateToBrShort } from "@/lib/datas-br";
import { carregarHorarioFuncionamento } from "@/lib/horario-funcionamento";
import {
  planejarMelhorHorarioOs,
  type EntradaPlanoHorarioOs,
  type PlanoHorarioOs,
} from "@/lib/ia-melhor-horario-os";

const STATUS_FORA_DA_AGENDA = new Set([
  "finalizado",
  "entregue",
  "entregue_cliente",
  "cancelado",
]);

type Props = {
  contexto: Omit<EntradaPlanoHorarioOs, "horario" | "ocupacaoPorDia" | "agora">;
  onAplicar: (plano: PlanoHorarioOs) => void;
  excetoTrabalhoId?: string;
  disabled?: boolean;
};

function dataPrevistaBr(valor?: string | Date | null) {
  if (!valor) return "";
  if (valor instanceof Date) return dateToBrShort(valor);
  const texto = String(valor);
  const civil = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (civil && !texto.includes("T")) return `${civil[3]}/${civil[2]}/${civil[1]}`;
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return "";
  return dateToBrShort(data);
}

async function ocupacaoDasOrdens(excetoId?: string) {
  const resposta = await fetch("/api/trabalhos");
  if (!resposta.ok) throw new Error("agenda");
  const lista = (await resposta.json()) as Array<{
    id?: string;
    status?: string;
    dataPrevista?: string | null;
    instrucoes?: string | null;
  }>;
  const mapa: Record<string, number> = {};
  for (const trabalho of Array.isArray(lista) ? lista : []) {
    if (excetoId && trabalho.id === excetoId) continue;
    if (STATUS_FORA_DA_AGENDA.has((trabalho.status || "").toLowerCase())) continue;
    const datas = new Set<string>();
    const prevista = dataPrevistaBr(trabalho.dataPrevista);
    if (prevista) datas.add(prevista);
    for (const etapa of parseEtapasInstrucoes(trabalho.instrucoes)) {
      const data = etapa.prazo.match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
      if (data) datas.add(data);
    }
    for (const data of datas) mapa[data] = (mapa[data] || 0) + 1;
  }
  return mapa;
}

export function BotaoMelhorHorarioIa({
  contexto,
  onAplicar,
  excetoTrabalhoId,
  disabled,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [plano, setPlano] = useState<PlanoHorarioOs | null>(null);
  const [avisoAgenda, setAvisoAgenda] = useState("");

  async function buscar() {
    setAberto(true);
    setCarregando(true);
    setPlano(null);
    setAvisoAgenda("");
    let ocupacao: Record<string, number> = {};
    try {
      ocupacao = await ocupacaoDasOrdens(excetoTrabalhoId);
    } catch {
      setAvisoAgenda(
        "Não foi possível ler as outras ordens. A sugestão usa só o tempo das etapas e o expediente."
      );
    }
    const sugestao = planejarMelhorHorarioOs({
      ...contexto,
      agora: new Date(),
      horario: carregarHorarioFuncionamento(),
      ocupacaoPorDia: ocupacao,
    });
    setPlano(sugestao);
    setCarregando(false);
  }

  function aplicar() {
    if (!plano) return;
    onAplicar(plano);
    setAberto(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void buscar()}
        disabled={disabled}
        className="rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Buscar melhor data e horário com IA
      </button>
      {aberto ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Melhor data e horário
              </h2>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="text-lg text-slate-400 hover:text-slate-700"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 text-xs text-slate-700 dark:text-slate-200">
              {carregando ? <p>Lendo as etapas, o expediente e a agenda do laboratório...</p> : null}
              {!carregando && !plano ? (
                <p>Selecione um serviço com etapas para montar o cronograma.</p>
              ) : null}
              {plano ? (
                <>
                  <p className="leading-relaxed">{plano.descricao}</p>
                  <p
                    className={
                      plano.urgente
                        ? "inline-flex rounded bg-red-600 px-2 py-1 font-semibold text-white"
                        : "inline-flex rounded bg-slate-200 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                    }
                  >
                    {plano.urgente ? "Urgência" : "Sem urgência"} — {plano.motivoUrgencia}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded border border-slate-200 p-2 dark:border-slate-700">
                      <div className="text-[10px] uppercase text-slate-500">Começar</div>
                      <div className="font-semibold">
                        {plano.inicioData} {plano.inicioHora}
                      </div>
                    </div>
                    <div className="rounded border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-900 dark:bg-emerald-950/40">
                      <div className="text-[10px] uppercase text-emerald-700 dark:text-emerald-300">
                        Prazo laboratório
                      </div>
                      <div className="font-semibold">
                        {plano.prazoLaboratorio.data} {plano.prazoLaboratorio.hora}
                      </div>
                    </div>
                    <div className="rounded border border-slate-200 p-2 dark:border-slate-700">
                      <div className="text-[10px] uppercase text-slate-500">Prazo dentista</div>
                      <div className="font-semibold">
                        {plano.prazoDentista.data
                          ? `${plano.prazoDentista.data} ${plano.prazoDentista.hora}`
                          : "A tabela não tem dias antes do laboratório"}
                      </div>
                    </div>
                  </div>
                  <p>{plano.cargaDia}</p>
                  {avisoAgenda ? <p className="text-amber-700">{avisoAgenda}</p> : null}
                  <div>
                    <h3 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">
                      Como fazer, etapa por etapa
                    </h3>
                    <ol className="space-y-2">
                      {plano.etapas.map((etapa, index) => (
                        <li
                          key={`${etapa.nome}-${index}`}
                          className="rounded border border-slate-200 p-2 dark:border-slate-700"
                        >
                          <div className="font-semibold">
                            {index + 1}. {etapa.nome}
                            <span className="ml-2 font-normal text-slate-500">{etapa.setor}</span>
                          </div>
                          <div>
                            {etapa.tempoTexto} · {etapa.inicioData} {etapa.inicioHora} até{" "}
                            {etapa.data} {etapa.hora}
                          </div>
                          <p className="mt-1 text-slate-600 dark:text-slate-300">{etapa.ideia}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <ul className="list-disc space-y-1 pl-4">
                    {plano.ideias.map((ideia) => (
                      <li key={ideia}>{ideia}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-200"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={aplicar}
                disabled={!plano}
                className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Aplicar estas datas
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
