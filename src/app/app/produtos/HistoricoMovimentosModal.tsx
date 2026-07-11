"use client";

import { I18nPortal } from "@/components/I18nPortal";
import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { CampoDataBr } from "@/components/ui";
import type { MovimentoEstoque } from "@/lib/estoque";

const selectClass =
  "h-8 w-full rounded-sm border border-slate-200 bg-white px-2 text-[11px] text-slate-600 outline-none focus:border-slate-300";
export function parseDataBrParaComparacao(value: string) {
  const partes = value.trim().split("/");
  if (partes.length !== 3) return null;
  const [dia, mes, ano] = partes;
  if (!dia || !mes || !ano || ano.length < 4) return null;
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
  if (Number.isNaN(data.getTime())) return null;
  return data;
}

function CampoFiltro({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[11px] text-slate-500">{label}</span>
      {children}
    </div>
  );
}

export type HistoricoFiltros = {
  colaborador: string;
  tipoMovimento: "todos" | "entrada" | "saida";
  setor: string;
  dataInicial: string;
  dataFinal: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  filtros: HistoricoFiltros;
  onFiltrosChange: (filtros: HistoricoFiltros) => void;
  colaboradores: string[];
  setores: string[];
  movimentos: MovimentoEstoque[];
  formatarData: (data: string) => string;
  labelTipo: (tipo: MovimentoEstoque["tipo"]) => string;
  textoMovimento: (movimento: MovimentoEstoque) => string;
  colaboradorMovimento: (movimento: MovimentoEstoque) => string;
  onExcluirMovimento: (movimento: MovimentoEstoque) => void;
};

export function HistoricoMovimentosModal({
  open,
  onClose,
  filtros,
  onFiltrosChange,
  colaboradores,
  setores,
  movimentos,
  formatarData,
  labelTipo,
  textoMovimento,
  colaboradorMovimento,
  onExcluirMovimento,
}: Props) {
  if (!open) return null;

  function solicitarExclusao(movimento: MovimentoEstoque) {
    onExcluirMovimento(movimento);
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="historico-movimentos-titulo"
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-md bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 id="historico-movimentos-titulo" className="text-[15px] font-medium text-slate-600">
            Histórico de Movimentos de Estoque
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CampoFiltro label="Colaboradores">
              <select
                value={filtros.colaborador}
                onChange={(event) => onFiltrosChange({ ...filtros, colaborador: event.target.value })}
                className={selectClass}
              >
                <option value="">Selecione</option>
                {colaboradores.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </CampoFiltro>

            <CampoFiltro label="Tipo Movimento">
              <select
                value={filtros.tipoMovimento}
                onChange={(event) =>
                  onFiltrosChange({
                    ...filtros,
                    tipoMovimento: event.target.value as HistoricoFiltros["tipoMovimento"],
                  })
                }
                className={selectClass}
              >
                <option value="todos">Todos</option>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </CampoFiltro>

            <CampoFiltro label="Setor">
              <select
                value={filtros.setor}
                onChange={(event) => onFiltrosChange({ ...filtros, setor: event.target.value })}
                className={selectClass}
              >
                <option value="">Selecione</option>
                {setores.map((setor) => (
                  <option key={setor} value={setor}>
                    {setor}
                  </option>
                ))}
              </select>
            </CampoFiltro>

            <CampoFiltro label="Período">
              <div className="grid grid-cols-2 gap-2">
                <CampoDataBr
                  value={filtros.dataInicial}
                  onChange={(dataInicial) => onFiltrosChange({ ...filtros, dataInicial })}
                  inputClassName="h-8 text-[11px]"
                />
                <CampoDataBr
                  value={filtros.dataFinal}
                  onChange={(dataFinal) => onFiltrosChange({ ...filtros, dataFinal })}
                  inputClassName="h-8 text-[11px]"
                />
              </div>
            </CampoFiltro>
          </div>

          <div className="mt-4 overflow-hidden rounded-sm border border-slate-200">
            <table className="min-w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5">Data</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Movimento</th>
                  <th className="px-4 py-2.5">Setor</th>
                  <th className="px-4 py-2.5">Colaborador</th>
                  <th className="px-4 py-2.5 text-center">Opções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {movimentos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-32" />
                  </tr>
                ) : (
                  movimentos.map((movimento) => (
                    <tr key={movimento.id || `${movimento.data}-${movimento.tipo}-${movimento.quantidade}`}>
                      <td className="px-4 py-2.5 whitespace-nowrap">{formatarData(movimento.data)}</td>
                      <td className="px-4 py-2.5">{labelTipo(movimento.tipo)}</td>
                      <td className="px-4 py-2.5">{textoMovimento(movimento)}</td>
                      <td className="px-4 py-2.5">{movimento.setor || ""}</td>
                      <td className="px-4 py-2.5">{colaboradorMovimento(movimento)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => solicitarExclusao(movimento)}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          title="Excluir movimentação"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-sm border border-slate-200 bg-slate-100 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
