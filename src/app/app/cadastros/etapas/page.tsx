"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { ListaCarregando } from "@/components/ListaCarregando";
import { ListagemPorNome } from "@/components/listagem/listagem-por-nome";
import { compararTextoBr } from "@/lib/listagem-config";
import { Button, Input, Modal, Select } from "@/components/ui";
import { usePageReady } from "@/hooks/use-page-ready";
import { corFundoEtapa, corTextoSobreFundo } from "@/lib/etapas-os";
import { readStorageArray, writeStorage } from "@/lib/persisted-storage";

type Setor = {
  id?: string;
  nome: string;
  cor: string;
};

type Etapa = {
  id: string;
  nome: string;
  setor: string;
  /** Cor hex da etapa; vazio/null indica "Sem Fundo". */
  cor: string;
  tempoMedio: string;
  calculoPorElemento: string;
  prazoDias?: string;
};

const STORAGE_KEY = "labProteseEtapas";
const EXCLUIDOS_STORAGE_KEY = "labProteseEtapasExcluidas";
const SETORES_STORAGE_KEY = "labProteseSetores";

const COR_ETAPA_PADRAO = "#f9a8d4";

const formularioVazio = {
  nome: "",
  setor: "",
  cor: COR_ETAPA_PADRAO,
  tempoMedio: "",
  calculoPorElemento: "Não",
  prazoDias: "",
};

function normalizarEtapa(etapa: Etapa, setores: Setor[]): Etapa {
  const setor = setores.find((s) => s.nome === etapa.setor);
  return {
    ...etapa,
    prazoDias: etapa.prazoDias ?? "",
    // Mantém vazio para etapas salvas como "Sem Fundo"
    cor: etapa.cor?.trim()
      ? etapa.cor
      : corFundoEtapa({ id: etapa.id, nome: etapa.nome, cor: "", setor: etapa.setor }, setor?.cor),
  };
}

function carregarLista<T>(key: string, fallback: T[]) {
  if (typeof window === "undefined") return fallback;
  return readStorageArray(key, fallback);
}

