"use client";

import { useState } from "react";
import {
  Calendar,
  Clock,
  Copy,
  Plus,
  Save,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import type { TipoMensagemForm } from "@/components/DadosLaboratorioForm";
import {
  criarIntervalo,
  type DiaFuncionamento,
  type FeriadoLab,
  type HorarioFuncionamentoConfig,
  type IntervaloDia,
} from "@/lib/horario-funcionamento";

type Props = {
  config: HorarioFuncionamentoConfig;
  onChange: (config: HorarioFuncionamentoConfig) => void;
  onMensagem?: (texto: string, tipo?: TipoMensagemForm) => void;
  onGravar?: () => void;
  salvando?: boolean;
  gravarLabel?: string;
  /** z-index dos modais internos (intervalos, feriados). */
  modalLayerClass?: string;
};

const thClass =
  "border-b border-slate-200 bg-[#f5f6f8] px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500";
const tdClass = "border-b border-slate-100 px-3 py-2 align-middle";

const btnIntervaloClass =
  "inline-flex h-[30px] items-center gap-1.5 rounded-[3px] border border-[#5b9bd5] bg-white px-3 text-[12px] font-normal leading-none text-[#5b9bd5] shadow-none transition hover:bg-[#f0f7ff]";

const btnCopiarClass =
  "inline-flex h-[30px] items-center gap-1.5 rounded-[3px] border border-[#5cb85c] bg-white px-3 text-[12px] font-normal leading-none text-[#5cb85c] shadow-none transition hover:bg-[#f5fff5]";

const timeInputClass =
  "h-8 w-full min-w-[88px] rounded border border-slate-300 bg-white pr-8 pl-2 text-[13px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function TimeField({
  value,
  disabled,
  placeholder,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  if (disabled && !value) {
    return (
      <div className="relative">
        <input
          type="text"
          readOnly
          disabled
          value="--:--"
          className={`${timeInputClass} text-slate-400`}
        />
        <Clock className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="time"
        value={value || ""}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${timeInputClass} ${disabled && value ? "opacity-70" : ""}`}
      />
      <Clock className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export function HorarioFuncionamentoEditor({
  config,
  onChange,
  onMensagem,
  onGravar,
  salvando,
  gravarLabel = "Gravar",
  modalLayerClass = "z-50",
}: Props) {
  const [diaIntervaloIdx, setDiaIntervaloIdx] = useState<number | null>(null);
  const [feriadosAberto, setFeriadosAberto] = useState(false);
  const [novoFeriado, setNovoFeriado] = useState({ data: "", descricao: "" });

  function atualizarDia(index: number, patch: Partial<DiaFuncionamento>) {
    const dias = [...config.dias];
    dias[index] = { ...dias[index], ...patch };
    onChange({ ...config, dias });
  }

  function copiarParaTodos() {
    const origem = config.dias[0];
    if (!origem) return;
    onChange({
      ...config,
      dias: config.dias.map((dia, i) =>
        i === 0
          ? dia
          : {
              ...dia,
              ativo: origem.ativo,
              inicio: origem.inicio,
              fim: origem.fim,
              intervalos: origem.intervalos.map((int) => ({
                ...int,
                id: criarIntervalo(int.inicio, int.fim).id,
              })),
            }
      ),
    });
    onMensagem?.("Horários da Segunda copiados para todos os dias.", "info");
  }

  function salvarIntervalos(diaIdx: number, intervalos: IntervaloDia[]) {
    atualizarDia(diaIdx, { intervalos });
    setDiaIntervaloIdx(null);
  }

  function adicionarFeriado() {
    if (!novoFeriado.data.trim()) return;
    const feriado: FeriadoLab = {
      id: `fer-${Date.now()}`,
      data: novoFeriado.data,
      descricao: novoFeriado.descricao.trim() || "Feriado",
    };
    onChange({
      ...config,
      feriados: [...config.feriados, feriado].sort((a, b) => a.data.localeCompare(b.data)),
    });
    setNovoFeriado({ data: "", descricao: "" });
  }

  function removerFeriado(id: string) {
    onChange({
      ...config,
      feriados: config.feriados.filter((f) => f.id !== id),
    });
  }

  const diaIntervalo = diaIntervaloIdx !== null ? config.dias[diaIntervaloIdx] : null;

  return (
    <div className="w-full">
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={`${thClass} w-[72px] text-center`}>Ativo</th>
              <th className={`${thClass} w-[140px]`}>Dia da Semana</th>
              <th className={`${thClass} w-[130px]`}>Hora de Início</th>
              <th className={`${thClass} w-[130px]`}>Hora de Término</th>
              <th className={`${thClass} min-w-[220px]`}>Intervalos</th>
            </tr>
          </thead>
          <tbody>
            {config.dias.map((dia, index) => (
              <tr key={dia.id} className="bg-white hover:bg-slate-50/50">
                <td className={`${tdClass} text-center`}>
                  <input
                    type="checkbox"
                    checked={dia.ativo}
                    onChange={(e) =>
                      atualizarDia(index, {
                        ativo: e.target.checked,
                        ...(e.target.checked && !dia.inicio
                          ? { inicio: "08:00", fim: "18:00" }
                          : {}),
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#4a90d9] focus:ring-[#4a90d9]"
                    aria-label={`Ativar ${dia.label}`}
                  />
                </td>
                <td className={`${tdClass} font-normal text-slate-800`}>{dia.label}</td>
                <td className={tdClass}>
                  <TimeField
                    value={dia.inicio}
                    disabled={!dia.ativo && !dia.inicio}
                    onChange={(inicio) => atualizarDia(index, { inicio })}
                  />
                </td>
                <td className={tdClass}>
                  <TimeField
                    value={dia.fim}
                    disabled={!dia.ativo && !dia.fim}
                    onChange={(fim) => atualizarDia(index, { fim })}
                  />
                </td>
                <td className={`${tdClass} min-w-[220px]`}>
                  {dia.ativo ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDiaIntervaloIdx(index)}
                        className={btnIntervaloClass}
                      >
                        <SquarePen className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        Intervalo
                      </button>
                      {index === 0 ? (
                        <button type="button" onClick={copiarParaTodos} className={btnCopiarClass}>
                          <Copy className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                          Copiar para Todos
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setFeriadosAberto(true)}
          className="inline-flex items-center gap-2 rounded border border-[#3d9a47] bg-[#4cae4c] px-4 py-2 text-[13px] font-normal text-white shadow-sm transition hover:bg-[#449d44]"
        >
          <Calendar className="h-4 w-4" />
          Configurar Feriados
        </button>
        {onGravar ? (
          <Button
            type="button"
            disabled={salvando}
            onClick={onGravar}
            className="inline-flex items-center gap-2 rounded bg-[#4a90d9] px-5 py-2 text-[13px] font-normal text-white hover:bg-[#3d7fc4]"
          >
            <Save className="h-4 w-4" />
            {salvando ? "Gravando..." : gravarLabel}
          </Button>
        ) : null}
      </div>

      {diaIntervalo && diaIntervaloIdx !== null ? (
        <ModalIntervalos
          dia={diaIntervalo}
          modalLayerClass={modalLayerClass}
          onClose={() => setDiaIntervaloIdx(null)}
          onSave={(intervalos) => salvarIntervalos(diaIntervaloIdx, intervalos)}
        />
      ) : null}

      <Modal
        open={feriadosAberto}
        onClose={() => setFeriadosAberto(false)}
        title="Configurar Feriados"
        size="md"
        layerClassName={modalLayerClass}
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase text-slate-600">
                Data
              </label>
              <input
                type="date"
                value={novoFeriado.data}
                onChange={(e) => setNovoFeriado((f) => ({ ...f, data: e.target.value }))}
                className="h-9 w-full rounded border border-slate-300 px-3 text-sm"
              />
            </div>
            <Input
              label="Descrição"
              value={novoFeriado.descricao}
              onChange={(e) => setNovoFeriado((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex.: Natal"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={adicionarFeriado}
            className="inline-flex items-center gap-1 bg-[#4cae4c] hover:bg-[#449d44]"
          >
            <Plus className="h-4 w-4" />
            Adicionar feriado
          </Button>

          {config.feriados.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">Nenhum feriado cadastrado.</p>
          ) : (
            <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded border border-slate-200">
              {config.feriados.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span>
                    <strong className="font-medium text-slate-800">
                      {f.data.split("-").reverse().join("/")}
                    </strong>
                    <span className="text-slate-600"> — {f.descricao}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removerFeriado(f.id)}
                    className="rounded p-1 text-red-500 hover:bg-red-50"
                    aria-label="Remover feriado"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setFeriadosAberto(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ModalIntervalos({
  dia,
  modalLayerClass,
  onClose,
  onSave,
}: {
  dia: DiaFuncionamento;
  modalLayerClass: string;
  onClose: () => void;
  onSave: (intervalos: IntervaloDia[]) => void;
}) {
  const [lista, setLista] = useState<IntervaloDia[]>(
    dia.intervalos.length > 0
      ? dia.intervalos.map((i) => ({ ...i }))
      : [criarIntervalo()]
  );

  function adicionar() {
    setLista((prev) => [...prev, criarIntervalo()]);
  }

  function remover(id: string) {
    setLista((prev) => (prev.length <= 1 ? prev : prev.filter((i) => i.id !== id)));
  }

  function atualizar(id: string, patch: Partial<IntervaloDia>) {
    setLista((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Intervalos — ${dia.label}`}
      size="md"
      layerClassName={modalLayerClass}
    >
      <p className="mb-4 text-[12px] text-slate-500">
        Defina os horários de pausa durante o expediente (ex.: almoço).
      </p>
      <div className="space-y-3">
        {lista.map((item, idx) => (
          <div
            key={item.id}
            className="flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-slate-50/80 p-3"
          >
            <span className="w-full text-[11px] font-medium text-slate-600">Intervalo {idx + 1}</span>
            <div className="min-w-[120px] flex-1">
              <label className="mb-1 block text-[10px] uppercase text-slate-500">Início</label>
              <input
                type="time"
                value={item.inicio}
                onChange={(e) => atualizar(item.id, { inicio: e.target.value })}
                className={timeInputClass}
              />
            </div>
            <div className="min-w-[120px] flex-1">
              <label className="mb-1 block text-[10px] uppercase text-slate-500">Término</label>
              <input
                type="time"
                value={item.fim}
                onChange={(e) => atualizar(item.id, { fim: e.target.value })}
                className={timeInputClass}
              />
            </div>
            <button
              type="button"
              onClick={() => remover(item.id)}
              className="mb-0.5 rounded p-2 text-slate-500 hover:bg-white hover:text-red-600"
              aria-label="Remover intervalo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={adicionar}
        className="mt-3 inline-flex items-center gap-1 text-[12px] text-[#4a90d9] hover:underline"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar intervalo
      </button>
      <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-[#4a90d9] hover:bg-[#3d7fc4]"
          onClick={() => onSave(lista)}
        >
          Salvar intervalos
        </Button>
      </div>
    </Modal>
  );
}
