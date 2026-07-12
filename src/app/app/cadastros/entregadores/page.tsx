"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Edit3, Eye, MapPin, Plus, Search, Trash2, User } from "lucide-react";
import { BotoesListagemEntregadores } from "@/components/entregadores/BotoesListagemEntregadores";
import { ListaCarregando } from "@/components/ListaCarregando";
import { ListagemPorNome } from "@/components/listagem/listagem-por-nome";
import { ModuloCabecalho } from "@/components/ModuloCabecalho";
import { useI18n } from "@/components/i18n-provider";
import { compararTextoBr } from "@/lib/listagem-config";
import { exibirTelefone, formatarTelefone, PLACEHOLDER_TELEFONE_BR } from "@/lib/validar-documento";
import { Modal } from "@/components/ui";
import { usePageReady } from "@/hooks/use-page-ready";
import { formatarCepEntrega, TIPOS_ENTREGADOR } from "@/lib/controle-entregas";
import {
  exportarEntregadoresExcel,
  gerarListaEntregadoresPdf,
} from "@/lib/entregadores-lista-export";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import {
  carregarEntregadoresCadastro,
  carregarEntregadoresExcluidos,
  formularioEntregadorVazio,
  salvarEntregadoresCadastro,
  salvarEntregadoresExcluidos,
  type EntregadorCadastro,
} from "@/lib/entregadores-cadastro";

type FormEntregador = Omit<EntregadorCadastro, "id">;

function labelCampo(texto: string) {
  return <span className="mb-0.5 block text-[11px] text-slate-600">{texto}</span>;
}

function inputClassName() {
  return "h-8 w-full rounded border border-[#d1d5db] bg-white px-2 text-[11px] text-slate-700 focus:border-blue-500 focus:outline-none";
}

function selectClassName() {
  return inputClassName();
}

function tituloSecao(icon: React.ReactNode, texto: string) {
  return (
    <h3 className="flex items-center gap-2 border-b border-slate-100 pb-2 text-xs font-semibold text-slate-700">
      {icon}
      {texto}
    </h3>
  );
}

