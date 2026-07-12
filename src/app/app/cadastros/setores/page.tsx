"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { ListaCarregando } from "@/components/ListaCarregando";
import { ListagemPorNome } from "@/components/listagem/listagem-por-nome";
import { ModuloCabecalho } from "@/components/ModuloCabecalho";
import { useI18n } from "@/components/i18n-provider";
import { Button, Input, Modal } from "@/components/ui";
import { usePageReady } from "@/hooks/use-page-ready";
import { readStorageArray, writeStorage } from "@/lib/persisted-storage";

type Setor = {
  id: string;
  nome: string;
  cor: string;
};

const STORAGE_KEY = "labProteseSetores";
const EXCLUIDOS_STORAGE_KEY = "labProteseSetoresExcluidos";

const formularioVazio = {
  nome: "",
  cor: "#7c5cff",
};

function carregarLista(key: string, fallback: Setor[] = []) {
  if (typeof window === "undefined") return fallback;
  return readStorageArray(key, fallback);
}

export default function SetoresPage() {
  const { t } = useI18n();
  const [busca, setBusca] = useState("");
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setoresExcluidos, setSetoresExcluidos] = useState<Setor[]>([]);
  const [setoresCarregados, setSetoresCarregados] = useState(false);
  const [excluidosCarregados, setExcluidosCarregados] = useState(false);
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Setor | null>(null);
  const [form, setForm] = useState(formularioVazio);

  const paginaPronta = usePageReady(() => {
    setSetores(carregarLista(STORAGE_KEY));
    setSetoresExcluidos(carregarLista(EXCLUIDOS_STORAGE_KEY));
    setSetoresCarregados(true);
    setExcluidosCarregados(true);
  });

  useEffect(() => {
    if (!paginaPronta) return;

    function carregar() {
      setSetores(carregarLista(STORAGE_KEY));
      setSetoresExcluidos(carregarLista(EXCLUIDOS_STORAGE_KEY));
      setSetoresCarregados(true);
      setExcluidosCarregados(true);
    }

    window.addEventListener("focus", carregar);
    return () => window.removeEventListener("focus", carregar);
  }, [paginaPronta]);

  useEffect(() => {
    if (!setoresCarregados) return;
    writeStorage(STORAGE_KEY, setores);
  }, [setores, setoresCarregados]);

  useEffect(() => {
    if (!excluidosCarregados) return;
    writeStorage(EXCLUIDOS_STORAGE_KEY, setoresExcluidos);
  }, [setoresExcluidos, excluidosCarregados]);

  const filtrados = useMemo(() => {
    const lista = mostrarExcluidos ? setoresExcluidos : setores;
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;

    return lista.filter((setor) =>
      [setor.nome, setor.cor].join(" ").toLowerCase().includes(termo)
    );
  }, [busca, setores, setoresExcluidos, mostrarExcluidos]);

  function abrirNovo() {
    setEditando(null);
    setForm(formularioVazio);
    setModalAberto(true);
  }

  function abrirEdicao(setor: Setor) {
    setEditando(setor);
    setForm({ nome: setor.nome, cor: setor.cor });
    setModalAberto(true);
  }

  function salvarSetor(event: React.FormEvent) {
    event.preventDefault();
    if (!form.nome.trim()) return;

    if (editando) {
      setSetores((atuais) => {
        const atualizados = atuais.map((setor) =>
          setor.id === editando.id ? { ...setor, nome: form.nome.trim(), cor: form.cor } : setor
        );
        return atualizados;
      });
    } else {
      setSetores((atuais) => [
        ...atuais,
        {
          id: crypto.randomUUID(),
          nome: form.nome.trim(),
          cor: form.cor,
        },
      ]);
    }

    setModalAberto(false);
    setEditando(null);
    setForm(formularioVazio);
  }

  function excluirSetor(id: string) {
    const setor = setores.find((item) => item.id === id);
    if (setor) {
      setSetoresExcluidos((atuais) => [...atuais, setor]);
    }
    setSetores((atuais) => atuais.filter((item) => item.id !== id));
  }

  function restaurarSetor(id: string) {
    const setor = setoresExcluidos.find((item) => item.id === id);
    if (setor) {
      setSetores((atuais) => [...atuais, setor]);
    }
    setSetoresExcluidos((atuais) => atuais.filter((item) => item.id !== id));
  }

  function removerSetorDefinitivo(id: string) {
    setSetoresExcluidos((atuais) => atuais.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-4 text-xs text-slate-600">
      <ModuloCabecalho moduloKey="nav.cadastros" tituloKey="nav.setores" />

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={abrirNovo}
              className="inline-flex h-7 items-center gap-1 rounded-sm bg-emerald-500 px-3 text-[10px] font-semibold text-white hover:bg-emerald-600"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("cadastros.setores.adicionar")}
            </button>
            <button
              type="button"
              onClick={() => setMostrarExcluidos((atual) => !atual)}
              className="h-7 rounded-sm border border-slate-300 bg-white px-3 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              {mostrarExcluidos ? t("cadastros.comum.verAtivos") : t("cadastros.comum.verExcluidos")}
            </button>
          </div>

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

        <ListagemPorNome storageKey="setores" itens={paginaPronta ? filtrados : []}>
          {(itensPagina) => (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-[10px]">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-slate-500">
                <th className="px-3 py-2 text-left font-semibold uppercase">{t("cadastros.setores.coluna")}</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">{t("cadastros.comum.cor")}</th>
                <th className="px-3 py-2 text-center font-semibold uppercase">{t("cadastros.comum.opcoes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {!paginaPronta ? (
                <ListaCarregando colSpan={3} />
              ) : (
              itensPagina.map((setor) => (
                <tr key={setor.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-700">{setor.nome}</td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex h-5 w-16 rounded-sm border border-black/5"
                      style={{ backgroundColor: setor.cor }}
                      title={setor.cor}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center gap-2 text-slate-500">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(setor)}
                        disabled={mostrarExcluidos}
                        className="rounded p-1 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-40"
                        title={t("cadastros.comum.editar")}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      {mostrarExcluidos ? (
                        <>
                          <button
                            type="button"
                            onClick={() => restaurarSetor(setor.id)}
                            className="rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-600"
                          >
                            {t("cadastros.comum.restaurar")}
                          </button>
                          <button
                            type="button"
                            onClick={() => removerSetorDefinitivo(setor.id)}
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                            title={t("cadastros.comum.removerDefinitivo")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => excluirSetor(setor.id)}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          title={t("cadastros.comum.excluir")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
              )}
              {paginaPronta && filtrados.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-slate-400">
                    {mostrarExcluidos ? t("cadastros.setores.nenhumExcluido") : t("cadastros.setores.nenhumEncontrado")}
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
        title={editando ? t("cadastros.setores.editar") : t("cadastros.setores.cadastrar")}
        size="sm"
      >
        <form onSubmit={salvarSetor} className="space-y-4 text-[11px] text-slate-600">
          <Input
            label={t("cadastros.setores.coluna")}
            value={form.nome}
            onChange={(event) => setForm({ ...form, nome: event.target.value })}
            placeholder={t("cadastros.comum.placeholderNomeSetor")}
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">{t("cadastros.comum.cor")}</label>
            <input
              type="color"
              value={form.cor}
              onChange={(event) => setForm({ ...form, cor: event.target.value })}
              className="h-9 w-full cursor-pointer rounded border border-slate-300 bg-white p-1"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="submit" size="sm">
              {editando ? t("cadastros.setores.salvar") : t("cadastros.setores.cadastrar")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setModalAberto(false)}>
              {t("cadastros.comum.fechar")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
