"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { ListaCarregando } from "@/components/ListaCarregando";
import { ListagemPorNome } from "@/components/listagem/listagem-por-nome";
import { Button, Input, Modal } from "@/components/ui";
import { usePageReady } from "@/hooks/use-page-ready";
import { readStorage, writeStorage } from "@/lib/persisted-storage";

const STORAGE_KEY = "labProteseMateriaisDentista";

const materiaisPadrao = [
  "Antagonista",
  "Articulador",
  "Barra Protocolo",
  "Componente Protético",
  "Dente",
  "Estrutura Metálica (PPR)",
  "Modelo de Gesso",
  "Mordida em cera",
  "Muralha de silicone",
  "Outros",
  "Parafuso Implante",
  "Ucla Personalizada",
  "Modelo De Trabalho",
  "Moldeira Sup",
  "Moldeira Inf",
];

function carregarMateriais() {
  if (typeof window === "undefined") return materiaisPadrao;
  const parsed = readStorage<string[] | null>(STORAGE_KEY, null);
  return Array.isArray(parsed) && parsed.length > 0 ? parsed : materiaisPadrao;
}

export default function MaterialDentistaPage() {
  const [busca, setBusca] = useState("");
  const [materiais, setMateriais] = useState<string[]>([]);
  const [materiaisCarregados, setMateriaisCarregados] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeMaterial, setNomeMaterial] = useState("");

  const paginaPronta = usePageReady(() => {
    setMateriais(carregarMateriais());
    setMateriaisCarregados(true);
  });

  useEffect(() => {
    if (!paginaPronta) return;

    function carregar() {
      setMateriais(carregarMateriais());
      setMateriaisCarregados(true);
    }

    window.addEventListener("focus", carregar);
    return () => window.removeEventListener("focus", carregar);
  }, [paginaPronta]);

  useEffect(() => {
    if (!materiaisCarregados) return;
    writeStorage(STORAGE_KEY, materiais);
  }, [materiais, materiaisCarregados]);

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

  function salvarMaterial(event: React.FormEvent) {
    event.preventDefault();
    const nome = nomeMaterial.trim();
    if (!nome) return;

    setMateriais((atuais) => {
      const semDuplicidade = atuais.filter(
        (material) =>
          material !== editando && material.toLowerCase() !== nome.toLowerCase()
      );
      return editando ? semDuplicidade.concat(nome) : [...semDuplicidade, nome];
    });
    setModalAberto(false);
    setEditando(null);
    setNomeMaterial("");
  }

  function excluirMaterial(material: string) {
    setMateriais((atuais) => atuais.filter((item) => item !== material));
  }

  return (
    <div className="space-y-4 text-xs text-slate-600">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Cadastros</span>
        <span>/</span>
        <span className="font-medium text-slate-700">Material Rec Dentista</span>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={abrirNovo}
            className="inline-flex h-7 items-center gap-1 rounded-sm bg-emerald-500 px-3 text-[10px] font-semibold text-white hover:bg-emerald-600"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Material
          </button>

          <div className="flex w-full max-w-xl items-center gap-1">
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Pesquisar"
              className="h-7 flex-1 rounded-sm border border-slate-200 px-3 text-[10px] outline-none focus:border-blue-400"
            />
            <button
              type="button"
              onClick={() => setBusca("")}
              className="h-7 rounded-sm bg-slate-500 px-3 text-[10px] font-semibold text-white hover:bg-slate-600"
            >
              Limpar
            </button>
          </div>
        </div>

        <ListagemPorNome storageKey="material-dentista" itens={itensListagem}>
          {(itensPagina) => (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-[10px]">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-slate-500">
                <th className="px-3 py-2 text-left font-semibold uppercase">Nome</th>
                <th className="px-3 py-2 text-center font-semibold uppercase">Opções</th>
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
