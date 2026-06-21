"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Edit3, Eye, MapPin, Plus, Trash2, UserRound } from "lucide-react";
import { BotoesListagemFornecedores } from "@/components/fornecedores/BotoesListagemFornecedores";
import { ImportarFornecedoresExcelModal } from "@/components/fornecedores/ImportarFornecedoresExcelModal";
import { ListaCarregando } from "@/components/ListaCarregando";
import { ListagemPorNome } from "@/components/listagem/listagem-por-nome";
import { compararTextoBr } from "@/lib/listagem-config";
import {
  exportarFornecedoresExcel,
  gerarListaFornecedoresPdf,
} from "@/lib/fornecedores-lista-export";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import { Button, Input, Modal } from "@/components/ui";
import { usePageReady } from "@/hooks/use-page-ready";
import {
  aplicarEspelhoContatoCadastro,
  ESPELHOS_CONTATO_FORNECEDOR,
  type CampoContatoPrincipal,
} from "@/lib/espelhar-contato-cadastro";
import {
  persistirArmazenamentoImediato,
  readStorageArray,
  writeStorage,
} from "@/lib/persisted-storage";

type Fornecedor = {
  id: string;
  nome: string;
  contato: string;
  celular: string;
  whatsapp: string;
  email: string;
  cpf?: string;
  cnpj?: string;
  categoria?: string;
  telefoneResidencial?: string;
  telefoneComercial?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  cidade?: string;
  uf?: string;
  bairro?: string;
  complemento?: string;
  representanteTelefoneComercial?: string;
  representanteWhatsapp?: string;
  representanteEmail?: string;
};

const STORAGE_KEY = "labProteseFornecedores";
const EXCLUIDOS_STORAGE_KEY = "labProteseFornecedoresExcluidos";
const CATEGORIAS_STORAGE_KEY = "labProteseCategoriasFornecedores";

const formularioVazio = {
  nome: "",
  cpf: "",
  cnpj: "",
  categoria: "",
  telefoneResidencial: "",
  telefoneComercial: "",
  celular: "",
  whatsapp: "",
  email: "",
  cep: "",
  rua: "",
  numero: "",
  cidade: "",
  uf: "",
  bairro: "",
  complemento: "",
  contato: "",
  representanteTelefoneComercial: "",
  representanteWhatsapp: "",
  representanteEmail: "",
};

function formatCepInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5)}`;
}

function carregarFornecedores() {
  if (typeof window === "undefined") return [];
  return readStorageArray(STORAGE_KEY, []);
}

function carregarFornecedoresExcluidos() {
  if (typeof window === "undefined") return [];
  return readStorageArray(EXCLUIDOS_STORAGE_KEY, []);
}

function carregarCategorias() {
  if (typeof window === "undefined") return [];
  return readStorageArray(CATEGORIAS_STORAGE_KEY, []);
}

export default function FornecedoresPage() {
  const [busca, setBusca] = useState("");
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornecedoresExcluidos, setFornecedoresExcluidos] = useState<Fornecedor[]>([]);
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [visualizando, setVisualizando] = useState<Fornecedor | null>(null);
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState(formularioVazio);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [persistenciaPronta, setPersistenciaPronta] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);
  const [processandoLista, setProcessandoLista] = useState(false);
  const ultimoCepBuscado = useRef("");

  const paginaPronta = usePageReady(() => {
    setFornecedores(carregarFornecedores());
    setFornecedoresExcluidos(carregarFornecedoresExcluidos());
    setCategorias(carregarCategorias());
    setPersistenciaPronta(true);
  });

  useEffect(() => {
    if (!persistenciaPronta) return;
    writeStorage(STORAGE_KEY, fornecedores);
  }, [fornecedores, persistenciaPronta]);

  useEffect(() => {
    if (!persistenciaPronta) return;
    writeStorage(EXCLUIDOS_STORAGE_KEY, fornecedoresExcluidos);
  }, [fornecedoresExcluidos, persistenciaPronta]);

  useEffect(() => {
    if (!persistenciaPronta) return;
    writeStorage(CATEGORIAS_STORAGE_KEY, categorias);
  }, [categorias, persistenciaPronta]);

  useEffect(() => {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length === 8 && cep !== ultimoCepBuscado.current) {
      buscarEnderecoPorCep(form.cep);
    }
  }, [form.cep]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = mostrarExcluidos ? fornecedoresExcluidos : fornecedores;
    if (!termo) return lista;

    return lista.filter((fornecedor) =>
      [fornecedor.nome, fornecedor.contato, fornecedor.celular, fornecedor.whatsapp, fornecedor.email]
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }, [busca, fornecedores, fornecedoresExcluidos, mostrarExcluidos]);

  function abrirNovoFornecedor() {
    setEditando(null);
    setForm(formularioVazio);
    setModalAberto(true);
  }

  function atualizarFornecedorEspelhandoRepresentante(campo: CampoContatoPrincipal, valor: string) {
    setForm((atual) => aplicarEspelhoContatoCadastro(atual, campo, valor, ESPELHOS_CONTATO_FORNECEDOR));
  }

  function abrirEdicao(fornecedor: Fornecedor) {
    setEditando(fornecedor);
    setForm({
      nome: fornecedor.nome,
      cpf: fornecedor.cpf || "",
      cnpj: fornecedor.cnpj || "",
      categoria: fornecedor.categoria || "",
      telefoneResidencial: fornecedor.telefoneResidencial || "",
      telefoneComercial: fornecedor.telefoneComercial || "",
      celular: fornecedor.celular,
      whatsapp: fornecedor.whatsapp,
      email: fornecedor.email,
      cep: fornecedor.cep || "",
      rua: fornecedor.rua || "",
      numero: fornecedor.numero || "",
      cidade: fornecedor.cidade || "",
      uf: fornecedor.uf || "",
      bairro: fornecedor.bairro || "",
      complemento: fornecedor.complemento || "",
      contato: fornecedor.contato,
      representanteTelefoneComercial: fornecedor.representanteTelefoneComercial || "",
      representanteWhatsapp: fornecedor.representanteWhatsapp || "",
      representanteEmail: fornecedor.representanteEmail || "",
    });
    setModalAberto(true);
  }

  async function buscarEnderecoPorCep(cepInformado = form.cep) {
    const cep = cepInformado.replace(/\D/g, "");
    if (cep.length !== 8) return;

    ultimoCepBuscado.current = cep;
    setBuscandoCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setForm((current) => ({
          ...current,
          rua: data.logradouro || current.rua,
          bairro: data.bairro || current.bairro,
          cidade: data.localidade || current.cidade,
          uf: data.uf || current.uf,
        }));
      }
    } finally {
      setBuscandoCep(false);
    }
  }

  function salvarFornecedor(event: React.FormEvent) {
    event.preventDefault();
    if (!form.nome.trim()) return;

    if (editando) {
      setFornecedores((atuais) =>
        atuais.map((fornecedor) =>
          fornecedor.id === editando.id ? { ...fornecedor, ...form } : fornecedor
        )
      );
    } else {
      setFornecedores((atuais) => [
        ...atuais,
        {
          id: crypto.randomUUID(),
          ...form,
        },
      ]);
    }

    setModalAberto(false);
    setEditando(null);
    setForm(formularioVazio);
  }

  function excluirFornecedor(id: string) {
    const fornecedor = fornecedores.find((item) => item.id === id);
    if (fornecedor) {
      setFornecedoresExcluidos((atuais) => {
        const atualizados = [...atuais, fornecedor];
        writeStorage(EXCLUIDOS_STORAGE_KEY, atualizados);
        return atualizados;
      });
    }
    setFornecedores((atuais) => {
      const atualizados = atuais.filter((item) => item.id !== id);
      writeStorage(STORAGE_KEY, atualizados);
      return atualizados;
    });
  }

  function restaurarFornecedor(id: string) {
    const fornecedor = fornecedoresExcluidos.find((item) => item.id === id);
    if (fornecedor) {
      setFornecedores((atuais) => [...atuais, fornecedor]);
    }
    setFornecedoresExcluidos((atuais) => atuais.filter((fornecedor) => fornecedor.id !== id));
  }

  function removerFornecedorDefinitivo(id: string) {
    setFornecedoresExcluidos((atuais) => atuais.filter((fornecedor) => fornecedor.id !== id));
  }

  function adicionarCategoria(event: React.FormEvent) {
    event.preventDefault();
    const nome = novaCategoria.trim();
    if (!nome) return;

    setCategorias((atuais) => {
      if (atuais.some((categoria) => categoria.toLowerCase() === nome.toLowerCase())) return atuais;
      return [...atuais, nome];
    });
    setForm((current) => ({ ...current, categoria: nome }));
    setNovaCategoria("");
    setModalCategoriaAberto(false);
  }

  function removerCategoria(nome: string) {
    if (!nome) return;
    setCategorias((atuais) => atuais.filter((categoria) => categoria !== nome));
    setForm((current) => ({
      ...current,
      categoria: current.categoria === nome ? "" : current.categoria,
    }));
  }

  async function imprimirListaFornecedores() {
    if (!filtrados.length) {
      alert("Não há fornecedores para imprimir.");
      return;
    }
    setProcessandoLista(true);
    try {
      await abrirPdfGerando(
        () => gerarListaFornecedoresPdf(filtrados),
        "lista-fornecedores.pdf",
        "Lista de Fornecedores Cadastrados"
      );
    } catch {
      alert("Não foi possível gerar a impressão.");
    } finally {
      setProcessandoLista(false);
    }
  }

  async function exportarListaFornecedores() {
    if (!filtrados.length) {
      alert("Não há fornecedores para exportar.");
      return;
    }
    setProcessandoLista(true);
    try {
      await exportarFornecedoresExcel(filtrados);
    } catch {
      alert("Não foi possível exportar a planilha.");
    } finally {
      setProcessandoLista(false);
    }
  }

  function importarFornecedores(novos: Array<Fornecedor & { id: string }>) {
    setFornecedores((atuais) => {
      const atualizados = [...atuais, ...novos];
      void persistirArmazenamentoImediato(STORAGE_KEY, atualizados);
      return atualizados;
    });
  }

  return (
    <div className="space-y-4 text-xs text-slate-600">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Cadastros</span>
        <span>/</span>
        <span className="font-medium text-slate-700">Fornecedores</span>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={abrirNovoFornecedor}
              className="inline-flex h-7 items-center gap-1 rounded-sm bg-emerald-500 px-3 text-[10px] font-semibold text-white hover:bg-emerald-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Fornecedor
            </button>
            <button
              type="button"
              onClick={() => setMostrarExcluidos((atual) => !atual)}
              className="h-7 rounded-sm border border-slate-300 bg-white px-3 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              {mostrarExcluidos ? "Ver Ativos" : "Ver Excluídos"}
            </button>
            <BotoesListagemFornecedores
              onImprimir={() => void imprimirListaFornecedores()}
              onImportar={() => setImportarAberto(true)}
              onExportarExcel={() => void exportarListaFornecedores()}
              disabled={mostrarExcluidos}
              processando={processandoLista}
            />
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
          storageKey="fornecedores"
          itens={paginaPronta ? filtrados : []}
          opcoesExtras={[
            {
              valor: "email",
              label: "E-mail",
              comparar: (a, b) => compararTextoBr(a.email, b.email),
            },
          ]}
        >
          {(itensPagina) => (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[10px]">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-slate-500">
                <th className="px-3 py-2 text-left font-semibold uppercase">Nome</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Contato</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Celular</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">WhatsApp</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Email</th>
                <th className="px-3 py-2 text-center font-semibold uppercase">Opções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {!paginaPronta ? (
                <ListaCarregando colSpan={6} />
              ) : (
              itensPagina.map((fornecedor) => {
                const aberto = visualizando?.id === fornecedor.id;
                return (
                  <Fragment key={fornecedor.id}>
                    <tr className={aberto ? "bg-blue-50/40" : "hover:bg-slate-50"}>
                      <td className="px-3 py-2 text-slate-700">{fornecedor.nome}</td>
                      <td className="px-3 py-2">{fornecedor.contato}</td>
                      <td className="px-3 py-2">{fornecedor.celular}</td>
                      <td className="px-3 py-2">{fornecedor.whatsapp}</td>
                      <td className="px-3 py-2">{fornecedor.email}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center gap-1 text-slate-500">
                          <button
                            type="button"
                            onClick={() => setVisualizando(aberto ? null : fornecedor)}
                            className={`rounded p-1 hover:bg-blue-50 hover:text-blue-600 ${aberto ? "bg-blue-50 text-blue-500" : ""}`}
                            title="Visualizar"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                      <button
                        type="button"
                        onClick={() => abrirEdicao(fornecedor)}
                        disabled={mostrarExcluidos}
                        className="rounded p-1 hover:bg-slate-100 hover:text-blue-600"
                        title="Editar"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      {mostrarExcluidos ? (
                        <>
                          <button
                            type="button"
                            onClick={() => restaurarFornecedor(fornecedor.id)}
                            className="rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-600"
                            title="Restaurar"
                          >
                            Restaurar
                          </button>
                          <button
                            type="button"
                            onClick={() => removerFornecedorDefinitivo(fornecedor.id)}
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                            title="Remover definitivamente"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => excluirFornecedor(fornecedor.id)}
                          className="rounded bg-orange-400 px-1.5 py-0.5 text-white hover:bg-orange-500"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                        </div>
                      </td>
                    </tr>
                    {aberto && (
                      <tr className="bg-white">
                        <td colSpan={6} className="px-3 py-3">
                          <div className="rounded border border-slate-100 bg-white p-3 text-[10px] text-slate-600">
                            <div className="mb-3 flex items-center gap-2 font-semibold text-emerald-600">
                              <Eye className="h-3.5 w-3.5" />
                              {fornecedor.nome}
                            </div>
                            <div className="grid gap-x-8 gap-y-3 border-b border-slate-100 pb-3 md:grid-cols-5">
                              <p><span className="font-semibold text-slate-700">Nome:</span> {fornecedor.nome}</p>
                              <p><span className="font-semibold text-slate-700">Contato:</span> {fornecedor.contato}</p>
                              <p><span className="font-semibold text-slate-700">Celular:</span> {fornecedor.celular}</p>
                              <p><span className="font-semibold text-slate-700">WhatsApp:</span> {fornecedor.whatsapp}</p>
                              <p><span className="font-semibold text-slate-700">Email:</span> {fornecedor.email}</p>
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
                    )}
                  </Fragment>
                );
              })
              )}
              {paginaPronta && filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    {mostrarExcluidos ? "Nenhum fornecedor excluído." : "Nenhum fornecedor encontrado."}
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
        title={editando ? "Editar Fornecedor" : "Cadastrar Fornecedor"}
        size="xl"
      >
        <form onSubmit={salvarFornecedor} className="space-y-5 text-[11px] text-slate-600">
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <UserRound className="h-3.5 w-3.5" />
              Dados do Fornecedor
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Nome do Fornecedor *"
                value={form.nome}
                onChange={(event) => setForm({ ...form, nome: event.target.value })}
                required
              />
              <Input
                label="CPF"
                value={form.cpf}
                onChange={(event) => setForm({ ...form, cpf: event.target.value })}
              />
              <Input
                label="CNPJ"
                value={form.cnpj}
                onChange={(event) => setForm({ ...form, cnpj: event.target.value })}
              />
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-slate-700">Categoria</label>
                  <button
                    type="button"
                    onClick={() => setModalCategoriaAberto(true)}
                    className="rounded bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-600"
                  >
                    + Adicionar Categoria
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    value={form.categoria}
                    onChange={(event) => setForm({ ...form, categoria: event.target.value })}
                    className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                      form.categoria ? "text-slate-700" : "text-slate-400"
                    }`}
                  >
                    <option value="" hidden style={{ color: "#94a3b8" }}>Selecione</option>
                    {categorias.map((categoria) => (
                      <option key={categoria} value={categoria} style={{ color: "#334155" }}>
                        {categoria}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removerCategoria(form.categoria)}
                    disabled={!form.categoria}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Remover categoria selecionada"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(event) => atualizarFornecedorEspelhandoRepresentante("email", event.target.value)}
                className="md:col-span-2"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                label="Telefone Residencial"
                value={form.telefoneResidencial}
                onChange={(event) => setForm({ ...form, telefoneResidencial: event.target.value })}
              />
              <Input
                label="Telefone Comercial"
                value={form.telefoneComercial}
                onChange={(event) =>
                  atualizarFornecedorEspelhandoRepresentante("telefoneComercial", event.target.value)
                }
              />
              <Input
                label="Celular"
                value={form.celular}
                onChange={(event) => setForm({ ...form, celular: event.target.value })}
              />
              <Input
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(event) => atualizarFornecedorEspelhandoRepresentante("whatsapp", event.target.value)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <MapPin className="h-3.5 w-3.5" />
              Endereço
            </h3>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_2fr_1fr]">
              <Input
                label="CEP"
                value={form.cep}
                onChange={(event) => setForm({ ...form, cep: formatCepInput(event.target.value) })}
              />
              <button
                type="button"
                onClick={() => void buscarEnderecoPorCep()}
                disabled={buscandoCep}
                className="mt-6 h-10 rounded border border-slate-300 px-3 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-60"
              >
                {buscandoCep ? "Buscando..." : "Buscar Endereço"}
              </button>
              <Input
                label="Rua"
                value={form.rua}
                onChange={(event) => setForm({ ...form, rua: event.target.value })}
              />
              <Input
                label="Número"
                value={form.numero}
                onChange={(event) => setForm({ ...form, numero: event.target.value })}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[1.3fr_0.7fr_1.5fr_1fr]">
              <Input
                label="Cidade"
                value={form.cidade}
                onChange={(event) => setForm({ ...form, cidade: event.target.value })}
              />
              <Input
                label="UF"
                value={form.uf}
                onChange={(event) => setForm({ ...form, uf: event.target.value.toUpperCase().slice(0, 2) })}
              />
              <Input
                label="Bairro"
                value={form.bairro}
                onChange={(event) => setForm({ ...form, bairro: event.target.value })}
              />
              <Input
                label="Complemento"
                value={form.complemento}
                onChange={(event) => setForm({ ...form, complemento: event.target.value })}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <UserRound className="h-3.5 w-3.5" />
              Contato do Representante
            </h3>
            <div className="grid gap-3 md:grid-cols-[1.3fr_0.8fr_0.8fr_1.5fr]">
              <Input
                label="Contato"
                value={form.contato}
                onChange={(event) => setForm({ ...form, contato: event.target.value })}
              />
              <Input
                label="Telefone Comercial"
                value={form.representanteTelefoneComercial}
                onChange={(event) => setForm({ ...form, representanteTelefoneComercial: event.target.value })}
              />
              <Input
                label="WhatsApp"
                value={form.representanteWhatsapp}
                onChange={(event) => setForm({ ...form, representanteWhatsapp: event.target.value })}
              />
              <Input
                label="Email"
                type="email"
                value={form.representanteEmail}
                onChange={(event) => setForm({ ...form, representanteEmail: event.target.value })}
              />
            </div>
          </section>

          <div className="flex justify-start gap-2 border-t border-slate-100 pt-4">
            <Button type="submit" size="sm">{editando ? "Salvar" : "Cadastrar"}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setModalAberto(false)}>
              Fechar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modalCategoriaAberto}
        onClose={() => setModalCategoriaAberto(false)}
        title="Adicionar Categoria"
        size="sm"
      >
        <form onSubmit={adicionarCategoria} className="space-y-4">
          <Input
            label="Nome da Categoria"
            value={novaCategoria}
            onChange={(event) => setNovaCategoria(event.target.value)}
            placeholder="Digite o nome da categoria"
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalCategoriaAberto(false)}>
              Fechar
            </Button>
            <Button type="submit">Adicionar</Button>
          </div>
        </form>
      </Modal>

      <ImportarFornecedoresExcelModal
        aberto={importarAberto}
        onFechar={() => setImportarAberto(false)}
        onImportado={importarFornecedores}
        nomesExistentes={fornecedores.map((fornecedor) => fornecedor.nome)}
      />
    </div>
  );
}