export default function EntregadoresPage() {
  const { t } = useI18n();
  const [busca, setBusca] = useState("");
  const [entregadores, setEntregadores] = useState<EntregadorCadastro[]>([]);
  const [entregadoresExcluidos, setEntregadoresExcluidos] = useState<EntregadorCadastro[]>([]);
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [visualizando, setVisualizando] = useState<EntregadorCadastro | null>(null);
  const [editando, setEditando] = useState<EntregadorCadastro | null>(null);
  const [form, setForm] = useState<FormEntregador>(formularioEntregadorVazio);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [persistenciaPronta, setPersistenciaPronta] = useState(false);
  const [processandoLista, setProcessandoLista] = useState(false);
  const ultimoCepBuscado = useRef("");

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

  useEffect(() => {
    if (!modalAberto) return;
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length === 8 && cep !== ultimoCepBuscado.current) {
      void buscarEnderecoPorCep(form.cep);
    }
  }, [form.cep, modalAberto]);

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
    ultimoCepBuscado.current = "";
    setForm(formularioEntregadorVazio());
    setModalAberto(true);
  }

  function abrirEdicao(entregador: EntregadorCadastro) {
    setEditando(entregador);
    ultimoCepBuscado.current = (entregador.cep || "").replace(/\D/g, "");
    setForm({
      nome: entregador.nome,
      tipoEntregador: entregador.tipoEntregador || "Motoboy",
      cpf: entregador.cpf,
      cnpj: entregador.cnpj,
      email: entregador.email,
      telefoneResidencial: entregador.telefoneResidencial,
      telefoneComercial: entregador.telefoneComercial,
      celular: entregador.celular,
      whatsapp: entregador.whatsapp,
      cep: entregador.cep,
      rua: entregador.rua,
      numero: entregador.numero,
      cidade: entregador.cidade,
      uf: entregador.uf,
      bairro: entregador.bairro,
      complemento: entregador.complemento,
    });
    setModalAberto(true);
  }

  async function buscarEnderecoPorCep(cepInformado = form.cep) {
    const cep = cepInformado.replace(/\D/g, "");
    if (cep.length !== 8) return;

    ultimoCepBuscado.current = cep;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        alert(t("cadastros.comum.alerta.cepNaoEncontrado"));
        return;
      }
      setForm((atual) => ({
        ...atual,
        rua: data.logradouro || atual.rua,
        bairro: data.bairro || atual.bairro,
        cidade: data.localidade || atual.cidade,
        uf: data.uf || atual.uf,
        complemento: data.complemento || atual.complemento,
      }));
    } finally {
      setBuscandoCep(false);
    }
  }

  function salvarEntregador(event: React.FormEvent) {
    event.preventDefault();
    if (!form.nome.trim()) return;

    const payload: EntregadorCadastro = {
      id: editando?.id || `ent-${Date.now()}`,
      nome: form.nome.trim(),
      tipoEntregador: form.tipoEntregador.trim() || "Motoboy",
      cpf: form.cpf.trim(),
      cnpj: form.cnpj.trim(),
      email: form.email.trim(),
      telefoneResidencial: form.telefoneResidencial.trim(),
      telefoneComercial: form.telefoneComercial.trim(),
      celular: form.celular.trim(),
      whatsapp: form.whatsapp.trim(),
      cep: form.cep.trim(),
      rua: form.rua.trim(),
      numero: form.numero.trim(),
      cidade: form.cidade.trim(),
      uf: form.uf.trim(),
      bairro: form.bairro.trim(),
      complemento: form.complemento.trim(),
    };

    if (editando) {
      setEntregadores((atuais) =>
        atuais.map((entregador) => (entregador.id === editando.id ? payload : entregador))
      );
    } else {
      setEntregadores((atuais) => [...atuais, payload]);
    }

    setModalAberto(false);
    setEditando(null);
    setForm(formularioEntregadorVazio());
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

  async function imprimirListaEntregadores() {
    if (!filtrados.length) {
      alert(t("cadastros.entregadores.alerta.semImprimir"));
      return;
    }
    setProcessandoLista(true);
    try {
      await abrirPdfGerando(
        () => gerarListaEntregadoresPdf(filtrados),
        "lista-entregadores.pdf",
        t("cadastros.entregadores.pdfTitulo")
      );
    } catch {
      alert(t("cadastros.comum.alerta.erroImprimir"));
    } finally {
      setProcessandoLista(false);
    }
  }

  async function exportarListaEntregadores() {
    if (!filtrados.length) {
      alert(t("cadastros.entregadores.alerta.semExportar"));
      return;
    }
    setProcessandoLista(true);
    try {
      await exportarEntregadoresExcel(filtrados);
    } catch {
      alert(t("cadastros.comum.alerta.erroExportar"));
    } finally {
      setProcessandoLista(false);
    }
  }

  return (
    <div className="space-y-4 text-xs text-slate-600">
      <ModuloCabecalho moduloKey="nav.cadastros" tituloKey="nav.entregadores" />

      <div className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={abrirNovo}
              className="inline-flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("cadastros.entregadores.adicionar")}
            </button>
            <button
              type="button"
              onClick={() => setMostrarExcluidos((atual) => !atual)}
              className="inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
            >
              <Eye className="h-3.5 w-3.5" />
              {mostrarExcluidos ? t("cadastros.comum.verAtivos") : t("cadastros.comum.verExcluidos")}
            </button>
            <BotoesListagemEntregadores
              onImprimir={() => void imprimirListaEntregadores()}
              onExportarExcel={() => void exportarListaEntregadores()}
              disabled={mostrarExcluidos}
              processando={processandoLista}
            />
          </div>

          <div className="flex min-w-[320px] max-w-lg flex-1 justify-end">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className="h-8 w-full rounded border border-slate-300 py-1 pl-8 pr-16 text-xs outline-none focus:border-primary-400"
                placeholder={t("cadastros.comum.procurar")}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setBusca("")}
                className="absolute right-0 top-0 h-8 rounded-r bg-slate-500 px-4 text-[11px] font-semibold text-white hover:bg-slate-600"
              >
                {t("cadastros.comum.limpar")}
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
              label: t("cadastros.comum.email"),
              comparar: (a, b) => compararTextoBr(a.email, b.email),
            },
            {
              valor: "celular",
              label: t("cadastros.comum.celular"),
              comparar: (a, b) => compararTextoBr(a.celular, b.celular),
            },
          ]}
        >
          {(itensPagina) => (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                    <th className="px-3 py-2 text-left font-semibold">{t("cadastros.comum.nome").toUpperCase()}</th>
                    <th className="px-3 py-2 text-left font-semibold">{t("cadastros.comum.celular").toUpperCase()}</th>
                    <th className="px-3 py-2 text-left font-semibold">{t("cadastros.comum.whatsapp").toUpperCase()}</th>
                    <th className="px-3 py-2 text-left font-semibold">{t("cadastros.comum.email").toUpperCase()}</th>
                    <th className="px-3 py-2 text-center font-semibold">{t("cadastros.comum.opcoes").toUpperCase()}</th>
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
                            <td className="px-3 py-2 text-slate-500">{exibirTelefone(entregador.celular)}</td>
                            <td className="px-3 py-2 text-slate-500">{exibirTelefone(entregador.whatsapp)}</td>
                            <td className="px-3 py-2 text-slate-500">{entregador.email || ""}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1 text-slate-500">
                                <button
                                  type="button"
                                  onClick={() => setVisualizando(aberto ? null : entregador)}
                                  className={`rounded p-1 hover:bg-blue-50 hover:text-blue-600 ${aberto ? "bg-blue-50 text-blue-500" : ""}`}
                                  title={t("cadastros.comum.visualizar")}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => abrirEdicao(entregador)}
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
                                      onClick={() => restaurarEntregador(entregador.id)}
                                      className="rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-600"
                                    >
                                      {t("cadastros.comum.restaurar")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removerEntregadorDefinitivo(entregador.id)}
                                      className="rounded bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-red-600"
                                    >
                                      {t("cadastros.comum.excluir")}
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => excluirEntregador(entregador.id)}
                                    className="rounded p-1 text-red-500 hover:bg-red-50"
                                    title={t("cadastros.comum.excluir")}
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
                                      <span className="font-semibold text-slate-700">{t("cadastros.comum.detalheNome")}</span>{" "}
                                      {entregador.nome}
                                    </p>
                                    <p>
                                      <span className="font-semibold text-slate-700">{t("cadastros.comum.detalheTipo")}</span>{" "}
                                      {entregador.tipoEntregador || "—"}
                                    </p>
                                    <p>
                                      <span className="font-semibold text-slate-700">{t("cadastros.comum.detalheCelular")}</span>{" "}
                                      {entregador.celular || "—"}
                                    </p>
                                    <p>
                                      <span className="font-semibold text-slate-700">{t("cadastros.comum.detalheWhatsapp")}</span>{" "}
                                      {entregador.whatsapp || "—"}
                                    </p>
                                    <p>
                                      <span className="font-semibold text-slate-700">{t("cadastros.comum.detalheEmail")}</span>{" "}
                                      {entregador.email || "—"}
                                    </p>
                                    <p className="md:col-span-2">
                                      <span className="font-semibold text-slate-700">{t("cadastros.comum.detalheEndereco")}</span>{" "}
                                      {[entregador.rua, entregador.numero, entregador.bairro, entregador.cidade, entregador.uf]
                                        .filter(Boolean)
                                        .join(", ") || "—"}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setVisualizando(null)}
                                    className="mt-3 rounded border border-slate-300 bg-white px-3 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                                  >
                                    {t("cadastros.comum.fecharDetalhes")}
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
                          ? t("cadastros.entregadores.nenhumExcluido")
                          : t("cadastros.entregadores.nenhumEncontrado")}
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
        title={editando ? t("cadastros.entregadores.editar") : t("cadastros.entregadores.cadastrar")}
        size="xl"
      >
        <form onSubmit={salvarEntregador} className="space-y-5 text-[11px] text-slate-600">
          <section className="space-y-3">
            {tituloSecao(<User className="h-3.5 w-3.5" />, t("cadastros.comum.secaoDadosEntregador"))}
            <div className="grid gap-3 md:grid-cols-[1.6fr_0.8fr]">
              <div>
                {labelCampo(t("cadastros.entregadores.nomeObrigatorio"))}
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className={inputClassName()}
                  required
                />
              </div>
              <div>
                {labelCampo(t("cadastros.comum.tipoEntregador"))}
                <select
                  value={form.tipoEntregador}
                  onChange={(e) => setForm({ ...form, tipoEntregador: e.target.value })}
                  className={selectClassName()}
                >
                  {TIPOS_ENTREGADOR.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                {labelCampo(t("cadastros.comum.cpf"))}
                <input
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  className={inputClassName()}
                />
              </div>
              <div>
                {labelCampo(t("cadastros.comum.cnpj"))}
                <input
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  className={inputClassName()}
                />
              </div>
              <div>
                {labelCampo(t("cadastros.comum.email"))}
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputClassName()}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                {labelCampo(t("cadastros.comum.telefoneResidencial"))}
                <input
                  value={form.telefoneResidencial}
                  placeholder={PLACEHOLDER_TELEFONE_BR}
                  onChange={(e) => setForm({ ...form, telefoneResidencial: formatarTelefone(e.target.value) })}
                  className={inputClassName()}
                />
              </div>
              <div>
                {labelCampo(t("cadastros.comum.telefoneComercial"))}
                <input
                  value={form.telefoneComercial}
                  placeholder={PLACEHOLDER_TELEFONE_BR}
                  onChange={(e) => setForm({ ...form, telefoneComercial: formatarTelefone(e.target.value) })}
                  className={inputClassName()}
                />
              </div>
              <div>
                {labelCampo(t("cadastros.comum.celular"))}
                <input
                  value={form.celular}
                  placeholder={PLACEHOLDER_TELEFONE_BR}
                  onChange={(e) => setForm({ ...form, celular: formatarTelefone(e.target.value) })}
                  className={inputClassName()}
                />
              </div>
              <div>
                {labelCampo(t("cadastros.comum.whatsapp"))}
                <input
                  value={form.whatsapp}
                  placeholder={PLACEHOLDER_TELEFONE_BR}
                  onChange={(e) => setForm({ ...form, whatsapp: formatarTelefone(e.target.value) })}
                  className={inputClassName()}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            {tituloSecao(<MapPin className="h-3.5 w-3.5" />, t("cadastros.comum.secaoEndereco"))}
            <div className="grid gap-3 md:grid-cols-[0.9fr_1.6fr_0.5fr]">
              <div>
                {labelCampo(t("cadastros.comum.cep"))}
                <div className="flex gap-1">
                  <input
                    value={form.cep}
                    onChange={(e) => setForm({ ...form, cep: formatarCepEntrega(e.target.value) })}
                    placeholder={t("cadastros.comum.placeholderCep")}
                    className={inputClassName()}
                  />
                  <button
                    type="button"
                    onClick={() => void buscarEnderecoPorCep()}
                    disabled={buscandoCep}
                    className="h-8 shrink-0 rounded border border-blue-500 bg-white px-2 text-[9px] font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-60"
                  >
                    {buscandoCep ? "..." : t("cadastros.comum.buscarEndereco")}
                  </button>
                </div>
              </div>
              <div>
                {labelCampo(t("cadastros.comum.rua"))}
                <input
                  value={form.rua}
                  onChange={(e) => setForm({ ...form, rua: e.target.value })}
                  className={inputClassName()}
                />
              </div>
              <div>
                {labelCampo(t("cadastros.comum.numero"))}
                <input
                  value={form.numero}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  className={inputClassName()}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                {labelCampo(t("cadastros.comum.cidade"))}
                <input
                  value={form.cidade}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  className={inputClassName()}
                />
              </div>
              <div>
                {labelCampo(t("cadastros.comum.uf"))}
                <input
                  value={form.uf}
                  onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase().slice(0, 2) })}
                  className={inputClassName()}
                />
              </div>
              <div>
                {labelCampo(t("cadastros.comum.bairro"))}
                <input
                  value={form.bairro}
                  onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                  className={inputClassName()}
                />
              </div>
              <div>
                {labelCampo(t("cadastros.comum.complemento"))}
                <input
                  value={form.complemento}
                  onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                  className={inputClassName()}
                />
              </div>
            </div>
          </section>

          <div className="flex gap-2 border-t border-slate-100 pt-4">
            <button
              type="submit"
              className="rounded bg-[#4a90d9] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#3d7fc4]"
            >
              {editando ? t("cadastros.comum.salvar") : t("cadastros.comum.cadastrar")}
            </button>
            <button
              type="button"
              onClick={() => setModalAberto(false)}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              {t("cadastros.comum.fechar")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
