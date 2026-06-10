"use client";

import { ChevronsDownUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type ServicoEdicaoValores = {
  id: string;
  nome: string;
  valor: number;
};

export type CategoriaEdicaoValores = {
  id: string;
  nome: string;
  servicos: ServicoEdicaoValores[];
};

type Props = {
  aberto: boolean;
  categorias: CategoriaEdicaoValores[];
  onFechar: () => void;
  onGravar: (categorias: CategoriaEdicaoValores[]) => void;
};

function clonarCategorias(categorias: CategoriaEdicaoValores[]): CategoriaEdicaoValores[] {
  return categorias.map((categoria) => ({
    ...categoria,
    servicos: categoria.servicos.map((servico) => ({ ...servico })),
  }));
}

function formatarValor(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseValorInput(value: string) {
  return Number(value.replace(/\D/g, "")) / 100;
}

function formatarValorInput(value: string) {
  return parseValorInput(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parsePercentual(value: string) {
  const limpo = value.replace(/\./g, "").replace(",", ".").trim();
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : NaN;
}

export function ModalEditarValoresTabelaPrecos({
  aberto,
  categorias,
  onFechar,
  onGravar,
}: Props) {
  const [categoriasLocal, setCategoriasLocal] = useState<CategoriaEdicaoValores[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [tipoCalculo, setTipoCalculo] = useState<"acrescimo" | "desconto">("acrescimo");
  const [percentual, setPercentual] = useState("0,00");

  useEffect(() => {
    if (!aberto) return;
    const copia = clonarCategorias(categorias);
    setCategoriasLocal(copia);
    setSelecionadas(new Set(copia.map((categoria) => categoria.id)));
    setExpandidas(new Set(copia.map((categoria) => categoria.id)));
    setTipoCalculo("acrescimo");
    setPercentual("0,00");
  }, [aberto, categorias]);

  const todasSelecionadas = useMemo(() => {
    if (categoriasLocal.length === 0) return false;
    return categoriasLocal.every((categoria) => selecionadas.has(categoria.id));
  }, [categoriasLocal, selecionadas]);

  if (!aberto) return null;

  function alternarTodasCategorias() {
    if (todasSelecionadas) {
      setSelecionadas(new Set());
      return;
    }
    setSelecionadas(new Set(categoriasLocal.map((categoria) => categoria.id)));
  }

  function alternarCategoria(id: string) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  function alternarExpansao(id: string) {
    setExpandidas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  function atualizarValorServico(categoriaId: string, servicoId: string, valorTexto: string) {
    const valor = parseValorInput(valorTexto);
    setCategoriasLocal((atual) =>
      atual.map((categoria) =>
        categoria.id !== categoriaId
          ? categoria
          : {
              ...categoria,
              servicos: categoria.servicos.map((servico) =>
                servico.id === servicoId ? { ...servico, valor } : servico
              ),
            }
      )
    );
  }

  function calcularValores() {
    if (selecionadas.size === 0) {
      alert("Marque ao menos uma categoria para calcular.");
      return;
    }
    const percentualNumero = parsePercentual(percentual);
    if (!Number.isFinite(percentualNumero) || percentualNumero < 0) {
      alert("Informe um percentual válido.");
      return;
    }
    if (tipoCalculo === "desconto" && percentualNumero > 100) {
      alert("O desconto não pode ser maior que 100%.");
      return;
    }
    const fator =
      tipoCalculo === "acrescimo"
        ? 1 + percentualNumero / 100
        : 1 - percentualNumero / 100;

    setCategoriasLocal((atual) =>
      atual.map((categoria) => {
        if (!selecionadas.has(categoria.id)) return categoria;
        return {
          ...categoria,
          servicos: categoria.servicos.map((servico) => ({
            ...servico,
            valor: Math.round(servico.valor * fator * 100) / 100,
          })),
        };
      })
    );
  }

  function gravarAlteracao() {
    onGravar(categoriasLocal);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Editar Valores</h2>
          <button
            type="button"
            onClick={onFechar}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-200 bg-slate-100 px-5 py-2 text-[11px] text-slate-600">
          Marque as categorias que você deseja calcular os valores.
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
          <select
            value={tipoCalculo}
            onChange={(evento) =>
              setTipoCalculo(evento.target.value as "acrescimo" | "desconto")
            }
            className="h-8 min-w-[120px] rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="acrescimo">Acréscimo</option>
            <option value="desconto">Desconto</option>
          </select>
          <input
            type="text"
            inputMode="decimal"
            value={percentual}
            onChange={(evento) => {
              const texto = evento.target.value.replace(/[^\d,]/g, "");
              const partes = texto.split(",");
              const normalizado =
                partes.length <= 1 ? partes[0] : `${partes[0]},${partes.slice(1).join("")}`;
              setPercentual(normalizado);
            }}
            className="h-8 w-24 rounded border border-slate-300 px-2 text-right text-xs text-slate-700 outline-none focus:border-blue-400"
            aria-label="Percentual"
            placeholder="0,00"
          />
          <button
            type="button"
            onClick={calcularValores}
            className="h-8 rounded border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Calcular
          </button>
          <button
            type="button"
            onClick={gravarAlteracao}
            className="h-8 min-w-[160px] flex-1 rounded bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Gravar Alteração
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={todasSelecionadas}
              onChange={alternarTodasCategorias}
              className="h-3.5 w-3.5 accent-blue-600"
            />
            Selecionar todas as categorias
          </label>

          <div className="space-y-0 border border-slate-200">
            {categoriasLocal.map((categoria) => {
              const expandida = expandidas.has(categoria.id);
              const marcada = selecionadas.has(categoria.id);
              return (
                <div key={categoria.id} className="border-b border-slate-200 last:border-b-0">
                  <div className="flex items-center justify-between bg-[#5c5c5c] px-3 py-2 text-white">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={() => alternarCategoria(categoria.id)}
                        className="h-3.5 w-3.5 accent-emerald-500"
                      />
                      <span className="truncate text-xs font-semibold uppercase">
                        {categoria.nome}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => alternarExpansao(categoria.id)}
                      className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
                      title={expandida ? "Recolher" : "Expandir"}
                    >
                      <ChevronsDownUp className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {expandida && (
                    <div className="bg-white">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                            <th className="px-3 py-2 text-left font-semibold uppercase">
                              Nome Serviço
                            </th>
                            <th className="w-40 px-3 py-2 text-right font-semibold uppercase">
                              Valor
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {categoria.servicos.map((servico) => (
                            <tr key={servico.id} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 text-slate-600">{servico.nome}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={formatarValor(servico.valor)}
                                  onChange={(evento) =>
                                    atualizarValorServico(
                                      categoria.id,
                                      servico.id,
                                      formatarValorInput(evento.target.value)
                                    )
                                  }
                                  className={cn(
                                    "h-7 w-full rounded border border-slate-300 px-2 text-right text-xs text-slate-700 outline-none focus:border-blue-400",
                                    !marcada && "bg-slate-50"
                                  )}
                                />
                              </td>
                            </tr>
                          ))}
                          {categoria.servicos.length === 0 && (
                            <tr>
                              <td
                                colSpan={2}
                                className="px-3 py-6 text-center text-slate-400"
                              >
                                Nenhum serviço nesta categoria.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            {categoriasLocal.length === 0 && (
              <p className="px-3 py-8 text-center text-xs text-slate-400">
                Não há categorias nesta tabela.
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onFechar}
            className="h-8 rounded border border-slate-300 bg-white px-5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
