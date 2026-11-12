"use client";

import { useEffect, useRef, useState } from "react";
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

type MensagemDialogo = {
  autor: "usuario" | "ia";
  texto: string;
  plano?: PlanoHorarioOs;
};

const MENSAGEM_INICIAL =
  "Descreva o trabalho, diga se é urgência ou não e como quer o prazo. Eu devolvo a sequência de dias e horários.";

export function BotaoMelhorHorarioIa({
  contexto,
  onAplicar,
  excetoTrabalhoId,
  disabled,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [plano, setPlano] = useState<PlanoHorarioOs | null>(null);
  const [texto, setTexto] = useState("");
  const [mensagens, setMensagens] = useState<MensagemDialogo[]>([]);
  const fimDialogo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimDialogo.current?.scrollIntoView({ block: "end" });
  }, [mensagens, carregando, aberto]);

  function abrir() {
    setAberto(true);
    setPlano(null);
    setTexto("");
    setMensagens([{ autor: "ia", texto: MENSAGEM_INICIAL }]);
  }

  async function enviar() {
    const pedido = texto.trim();
    if (!pedido || carregando) return;
    setMensagens((atuais) => [...atuais, { autor: "usuario", texto: pedido }]);
    setTexto("");
    setCarregando(true);
    let avisoAgenda = "";
    let ocupacao: Record<string, number> = {};
    try {
      ocupacao = await ocupacaoDasOrdens(excetoTrabalhoId);
    } catch {
      avisoAgenda =
        "Não consegui ler as outras ordens. A sequência usa o tempo das etapas e o expediente.";
    }
    const sugestao = planejarMelhorHorarioOs({
      ...contexto,
      pedido,
      agora: new Date(),
      horario: carregarHorarioFuncionamento(),
      ocupacaoPorDia: ocupacao,
    });
    const resposta = sugestao
      ? [sugestao.resposta, avisoAgenda].filter(Boolean).join("\n\n")
      : "Não consegui montar a sequência. Confira o expediente do laboratório e descreva de novo o que precisa.";
    setPlano(sugestao);
    setMensagens((atuais) => [
      ...atuais,
      { autor: "ia", texto: resposta, plano: sugestao || undefined },
    ]);
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
        onClick={abrir}
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
                Planejamento com IA
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
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-xs text-slate-700 dark:text-slate-200">
              {mensagens.map((mensagem, index) => (
                <div
                  key={`${mensagem.autor}-${index}`}
                  className={
                    mensagem.autor === "usuario" ? "flex justify-end" : "flex justify-start"
                  }
                >
                  <div
                    className={
                      mensagem.autor === "usuario"
                        ? "max-w-[85%] whitespace-pre-line rounded-lg bg-emerald-600 px-3 py-2 text-white"
                        : "max-w-[85%] whitespace-pre-line rounded-lg bg-slate-100 px-3 py-2 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                    }
                  >
                    {mensagem.texto}
                  </div>
                </div>
              ))}
              {carregando ? (
                <p className="text-slate-500">Montando a sequência de dias e horários...</p>
              ) : null}
              <div ref={fimDialogo} />
            </div>
            <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
              <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Descreva o trabalho
              </label>
              <textarea
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void enviar();
                  }
                }}
                rows={3}
                placeholder="Ex.: acrilização caracterizada, sem urgência, começar na quinta de manhã e entregar antes de sexta."
                className="w-full resize-none rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-600 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-200"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={carregando || !texto.trim()}
                className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
              >
                Enviar
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
        </div>
      ) : null}
    </>
  );
}
