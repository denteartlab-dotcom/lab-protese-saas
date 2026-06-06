"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Edit3,
  Eye,
  FileSpreadsheet,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { ListaCarregando } from "@/components/ListaCarregando";
import { ListagemPorNome } from "@/components/listagem/listagem-por-nome";
import { compararTextoBr } from "@/lib/listagem-config";
import { Button, Input, Modal } from "@/components/ui";
import { usePageReady } from "@/hooks/use-page-ready";
import {
  carregarEntregadoresCadastro,
  carregarEntregadoresExcluidos,
  salvarEntregadoresCadastro,
  salvarEntregadoresExcluidos,
  type EntregadorCadastro,
} from "@/lib/entregadores-cadastro";

const formularioVazio = {
  nome: "",
  celular: "",
  whatsapp: "",
  email: "",
};

export default function EntregadoresPage() {
  const [busca, setBusca] = useState("");
  const [entregadores, setEntregadores] = useState<EntregadorCadastro[]>([]);
  const [entregadoresExcluidos, setEntregadoresExcluidos] = useState<EntregadorCadastro[]>([]);
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [visualizando, setVisualizando] = useState<EntregadorCadastro | null>(null);
  const [editando, setEditando] = useState<EntregadorCadastro | null>(null);
  const [form, setForm] = useState(formularioVazio);
  const [persistenciaPronta, setPersistenciaPronta] = useState(false);

  const paginaPronta = usePageReady(() => {
    setEntregadores(carregarEntregadoresCadastro());
    setEntregadoresExcluidos(carregarEntregadoresExcluidos());
    setPersistenciaPronta(true);
  });

  useEffect(() => {
    if (!persistenciaPronta) return;
    salvarEntregadoresCadastro(entregadores);
  }, [entregadores, persistenciaPronta]);

  useEffect(() => {
    if (!persistenciaPronta) return;
    salvarEntregadoresExcluidos(entregadoresExcluidos);
  }, [entregadoresExcluidos, persistenciaPronta]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = mostrarExcluidos ? entregadoresExcluidos : entregadores;
    if (!termo) return lista;
    return lista.filter((entregador) =>
      [entregador.nome, entregador.celular, entregador.whatsapp, entregador.email]
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }, [busca, entregadores, entregadoresExcluidos, mostrarExcluidos]);

  function abrirNovo() {
    setEditando(null);
    setForm(formularioVazio);
    setModalAberto(true);
  }

  function abrirEdicao(entregador: EntregadorCadastro) {
    setEditando(entregador);
    setForm({
      nome: entregador.nome,
      celular: entregador.celular,
      whatsapp: entregador.whatsapp,
      email: entregador.email,
    });
    setModalAberto(true);
  }

  function salvarEntregador(event: React.FormEvent) {
    event.preventDefault();
    if (!form.nome.trim()) return;

    if (editando) {
      setEntregadores((atuais) =>
        atuais.map((entregador) =>
          entregador.id === editando.id ? { ...entregador, ...form, nome: form.nome.trim() } : entregador
        )
      );
    } else {
      setEntregadores((atuais) => [
        ...atuais,
        {
          id: `ent-${Date.now()}`,
          nome: form.nome.trim(),
          celular: form.celular.trim(),
          whatsapp: form.whatsapp.trim(),
          email: form.email.trim(),
        },
      ]);
    }

    setModalAberto(false);
    setEditando(null);
    setForm(formularioVazio);
  }

  function excluirEntregador(id: string) {
    const entregador = entregadores.find((item) => item.id === id);
    if (entregador) {
      setEntregadoresExcluidos((atuais) => [...atuais, entregador]);
    }
    setEntregadores((atuais) => atuais.filter((item) => item.id !== id));
    if (visualizando?.id === id) setVisualizando(null);
  }

  function restaurarEntregador(id: string) {
    const entregador = entregadoresExcluidos.find((item) => item.id === id);
    if (entregador) setEntregadores((atuais) => [...atuais, entregador]);
    setEntregadoresExcluidos((atuais) => atuais.filter((item) => item.id !== id));
  }

  function removerEntregadorDefinitivo(id: string) {
    setEntregadoresExcluidos((atuais) => atuais.filter((item) => item.id !== id));
    if (visualizando?.id === id) setVisualizando(null);
  }

  return (
    <div className="space-y-4 text-xs text-slate-600">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-medium text-slate-700">Cadastros</h1>
        <span className="text-slate-300">/</span>
        <span>Entregadores</span>
      </div>

      <div className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={abrirNovo}
              className="inline-flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Entregador
            </button>
            <button
              type="button"
              onClick={() => setMostrarExcluidos((atual) => !atual)}
              className="inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
            >
              <Eye className="h-3.5 w-3.5" />
              {mostrarExcluidos ? "Ver Ativos" : "Ver Excluídos"}
            </button>
            <button
              type="button"
              title="Salvar"
              className="flex h-8 w-8 items-center justify-center rounded border border-[#93c5fd] bg-[#dbeafe] text-[#2563eb] hover:bg-[#bfdbfe]"
            >
              <Save className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Exportar"
              className="flex h-8 w-8 items-center justify-center rounded border border-[#86efac] bg-[#dcfce7] text-[#16a34a] hover:bg-[#bbf7d0]"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Imprimir"
              className="flex h-8 w-8 items-center justify-center rounded border border-[#93c5fd] bg-[#dbeafe] text-[#2563eb] hover:bg-[#bfdbfe]"
            >
              <Printer className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-w-[320px] max-w-lg flex-1 justify-end">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className="h-8 w-full rounded border border-slate-300 py-1 pl-8 pr-16 text-xs outline-none focus:border-primary-400"
                placeholder="Procurar"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setBusca("")}
                className="absolute right-0 top-0 h-8 rounded-r bg-slate-500 px-4 text-[11px] font-semibold text-white hover:bg-slate-600"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        <ListagemPorNome
          storageKey="entregadores"
          itens={paginaPronta ? filtrados : []}
          opcoesExtras={[
            {
              valor: "email",
              label: "E-mail",
              comparar: (a, b) => compararTextoBr(a.email, b.email),
            },
            {
              valor: "celular",
              label: "Celular",
              comparar: (a, b) => compararTextoBr(a.celular, b.celular),
            },
          ]}
        >
          {(itensPagina) => (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                    <th className="px-3 py-2 text-left font-semibold">NOME</th>
                    <th className="px-3 py-2 text-left font-semibold">CELULAR</th>
                    <th className="px-3 py-2 text-left font-semibold">WHATSAPP</th>
                    <th className="px-3 py-2 text-left font-semibold">EMAIL</th>
                    <th className="px-3 py-2 text-center font-semibold">OPÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!paginaPronta ? (
                    <ListaCarregando colSpan={5} />
                  ) : (
                    itensPagina.map((entregador) => {
                      const aberto = visualizando?.id === entregador.id;
                      return (
                        <Fragment key={entregador.id}>
                          <tr className={aberto ? "bg-blue-50/40" : "hover:bg-slate-50"}>
                            <td className="px-3 py-2 font-medium text-slate-600">{entregador.nome}</td>
                            <td className="px-3 py-2 text-slate-500">{entregador.celular || ""}</td>
                            <td className="px-3 py-2 text-slate-500">{entregador.whatsapp || ""}</td>
                            <td className="px-3 py-2 text-slate-500">{entregador.email || ""}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1 text-slate-500">
                                <button
                                  type="button"
                                  onClick={() => setVisualizando(aberto ? null : entregador)}
                                  className={`rounded p-1 hover:bg-blue-50 hover:text-blue-600 ${aberto ? "bg-blue-50 text-blue-500" : ""}`}
                                  title="Visualizar"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => abrirEdicao(entregador)}
                                  disabled={mostrarExcluidos}
                                  className="rounded p-1 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-40"
                                  title="Editar"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                {mostrarExcluidos ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => restaurarEntregador(entregador.id)}
                                      className="rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-600"
                                    >
                                      Restaurar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removerEntregadorDefinitivo(entregador.id)}
                                      className="rounded bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-red-600"
                                    >
                                      Excluir
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => excluirEntregador(entregador.id)}
                                    className="rounded p-1 text-red-500 hover:bg-red-50"
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {aberto ? (
                            <tr className="bg-white">
                              <td colSpan={5} className="px-3 py-3">
                                <div className="rounded border border-slate-100 bg-white p-3 text-[10px] text-slate-600">
                                  <div className="mb-3 flex items-center gap-2 font-semibold text-emerald-600">
                                    <Eye className="h-3.5 w-3.5" />
                                    {entregador.nome}
                                  </div>
                                  <div className="grid gap-x-8 gap-y-3 border-b border-slate-100 pb-3 md:grid-cols-4">
                                    <p>
                                      <span className="font-semibold text-slate-700">Nome:</span>{" "}
                                      {entregador.nome}
                                    </p>
                                    <p>
                                      <span className="font-semibold text-slate-700">Celular:</span>{" "}
                                      {entregador.celular || "—"}
                                    </p>
                                    <p>
                                      <span className="font-semibold text-slate-700">WhatsApp:</span>{" "}
                                      {entregador.whatsapp || "—"}
                                    </p>
                                    <p>
                                      <span className="font-semibold text-slate-700">Email:</span>{" "}
                                      {entregador.email || "—"}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setVisualizando(null)}
                                    className="mt-3 rounded border border-slate-300 bg-white px-3 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                                  >
                                    Fechar Detalhes
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                  {paginaPronta && filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-slate-400">
                        {mostrarExcluidos
                          ? "Nenhum entregador excluído."
                          : "Nenhum entregador encontrado."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </ListagemPorNome>
      </div>

      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? "Editar Entregador" : "Cadastrar Entregador"}
        size="lg"
      >
        <form onSubmit={salvarEntregador} className="space-y-4 text-[11px] text-slate-600">
          <h3 className="flex items-center gap-2 border-b border-slate-100 pb-2 text-xs font-semibold text-slate-700">
            <Truck className="h-3.5 w-3.5" />
            Dados do Entregador
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Nome *"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
            />
            <Input
              label="Celular"
              value={form.celular}
              onChange={(e) => setForm({ ...form, celular: e.target.value })}
            />
            <Input
              label="WhatsApp"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="flex justify-start gap-2 border-t border-slate-100 pt-4">
            <Button type="submit" size="sm">
              {editando ? "Salvar" : "Cadastrar"}
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