export default function EtapasPage() {
  const [busca, setBusca] = useState("");
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [etapasExcluidas, setEtapasExcluidas] = useState<Etapa[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [mostrarExcluidas, setMostrarExcluidas] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalSetorAberto, setModalSetorAberto] = useState(false);
  const [setoresCarregados, setSetoresCarregados] = useState(false);
  const [editando, setEditando] = useState<Etapa | null>(null);
  const [form, setForm] = useState(formularioVazio);
  const [novoSetor, setNovoSetor] = useState({ nome: "", cor: "#7c5cff" });
  const [persistenciaPronta, setPersistenciaPronta] = useState(false);

  const paginaPronta = usePageReady(() => {
    const setoresCarregados = carregarLista(SETORES_STORAGE_KEY, []);
    const etapasCarregadas = carregarLista<Etapa>(STORAGE_KEY, []).map((e) =>
      normalizarEtapa(e, setoresCarregados)
    );
    setEtapas(etapasCarregadas);
    setEtapasExcluidas(
      carregarLista<Etapa>(EXCLUIDOS_STORAGE_KEY, []).map((e) => normalizarEtapa(e, setoresCarregados))
    );
    setSetores(setoresCarregados);
    setSetoresCarregados(true);
    setPersistenciaPronta(true);
  });

  useEffect(() => {
    if (!paginaPronta) return;

    function recarregarSetores() {
      setSetores(carregarLista(SETORES_STORAGE_KEY, []));
      setSetoresCarregados(true);
    }

    window.addEventListener("focus", recarregarSetores);
    return () => window.removeEventListener("focus", recarregarSetores);
  }, [paginaPronta]);

  useEffect(() => {
    if (!persistenciaPronta) return;
    writeStorage(STORAGE_KEY, etapas);
  }, [etapas, persistenciaPronta]);

  useEffect(() => {
    if (!persistenciaPronta) return;
    writeStorage(EXCLUIDOS_STORAGE_KEY, etapasExcluidas);
  }, [etapasExcluidas, persistenciaPronta]);

  useEffect(() => {
    if (!setoresCarregados) return;
    writeStorage(SETORES_STORAGE_KEY, setores);
  }, [setores, setoresCarregados]);

  const filtradas = useMemo(() => {
    const lista = mostrarExcluidas ? etapasExcluidas : etapas;
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;

    return lista.filter((etapa) =>
      [etapa.nome, etapa.setor, etapa.tempoMedio, etapa.prazoDias, etapa.calculoPorElemento]
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }, [busca, etapas, etapasExcluidas, mostrarExcluidas]);

  function setorInfo(nome: string) {
    return setores.find((setor) => setor.nome === nome) || { nome, cor: "#ef4444" };
  }

  function corDaEtapa(etapa: Etapa) {
    if (!etapa.cor?.trim()) return "#ffffff";
    return corFundoEtapa(
      { id: etapa.id, nome: etapa.nome, cor: etapa.cor, setor: etapa.setor },
      setorInfo(etapa.setor).cor
    );
  }

  function abrirNovo() {
    setEditando(null);
    setForm(formularioVazio);
    setModalAberto(true);
  }

  function abrirEdicao(etapa: Etapa) {
    setEditando(etapa);
    setForm({
      nome: etapa.nome,
      setor: etapa.setor,
      cor: etapa.cor || "",
      tempoMedio: etapa.tempoMedio,
      calculoPorElemento: etapa.calculoPorElemento,
      prazoDias: etapa.prazoDias || "",
    });
    setModalAberto(true);
  }

  function salvarEtapa(event: React.FormEvent) {
    event.preventDefault();
    if (!form.nome.trim()) return;

    if (editando) {
      setEtapas((atuais) =>
        atuais.map((etapa) =>
          etapa.id === editando.id
            ? { ...etapa, ...form, nome: form.nome.trim(), cor: form.cor }
            : etapa
        )
      );
    } else {
      setEtapas((atuais) => [
        ...atuais,
        {
          id: crypto.randomUUID(),
          ...form,
          nome: form.nome.trim(),
          // Se marcado "Sem Fundo", salva vazio
          cor: form.cor === "__sem_fundo__" ? "" : form.cor,
        },
      ]);
    }

    setModalAberto(false);
    setEditando(null);
    setForm(formularioVazio);
  }

  function excluirEtapa(id: string) {
    const etapa = etapas.find((item) => item.id === id);
    if (etapa) {
      setEtapasExcluidas((atuais) => {
        const atualizados = [...atuais, etapa];
        writeStorage(EXCLUIDOS_STORAGE_KEY, atualizados);
        return atualizados;
      });
    }
    setEtapas((atuais) => {
      const atualizados = atuais.filter((item) => item.id !== id);
      writeStorage(STORAGE_KEY, atualizados);
      return atualizados;
    });
  }

  function restaurarEtapa(id: string) {
    const etapa = etapasExcluidas.find((item) => item.id === id);
    if (etapa) setEtapas((atuais) => [...atuais, etapa]);
    setEtapasExcluidas((atuais) => atuais.filter((item) => item.id !== id));
  }

  function removerEtapaDefinitivo(id: string) {
    setEtapasExcluidas((atuais) => atuais.filter((item) => item.id !== id));
  }

  function adicionarSetor(event: React.FormEvent) {
    event.preventDefault();
    const nome = novoSetor.nome.trim();
    if (!nome) return;

    const setor = { id: crypto.randomUUID(), nome, cor: novoSetor.cor };
    setSetores((atuais) => {
      if (atuais.some((item) => item.nome.toLowerCase() === nome.toLowerCase())) return atuais;
      const atualizados = [...atuais, setor];
      writeStorage(SETORES_STORAGE_KEY, atualizados);
      return atualizados;
    });
    setForm((current) => ({ ...current, setor: nome }));
    setNovoSetor({ nome: "", cor: "#7c5cff" });
    setModalSetorAberto(false);
  }

  return (
    <div className="space-y-4 text-xs text-slate-600">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Cadastros</span>
        <span>/</span>
        <span className="font-medium text-slate-700">Etapas</span>
      </div>

      <div className="rounded border border-orange-100 bg-orange-50 px-4 py-3 text-[11px] text-orange-700">
        <p className="font-semibold uppercase">Atenção</p>
        <p>
          Os modelos serão usados nas ordens de serviço para montar etapas. No entanto, as ordens de serviço que já foram lançadas com essas etapas não serão alteradas.
        </p>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={abrirNovo}
              className="inline-flex h-7 items-center gap-1 rounded-sm bg-emerald-500 px-3 text-[10px] font-semibold text-white hover:bg-emerald-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Etapa
            </button>
            <button
              type="button"
              onClick={() => setMostrarExcluidas((atual) => !atual)}
              className="h-7 rounded-sm border border-slate-300 bg-white px-3 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              {mostrarExcluidas ? "Ver Ativas" : "Ver Excluídas"}
            </button>
          </div>

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

        <ListagemPorNome
          storageKey="etapas"
          itens={paginaPronta ? filtradas : []}
          opcoesExtras={[
            {
              valor: "setor",
              label: "Setor",
              comparar: (a, b) => compararTextoBr(a.setor, b.setor),
            },
          ]}
        >
          {(itensPagina) => (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-[10px]">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-slate-500">
                <th className="px-3 py-2 text-left font-semibold uppercase">Nome</th>
                <th className="w-14 px-3 py-2 text-center font-semibold uppercase">Cor</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Setor</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Tempo Médio Execução Minutos</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Prazo (dias)</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Cálculo por Elemento</th>
                <th className="px-3 py-2 text-center font-semibold uppercase">Opções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {!paginaPronta ? (
                <ListaCarregando colSpan={7} />
              ) : (
              itensPagina.map((etapa) => {
                const setor = setorInfo(etapa.setor);
                const fundoNome = corDaEtapa(etapa);
                return (
                  <tr key={etapa.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-700">{etapa.nome}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className="inline-block h-5 w-5 rounded-sm border border-slate-300 shadow-inner"
                        style={{ backgroundColor: fundoNome }}
                        title={fundoNome}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex rounded px-2 py-0.5 text-[9px] font-semibold text-white"
                        style={{ backgroundColor: setor.cor }}
                      >
                        {etapa.setor || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{etapa.tempoMedio}</td>
                    <td className="px-3 py-2 text-slate-700">{etapa.prazoDias || "-"}</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-slate-500 px-2 py-0.5 text-[9px] font-semibold text-white">
                        {etapa.calculoPorElemento || "Não"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center gap-2 text-slate-500">
                        <button
                          type="button"
                          onClick={() => abrirEdicao(etapa)}
                          disabled={mostrarExcluidas}
                          className="rounded p-1 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-40"
                          title="Editar"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        {mostrarExcluidas ? (
                          <>
                            <button
                              type="button"
                              onClick={() => restaurarEtapa(etapa.id)}
                              className="rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-600"
                            >
                              Restaurar
                            </button>
                            <button
                              type="button"
                              onClick={() => removerEtapaDefinitivo(etapa.id)}
                              className="rounded p-1 text-red-500 hover:bg-red-50"
                              title="Remover definitivamente"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => excluirEtapa(etapa.id)}
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
              {paginaPronta && filtradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                    {mostrarExcluidas ? "Nenhuma etapa excluída." : "Nenhuma etapa encontrada."}
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
        title={editando ? "Editar Etapa" : "Cadastrar Etapa"}
        size="md"
      >
        <form onSubmit={salvarEtapa} className="grid gap-3 text-[11px] text-slate-600 md:grid-cols-2">
          <Input
            label="Nome"
            value={form.nome}
            onChange={(event) => setForm({ ...form, nome: event.target.value })}
            required
          />
          <div className="space-y-1 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700">
              Cor de fundo do nome
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={form.cor}
                onChange={(event) => setForm({ ...form, cor: event.target.value })}
                className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                title="Escolher cor"
              />
              <span
                className="inline-block h-10 w-10 shrink-0 rounded-lg border border-slate-300 shadow-inner"
                style={{ backgroundColor: form.cor }}
              />
              <span
                className="inline-flex min-h-[28px] items-center rounded px-2 py-1 text-[11px] font-medium"
                style={{
                  backgroundColor: form.cor,
                  color: corTextoSobreFundo(form.cor),
                }}
              >
                {form.nome.trim() || "Prévia do nome"}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-sm font-medium text-slate-700">Setor</label>
              <button
                type="button"
                onClick={() => setModalSetorAberto(true)}
                className="rounded bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-600"
              >
                + Adicionar Setor
              </button>
            </div>
            <div className="flex gap-2">
              <select
                value={form.setor}
                onChange={(event) => setForm({ ...form, setor: event.target.value })}
                className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                  form.setor ? "text-slate-700" : "text-slate-400"
                }`}
              >
                <option value="" hidden style={{ color: "#94a3b8" }}>Selecione</option>
                {setores.map((setor) => (
                  <option key={setor.id || setor.nome} value={setor.nome} style={{ color: "#334155" }}>
                    {setor.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <Input
              label="Tempo Médio Execução Minutos"
              type="number"
              min="0"
              value={form.tempoMedio}
              onChange={(event) => setForm({ ...form, tempoMedio: event.target.value })}
            />
            <button
              type="button"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  cor: current.cor === "__sem_fundo__" ? COR_ETAPA_PADRAO : "__sem_fundo__",
                }))
              }
              className={`mb-0.5 h-9 rounded border px-3 text-[11px] font-semibold ${
                form.cor === "__sem_fundo__"
                  ? "border-slate-400 bg-slate-100 text-slate-700"
                  : "border-slate-300 bg-white text-slate-500"
              }`}
            >
              {form.cor === "__sem_fundo__" ? "Sem Fundo (ativo)" : "Sem Fundo"}
            </button>
          </div>
          <Input
            label="Prazo em dias"
            type="number"
            min="0"
            value={form.prazoDias}
            onChange={(event) => setForm({ ...form, prazoDias: event.target.value })}
            placeholder="Ex.: 3"
          />
          <Select
            label="Cálculo por Elemento"
            value={form.calculoPorElemento}
            onChange={(event) => setForm({ ...form, calculoPorElemento: event.target.value })}
          >
            <option>Não</option>
            <option>Sim</option>
          </Select>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 md:col-span-2">
            <Button type="submit" size="sm">
              {editando ? "Salvar Etapa" : "Cadastrar Etapa"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setModalAberto(false)}>
              Fechar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modalSetorAberto}
        onClose={() => setModalSetorAberto(false)}
        title="Cadastrar Setor"
        size="sm"
      >
        <form onSubmit={adicionarSetor} className="space-y-4 text-[11px] text-slate-600">
          <Input
            label="Setor"
            value={novoSetor.nome}
            onChange={(event) => setNovoSetor((current) => ({ ...current, nome: event.target.value }))}
            placeholder="Digite o nome do Setor"
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Cor</label>
            <input
              type="color"
              value={novoSetor.cor}
              onChange={(event) => setNovoSetor((current) => ({ ...current, cor: event.target.value }))}
              className="h-9 w-full cursor-pointer rounded border border-slate-300 bg-white p-1"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="submit" size="sm">
              Cadastrar Setor
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setModalSetorAberto(false)}>
              Fechar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
