"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Edit3, Eye, MapPin, Percent, Plus, Trash2, UserRound } from "lucide-react";
import { BotoesListagemPrestadores } from "@/components/prestadores/BotoesListagemPrestadores";
import { ListaCarregando } from "@/components/ListaCarregando";
import { ListagemPorNome } from "@/components/listagem/listagem-por-nome";
import { ModuloCabecalho } from "@/components/ModuloCabecalho";
import { useI18n } from "@/components/i18n-provider";
import { compararTextoBr } from "@/lib/listagem-config";
import { exibirTelefone, formatarTelefone, PLACEHOLDER_TELEFONE_BR } from "@/lib/validar-documento";
import {
  exportarPrestadoresExcel,
  gerarListaPrestadoresPdf,
} from "@/lib/prestadores-lista-export";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import { Button, Input, Modal, Select } from "@/components/ui";
import { usePageReady } from "@/hooks/use-page-ready";
import { readStorageArray, writeStorage } from "@/lib/persisted-storage";

type Prestador = {
  id: string;
  nome: string;
  tipoServico: string;
  cpf: string;
  cnpj: string;
  email: string;
  telefoneResidencial: string;
  telefoneComercial: string;
  celular: string;
  whatsapp: string;
  valorComissao: string;
  descontoComissao: string;
  valorComissaoRepeticao: string;
  cep: string;
  rua: string;
  numero: string;
  cidade: string;
  uf: string;
  bairro: string;
  complemento: string;
};

const STORAGE_KEY = "labProtesePrestadores";
const EXCLUIDOS_STORAGE_KEY = "labProtesePrestadoresExcluidos";

const formularioVazio = {
  nome: "",
  tipoServico: "",
  cpf: "",
  cnpj: "",
  email: "",
  telefoneResidencial: "",
  telefoneComercial: "",
  celular: "",
  whatsapp: "",
  valorComissao: "0,00%",
  descontoComissao: "Não",
  valorComissaoRepeticao: "0,00%",
  cep: "",
  rua: "",
  numero: "",
  cidade: "",
  uf: "",
  bairro: "",
  complemento: "",
};

function formatCepInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5)}`;
}

function formatPercentInput(value: string) {
  const amount = Number(value.replace(/\D/g, "")) / 100;
  return `${amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function carregarLista<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  return readStorageArray(key, []);
}

