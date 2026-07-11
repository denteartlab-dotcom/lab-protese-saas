"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { GerenciarEtiquetasCategoriaModal } from "@/components/GerenciarEtiquetasCategoriaModal";
import { Button, Input, Select } from "@/components/ui";
import {
  carregarEtiquetasCategoria,
  etiquetaCategoriaAtiva,
  ETIQUETAS_CATEGORIA_EVENT,
  type EtiquetaCategoria,
} from "@/lib/etiquetas-categoria";
import {
  alterarUnidadeMedidaFormulario,
  cadastrarNovoProduto,
  formatMoedaProdutoInput,
  formatQuantidadeProdutoInput,
  novoProdutoFormulario,
  type ProdutoFormulario,
} from "@/lib/produto-formulario";
import type { ProdutoCatalogo } from "@/lib/produtos-catalogo";

type Props = {
  open: boolean;
  onClose: () => void;
  onSalvo?: (produto: ProdutoCatalogo) => void;
};

export function ProdutoCadastroModal({ open, onClose, onSalvo }: Props) {
  const [portalPronto, setPortalPronto] = useState(false);
  const [form, setForm] = useState<ProdutoFormulario>(novoProdutoFormulario);
  const [salvando, setSalvando] = useState(false);
  const [etiquetasCategoria, setEtiquetasCategoria] = useState<EtiquetaCategoria[]>([]);
  const [modalEtiquetasAberto, setModalEtiquetasAberto] = useState(false);

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm(novoProdutoFormulario());
    setSalvando(false);
    setEtiquetasCategoria(carregarEtiquetasCategoria());
  }, [open]);

  useEffect(() => {
    function atualizarEtiquetas() {
      setEtiquetasCategoria(carregarEtiquetasCategoria());
    }
    window.addEventListener(ETIQUETAS_CATEGORIA_EVENT, atualizarEtiquetas);
    return () => window.removeEventListener(ETIQUETAS_CATEGORIA_EVENT, atualizarEtiquetas);
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm((atual) => {
      const etiquetaValida = etiquetaCategoriaAtiva(atual.etiqueta, etiquetasCategoria);
      if (etiquetaValida === (atual.etiqueta || "")) return atual;
      return { ...atual, etiqueta: etiquetaValida };
    });
  }, [open, etiquetasCategoria]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (salvando) return;
    setSalvando(true);
    try {
      const produto = await cadastrarNovoProduto(form);
      if (!produto) return;
      onSalvo?.(produto);
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  if (!open || !portalPronto) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10060] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="produto-cadastro-titulo"
      >
        <div className="absolute inset-0" onClick={() => !salvando && onClose()} aria-hidden />
        <div className="relative my-auto w-full max-w-4xl rounded border border-[#d4d4d4] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
            <h2 id="produto-cadastro-titulo" className="text-[15px] font-normal text-slate-800">
              Cadastrar Produto
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="text-lg leading-none text-slate-400 hover:text-slate-600 disabled:opacity-40"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 px-4 py-4 text-[11px] text-slate-600"
          >
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Plus className="h-3.5 w-3.5" />
                Dados do Produto
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Código de Barras"
                  value={form.codigoBarras}
                  onChange={(e) => setForm({ ...form, codigoBarras: e.target.value })}
                />
                <Input
                  label="Nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                />
                <Input
                  label="Marca"
                  value={form.marca}
                  onChange={(e) => setForm({ ...form, marca: e.target.value })}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Select
                      label="Etiqueta"
                      value={etiquetaCategoriaAtiva(form.etiqueta, etiquetasCategoria)}
                      onChange={(e) => setForm({ ...form, etiqueta: e.target.value })}
                    >
                      <option value="">Selecione...</option>
                      {etiquetasCategoria.map((etiqueta) => (
                        <option key={etiqueta.id} value={etiqueta.nome}>
                          {etiqueta.nome}
                        </option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      onClick={() => setModalEtiquetasAberto(true)}
                      className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                    >
                      + adicionar etiqueta
                    </button>
                  </div>
                  <Select
                    label="Unidade de Medida"
                    value={form.unidadeMedida}
                    onChange={(e) =>
                      setForm(alterarUnidadeMedidaFormulario(form, e.target.value))
                    }
                  >
                    <option>un (Unitário)</option>
                    <option>cx (Caixa)</option>
                    <option>kg (Quilograma)</option>
                    <option>g (Grama)</option>
                    <option>l (Litro)</option>
                    <option>m (Metro)</option>
                    <option>ml (Mililitro)</option>
                  </Select>
                </div>
                <Input
                  label="Estoque Mínimo"
                  selectOnFocus
                  value={form.estoqueMinimo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      estoqueMinimo: formatQuantidadeProdutoInput(
                        e.target.value,
                        form.unidadeMedida
                      ),
                    })
                  }
                />
                <Input
                  label="Estoque Máximo"
                  selectOnFocus
                  value={form.estoqueMaximo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      estoqueMaximo: formatQuantidadeProdutoInput(
                        e.target.value,
                        form.unidadeMedida
                      ),
                    })
                  }
                />
                <Input
                  label="Preço de Custo"
                  selectOnFocus
                  value={form.valorCusto}
                  onChange={(e) =>
                    setForm({ ...form, valorCusto: formatMoedaProdutoInput(e.target.value) })
                  }
                />
                <Input
                  label="Preço de Venda"
                  selectOnFocus
                  value={form.valor}
                  onChange={(e) =>
                    setForm({ ...form, valor: formatMoedaProdutoInput(e.target.value) })
                  }
                />
              </div>
            </section>

            <div className="flex justify-start gap-2 border-t border-slate-100 pt-4">
              <Button type="submit" size="sm" disabled={salvando}>
                {salvando ? "Cadastrando..." : "Cadastrar"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={salvando}
                onClick={onClose}
              >
                Fechar
              </Button>
            </div>
          </form>
        </div>
      </div>

      <GerenciarEtiquetasCategoriaModal
        open={modalEtiquetasAberto}
        onClose={() => setModalEtiquetasAberto(false)}
      />
    </>,
    document.body
  );
}
