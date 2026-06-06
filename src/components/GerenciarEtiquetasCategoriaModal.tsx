"use client";

import { useEffect, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { getProdutosEstoqueExtras, setProdutosEstoqueExtras } from "@/lib/estoque";
import {
  COR_ETIQUETA_PADRAO,
  carregarEtiquetasCategoria,
  normalizarCorEtiqueta,
  removerEtiquetaDosProdutos,
  salvarEtiquetasCategoria,
  type EtiquetaCategoria,
} from "@/lib/etiquetas-categoria";

type Props = {
  open: boolean;
  onClose: () => void;
  onEtiquetaSalva?: (nome: string) => void;
  onEtiquetaExcluida?: (nome: string) => void;
  produtos?: Array<{ id: string; etiqueta?: string | null }>;
  layerClassName?: string;
};

function novoFormulario() {
  return { nome: "", cor: COR_ETIQUETA_PADRAO, editandoId: "" };
}

export function GerenciarEtiquetasCategoriaModal({
  open,
  onClose,
  onEtiquetaSalva,
  onEtiquetaExcluida,
  layerClassName = "z-50",
}: Props) {
  const [etiquetas, setEtiquetas] = useState<EtiquetaCategoria[]>([]);
  const [form, setForm] = useState(novoFormulario);

  useEffect(() => {
    if (!open) return;
    setEtiquetas(carregarEtiquetasCategoria());
    setForm(novoFormulario());
  }, [open]);

  function persistir(lista: EtiquetaCategoria[]) {
    const salvas = salvarEtiquetasCategoria(lista);
    setEtiquetas(salvas);
  }

  function salvarEtiqueta() {
    const nome = form.nome.trim();
    if (!nome) return;

    const cor = normalizarCorEtiqueta(form.cor);
    if (form.editandoId) {
      const nomeAnterior = etiquetas.find((item) => item.id === form.editandoId)?.nome;
      const duplicado = etiquetas.some(
        (item) => item.nome.toLowerCase() === nome.toLowerCase() && item.id !== form.editandoId
      );
      if (duplicado) return;

      persistir(
        etiquetas.map((item) =>
          item.id === form.editandoId ? { ...item, nome, cor } : item
        )
      );

      if (nomeAnterior && nomeAnterior !== nome) {
        const extras = getProdutosEstoqueExtras();
        let alterou = false;
        for (const chave of Object.keys(extras)) {
          if (extras[chave]?.etiqueta === nomeAnterior) {
            extras[chave] = { ...extras[chave], etiqueta: nome };
            alterou = true;
          }
        }
        if (alterou) setProdutosEstoqueExtras(extras);
      }
    } else {
      const duplicado = etiquetas.some(
        (item) => item.nome.toLowerCase() === nome.toLowerCase()
      );
      if (duplicado) return;

      persistir([
        ...etiquetas,
        {
          id: `etq-${Date.now()}`,
          nome,
          cor,
        },
      ]);
    }

    setForm(novoFormulario());
    onEtiquetaSalva?.(nome);
  }

  function editarEtiqueta(etiqueta: EtiquetaCategoria) {
    setForm({
      nome: etiqueta.nome,
      cor: etiqueta.cor,
      editandoId: etiqueta.id,
    });
  }

  function excluirEtiqueta(id: string) {
    const removida = etiquetas.find((item) => item.id === id);
    persistir(etiquetas.filter((item) => item.id !== id));
    if (removida) {
      removerEtiquetaDosProdutos(removida.nome, produtos);
      onEtiquetaExcluida?.(removida.nome);
    }
    if (form.editandoId === id) setForm(novoFormulario());
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerenciar Etiquetas Categoria"
      size="lg"
      layerClassName={layerClassName}
    >
      <div className="space-y-5 text-[11px] text-slate-600">
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Nome da Etiqueta</label>
            <input
              value={form.nome}
              onChange={(event) => setForm((atual) => ({ ...atual, nome: event.target.value }))}
              placeholder="Digite o nome da Etiqueta..."
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Cor</label>
            <label className="relative block h-9 w-full cursor-pointer overflow-hidden rounded-md border border-slate-200">
              <input
                type="color"
                value={form.cor}
                onChange={(event) =>
                  setForm((atual) => ({ ...atual, cor: event.target.value }))
                }
                className="absolute inset-0 h-full w-full cursor-pointer border-0 p-0 opacity-0"
              />
              <span
                className="block h-full w-full"
                style={{ backgroundColor: normalizarCorEtiqueta(form.cor) }}
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={salvarEtiqueta}
            className="inline-flex h-8 items-center gap-1.5 rounded bg-emerald-500 px-4 text-xs font-semibold text-white hover:bg-emerald-600"
          >
            <Plus className="h-3.5 w-3.5" />
            Salvar Novo
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-700">Etiquetas Existentes</h3>
          <div className="overflow-hidden rounded border border-slate-100">
            <table className="min-w-full text-left">
              <thead>
                <tr className="bg-white text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="w-16 px-3 py-2 font-semibold">Cor</th>
                  <th className="px-3 py-2 font-semibold">Nome</th>
                  <th className="w-24 px-3 py-2 text-center font-semibold">Opções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {etiquetas.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                      Nenhuma etiqueta cadastrada.
                    </td>
                  </tr>
                ) : (
                  etiquetas.map((etiqueta) => (
                    <tr key={etiqueta.id}>
                      <td className="px-3 py-2">
                        <span
                          className="inline-block h-5 w-5 rounded"
                          style={{ backgroundColor: etiqueta.cor }}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-700">{etiqueta.nome}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-2 text-slate-500">
                          <button
                            type="button"
                            onClick={() => editarEtiqueta(etiqueta)}
                            className="rounded p-1 text-blue-500 hover:bg-blue-50"
                            title="Editar"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirEtiqueta(etiqueta.id)}
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