export default function PrestadoresPage() {
  const { t } = useI18n();
  const [busca, setBusca] = useState("");
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [prestadoresExcluidos, setPrestadoresExcluidos] = useState<Prestador[]>([]);
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [visualizando, setVisualizando] = useState<Prestador | null>(null);
  const [editando, setEditando] = useState<Prestador | null>(null);
  const [form, setForm] = useState(formularioVazio);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [persistenciaPronta, setPersistenciaPronta] = useState(false);
  const [processandoLista, setProcessandoLista] = useState(false);
  const ultimoCepBuscado = useRef("");

  const paginaPronta = usePageReady(() => {
    setPrestadores(carregarLista(STORAGE_KEY));
    setPrestadoresExcluidos(carregarLista(EXCLUIDOS_STORAGE_KEY));
    setPersistenciaPronta(true);
  });

  useEffect(() => {
    if (!persistenciaPronta) return;
    writeStorage(STORAGE_KEY, prestadores);
  }, [prestadores, persistenciaPronta]);

  useEffect(() => {
    if (!persistenciaPronta) return;
    writeStorage(EXCLUIDOS_STORAGE_KEY, prestadoresExcluidos);
  }, [prestadoresExcluidos, persistenciaPronta]);

  useEffect(() => {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length === 8 && cep !== ultimoCepBuscado.current) {
      buscarEnderecoPorCep(form.cep);
    }
  }, [form.cep]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = mostrarExcluidos ? prestadoresExcluidos : prestadores;
    if (!termo) return lista;

    return lista.filter((prestador) =>
      [prestador.nome, prestador.tipoServico, prestador.celular, prestador.whatsapp, prestador.email]
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }, [busca, prestadores, prestadoresExcluidos, mostrarExcluidos]);

  function abrirNovo() {
    setEditando(null);
    setForm(formularioVazio);
    setModalAberto(true);
  }

  function abrirEdicao(prestador: Prestador) {
    setEditando(prestador);
    setForm({ ...formularioVazio, ...prestador });
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

  function salvarPrestador(event: React.FormEvent) {
    event.preventDefault();
    if (!form.nome.trim()) return;

    if (editando) {
      setPrestadores((atuais) =>
        atuais.map((prestador) =>
          prestador.id === editando.id ? { ...prestador, ...form } : prestador
        )
      );
    } else {
      setPrestadores((atuais) => [...atuais, { id: crypto.randomUUID(), ...form }]);
    }

    setModalAberto(false);
    setEditando(null);
    setForm(formularioVazio);
  }

  function excluirPrestador(id: string) {
    const prestador = prestadores.find((item) => item.id === id);
    if (prestador) {
      setPrestadoresExcluidos((atuais) => {
        const atualizados = [...atuais, prestador];
        writeStorage(EXCLUIDOS_STORAGE_KEY, atualizados);
        return atualizados;
      });
    }
    setPrestadores((atuais) => {
      const atualizados = atuais.filter((item) => item.id !== id);
      writeStorage(STORAGE_KEY, atualizados);
      return atualizados;
    });
  }

  function restaurarPrestador(id: string) {
    const prestador = prestadoresExcluidos.find((item) => item.id === id);
    if (prestador) setPrestadores((atuais) => [...atuais, prestador]);
    setPrestadoresExcluidos((atuais) => atuais.filter((item) => item.id !== id));
  }

  function removerPrestadorDefinitivo(id: string) {
    setPrestadoresExcluidos((atuais) => atuais.filter((item) => item.id !== id));
  }

  async function imprimirListaPrestadores() {
    if (!filtrados.length) {
      alert(t("cadastros.prestadores.alerta.semImprimir"));
      return;
    }
    setProcessandoLista(true);
    try {
      await abrirPdfGerando(
        () => gerarListaPrestadoresPdf(filtrados),
        "lista-prestadores.pdf",
        "Lista de Prestadores de Serviço Cadastrados"
      );
    } catch {
      alert(t("cadastros.comum.alerta.erroImprimir"));
    } finally {
      setProcessandoLista(false);
    }
  }

  async function exportarListaPrestadores() {
    if (!filtrados.length) {
      alert(t("cadastros.prestadores.alerta.semExportar"));
      return;
    }
    setProcessandoLista(true);
    try {
      await exportarPrestadoresExcel(filtrados);
    } catch {
      alert(t("cadastros.comum.alerta.erroExportar"));
    } finally {
      setProcessandoLista(false);
    }
  }

  return (
    <div className="space-y-4 text-xs text-slate-600">
      <ModuloCabecalho moduloKey="nav.cadastros" tituloKey="nav.prestadores" />

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={abrirNovo}
              className="inline-flex h-7 items-center gap-1 rounded-sm bg-emerald-500 px-3 text-[10px] font-semibold text-white hover:bg-emerald-600"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("cadastros.prestadores.adicionar")}
            </button>
            <button
              type="button"
              onClick={() => setMostrarExcluidos((atual) => !atual)}
              className="h-7 rounded-sm border border-slate-300 bg-white px-3 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              {mostrarExcluidos ? t("cadastros.comum.verAtivos") : t("cadastros.comum.verExcluidos")}
            </button>
            <BotoesListagemPrestadores
              onImprimir={() => void imprimirListaPrestadores()}
              onExportarExcel={() => void exportarListaPrestadores()}
              disabled={mostrarExcluidos}
              processando={processandoLista}
            />
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

        <ListagemPorNome
          storageKey="prestadores"
          itens={paginaPronta ? filtrados : []}
          opcoesExtras={[
            {
              valor: "tipoServico",
              label: "Tipo de Serviço",
              comparar: (a, b) => compararTextoBr(a.tipoServico, b.tipoServico),
            },
          ]}
        >
          {(itensPagina) => (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[10px]">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-slate-500">
                <th className="px-3 py-2 text-left font-semibold uppercase">Nome</th>
                <th className="px-3 py-2 text-left font-semibold uppercase">Tipo de Serviço</th>
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
              itensPagina.map((prestador) => {
                const aberto = visualizando?.id === prestador.id;
                return (
                  <Fragment key={prestador.id}>
                    <tr className={aberto ? "bg-blue-50/40" : "hover:bg-slate-50"}>
                      <td className="px-3 py-2 text-slate-700">{prestador.nome}</td>
                      <td className="px-3 py-2">{prestador.tipoServico}</td>
                      <td className="px-3 py-2">{exibirTelefone(prestador.celular)}</td>
                      <td className="px-3 py-2">{exibirTelefone(prestador.whatsapp)}</td>
                      <td className="px-3 py-2">{prestador.email}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center gap-1 text-slate-500">
                          <button
                            type="button"
                            onClick={() => setVisualizando(aberto ? null : prestador)}
                            className={`rounded p-1 hover:bg-blue-50 hover:text-blue-600 ${aberto ? "bg-blue-50 text-blue-500" : ""}`}
                            title="Visualizar"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                      <button
                        type="button"
                        onClick={() => abrirEdicao(prestador)}
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
                            onClick={() => restaurarPrestador(prestador.id)}
                            className="rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-600"
                          >
                            Restaurar
                          </button>
                          <button
                            type="button"
                            onClick={() => removerPrestadorDefinitivo(prestador.id)}
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                            title="Remover definitivamente"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => excluirPrestador(prestador.id)}
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
                              {prestador.nome}
                            </div>
                            <div className="grid gap-x-8 gap-y-3 border-b border-slate-100 pb-3 md:grid-cols-5">
                              <p><span className="font-semibold text-slate-700">Nome:</span> {prestador.nome}</p>
                              <p><span className="font-semibold text-slate-700">Tipo de Serviço:</span> {prestador.tipoServico}</p>
                              <p><span className="font-semibold text-slate-700">Celular:</span> {prestador.celular}</p>
                              <p><span className="font-semibold text-slate-700">WhatsApp:</span> {prestador.whatsapp}</p>
                              <p><span className="font-semibold text-slate-700">Email:</span> {prestador.email}</p>
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
                    {mostrarExcluidos ? "Nenhum prestador excluído." : "Nenhum prestador encontrado."}
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
        title={editando ? "Editar Prestador de Serviço" : "Cadastrar Prestador de Serviço"}
        size="xl"
      >
        <form onSubmit={salvarPrestador} className="space-y-5 text-[11px] text-slate-600">
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <UserRound className="h-3.5 w-3.5" />
              Dados do Prestador de Serviço
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Nome do Prestador *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              <Input label="Tipo de Serviço" value={form.tipoServico} onChange={(e) => setForm({ ...form, tipoServico: e.target.value })} />
              <Input label="CPF" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              <Input label="CNPJ" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Input label="Telefone Residencial" placeholder={PLACEHOLDER_TELEFONE_BR} value={form.telefoneResidencial} onChange={(e) => setForm({ ...form, telefoneResidencial: formatarTelefone(e.target.value) })} />
              <Input label="Telefone Comercial" placeholder={PLACEHOLDER_TELEFONE_BR} value={form.telefoneComercial} onChange={(e) => setForm({ ...form, telefoneComercial: formatarTelefone(e.target.value) })} />
              <Input label="Celular" placeholder={PLACEHOLDER_TELEFONE_BR} value={form.celular} onChange={(e) => setForm({ ...form, celular: formatarTelefone(e.target.value) })} />
              <Input label="WhatsApp" placeholder={PLACEHOLDER_TELEFONE_BR} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: formatarTelefone(e.target.value) })} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Percent className="h-3.5 w-3.5" />
              Comissão
            </h3>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                label="Valor da Comissão"
                value={form.valorComissao}
                onChange={(e) => setForm({ ...form, valorComissao: formatPercentInput(e.target.value) })}
              />
              <Select
                label="Desconto na comissão"
                value={form.descontoComissao}
                onChange={(e) => setForm({ ...form, descontoComissao: e.target.value })}
              >
                <option>Não</option>
                <option>Sim</option>
              </Select>
              <Input
                label="Valor da Comissão (Repetição)"
                value={form.valorComissaoRepeticao}
                onChange={(e) => setForm({ ...form, valorComissaoRepeticao: formatPercentInput(e.target.value) })}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <MapPin className="h-3.5 w-3.5" />
              Endereço
            </h3>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_2fr_1fr]">
              <Input label="CEP" value={form.cep} onChange={(e) => setForm({ ...form, cep: formatCepInput(e.target.value) })} />
              <button
                type="button"
                onClick={() => buscarEnderecoPorCep()}
                disabled={buscandoCep}
                className="mt-6 h-10 rounded border border-slate-300 px-3 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-60"
              >
                {buscandoCep ? "Buscando..." : "Buscar Endereço"}
              </button>
              <Input label="Rua" value={form.rua} onChange={(e) => setForm({ ...form, rua: e.target.value })} />
              <Input label="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
            </div>
            <div className="grid gap-3 md:grid-cols-[1.3fr_0.7fr_1.5fr_1fr]">
              <Input label="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
              <Input label="UF" value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase().slice(0, 2) })} />
              <Input label="Bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
              <Input label="Complemento" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
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

    </div>
  );
}
