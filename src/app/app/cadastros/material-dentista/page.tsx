"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { ListaCarregando } from "@/components/ListaCarregando";
import { ListagemPorNome } from "@/components/listagem/listagem-por-nome";
import { ModuloCabecalho } from "@/components/ModuloCabecalho";
import { useI18n } from "@/components/i18n-provider";
import { Button, Input, Modal } from "@/components/ui";
import { usePageReady } from "@/hooks/use-page-ready";
import {
  carregarMateriaisDentistaCadastro,
  MATERIAIS_DENTISTA_ATUALIZADA_EVENT,
  removerMaterialDentistaCadastro,
  salvarMateriaisDentistaCadastro,
} from "@/lib/materiais-dentista-cadastro";

export default function MaterialDentistaPage() {
  const { t } = useI18n();
  const [busca, setBusca] = useState("");
  const [materiais, setMateriais] = useState<string[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeMaterial, setNomeMaterial] = useState("");

  const paginaPronta = usePageReady(() => {
    setMateriais(carregarMateriaisDentistaCadastro());
  });

  useEffect(() => {
    const handler = () => setMateriais(carregarMateriaisDentistaCadastro());
    window.addEventListener(MATERIAIS_DENTISTA_ATUALIZADA_EVENT, handler);
    return () => window.removeEventListener(MATERIAIS_DENTISTA_ATUALIZADA_EVENT, handler);
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return materiais;
    return materiais.filter((material) => material.toLowerCase().includes(termo));
  }, [busca, materiais]);

  const itensListagem = useMemo(
    () => (paginaPronta ? filtrados.map((nome) => ({ nome })) : []),
    [filtrados, paginaPronta]
  );

  function abrirNovo() {
    setEditando(null);
    setNomeMaterial("");
    setModalAberto(true);
  }

  function abrirEdicao(material: string) {
    setEditando(material);
    setNomeMaterial(material);
    setModalAberto(true);
  }

  async function salvarMaterial(event: React.FormEvent) {
    event.preventDefault();
    const nome = nomeMaterial.trim();
    if (!nome) return;

    const semDuplicidade = materiais.filter(
      (material) =>
        material !== editando && material.toLowerCase() !== nome.toLowerCase()
    );
    const proxima = editando ? semDuplicidade.concat(nome) : [...semDuplicidade, nome];
    try {
      const salva = await salvarMateriaisDentistaCadastro(proxima);
      setMateriais(salva);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível salvar o material.");
      return;
    }
    setModalAberto(false);
    setEditando(null);
    setNomeMaterial("");
  }

  async function excluirMaterial(material: string) {
    try {
      const proxima = await removerMaterialDentistaCadastro(material, materiais);
      setMateriais(proxima);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível excluir o material.");
    }
  }

  return (
    <div className="space-y-4 text-xs text-slate-600">
      <ModuloCabecalho moduloKey="nav.cadastros" tituloKey="nav.materialDentista" />

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={abrirNovo}
            className="inline-flex h-7 items-center gap-1 rounded-sm bg-emerald-500 px-3 text-[10px] font-semibold text-white hover:bg-emerald-600"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("cadastros.materialDentista.adicionar")}
          </button>

          <div className="flex w-full max-w-xl items-center gap-1">
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder={t("cadastros.comum.pesquisar")}
              className="h-7 flex-1 rounded-sm border border-slate-200 px-3 text-[10px] outline-none focus:border-blue-400"
            />
            <button
              type="button"
              onClick={() => setBusca("")}
              className="h-7 rounded-sm bg-slate-500 px-3 text-[10px] font-semibold text-white hover:bg-slate-600"
            >
              {t("cadastros.comum.limpar")}
            </button>
          </div>
        </div>

        <ListagemPorNome storageKey="material-dentista" itens={itensListagem}>
          {(itensPagina) => (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-[10px]">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-slate-500">
                <th className="px-3 py-2 text-left font-semibold uppercase">{t("listagem.nome")}</th>
                <th className="px-3 py-2 text-center font-semibold uppercase">{t("cadastros.comum.opcoes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {!paginaPronta ? (
                <ListaCarregando colSpan={2} />
              ) : (
              itensPagina.map((item) => (
                <tr key={item.nome} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-700">{item.nome}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center gap-2 text-slate-500">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(item.nome)}
                        className="rounded p-1 hover:bg-slate-100 hover:text-blue-600"
                        title="Editar"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => excluirMaterial(item.nome)}
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
              {paginaPronta && filtrados.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-8 text-center text-slate-400">
                    Nenhum material encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          )}
        </ListagemPorNome>
      </div>

      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? "Editar Material" : "Cadastrar Material"}
        size="sm"
      >
        <form onSubmit={salvarMaterial} className="space-y-4 text-[11px] text-slate-600">
          <Input
            label="Material"
            value={nomeMaterial}
            onChange={(event) => setNomeMaterial(event.target.value)}
            placeholder="Digite o nome do material"
            required
          />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="submit" size="sm">
              {editando ? "Salvar Material" : "Cadastrar Material"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setModalAberto(false)}>
              Fechar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
