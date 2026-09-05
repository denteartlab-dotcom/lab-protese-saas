"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, FileText, Plus, Trash2, Upload } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Modal } from "@/components/ui";
import { SelectPesquisavel } from "@/components/SelectPesquisavel";
import { OdontogramaSeletorOs } from "@/components/producao/OdontogramaSeletorOs";
import {
  categoriaAnexoPorMime,
  LIMITE_ARQUIVOS_SOLICITACAO_ENVIO,
  LIMITE_IMAGENS_SOLICITACAO_ENVIO,
  TIPOS_TRANSPORTE_SOLICITACAO,
  type AnexoSolicitacaoEnvio,
  type CategoriaAnexoSolicitacao,
  type ObservacaoEnvioLinha,
  type TipoTransporteSolicitacao,
} from "@/lib/solicitacao-envio-types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  token: string;
  onClose: () => void;
  onEnviado?: () => void;
};

type FormEstado = {
  pacienteNome: string;
  dentista: string;
  caixa: string;
  casoClinico: string;
  prioridade: "alta" | "media" | "baixa";
  urgente: boolean;
  repeticao: boolean;
  materialEnviado: string;
  dataDesejada: string;
  tipoProtese: string;
  observacaoInterna: string;
  observacaoServico: string;
  escala: string;
  cor: string;
  dentes: string;
  tipoTransporte: TipoTransporteSolicitacao;
  observacoesEnvio: ObservacaoEnvioLinha[];
  anexos: AnexoSolicitacaoEnvio[];
};

const FORM_INICIAL: FormEstado = {
  pacienteNome: "",
  dentista: "",
  caixa: "",
  casoClinico: "",
  prioridade: "media",
  urgente: false,
  repeticao: false,
  materialEnviado: "",
  dataDesejada: "",
  tipoProtese: "",
  observacaoInterna: "",
  observacaoServico: "",
  escala: "",
  cor: "",
  dentes: "",
  tipoTransporte: "motoboy",
  observacoesEnvio: [{ id: "1", texto: "" }],
  anexos: [],
};

const inputCls =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]/30";

export function SolicitacaoEnvioWizardModal({ open, token, onClose, onEnviado }: Props) {
  const { t } = useI18n();
  const [etapa, setEtapa] = useState(1);
  const [form, setForm] = useState<FormEstado>(FORM_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [enviandoArquivos, setEnviandoArquivos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [servicosOpcoes, setServicosOpcoes] = useState<string[]>([]);
  const [carregandoServicos, setCarregandoServicos] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setCarregandoServicos(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/clientes/public/${token}/solicitacao-envio/servicos`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (cancelado) return;
        if (res.ok && Array.isArray(json.servicos)) {
          setServicosOpcoes(json.servicos.filter((s: unknown) => typeof s === "string"));
        } else {
          setServicosOpcoes([]);
        }
      } catch {
        if (!cancelado) setServicosOpcoes([]);
      } finally {
        if (!cancelado) setCarregandoServicos(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [open, token]);

  const opcoesServico = useMemo(
    () => servicosOpcoes.map((nome) => ({ value: nome, label: nome })),
    [servicosOpcoes]
  );

  const titulos = useMemo(
    () => [
      t("acompanhamento.pedido.etapaDados"),
      t("acompanhamento.pedido.etapaAnexos"),
      t("acompanhamento.pedido.etapaTransporte"),
    ],
    [t]
  );

  function fechar() {
    setEtapa(1);
    setForm(FORM_INICIAL);
    setErro(null);
    setSucesso(false);
    onClose();
  }

  function atualizar<K extends keyof FormEstado>(chave: K, valor: FormEstado[K]) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function validarEtapa1() {
    if (!form.pacienteNome.trim() || !form.tipoProtese.trim()) {
      setErro(t("acompanhamento.pedido.erroObrigatorios"));
      return false;
    }
    setErro(null);
    return true;
  }

  function validarEtapa1Silencioso() {
    return Boolean(form.pacienteNome.trim() && form.tipoProtese.trim());
  }

  function irParaEtapa(destino: number) {
    if (destino === etapa) return;
    if (destino < 1 || destino > 3) return;

    // Voltar sempre liberado para corrigir dados.
    if (destino < etapa) {
      setErro(null);
      setEtapa(destino);
      return;
    }

    // Avançar exige etapa 1 válida.
    if (etapa === 1 && !validarEtapa1()) return;
    if (destino > etapa + 1 && !validarEtapa1Silencioso()) {
      setErro(t("acompanhamento.pedido.erroObrigatorios"));
      setEtapa(1);
      return;
    }
    setErro(null);
    setEtapa(destino);
  }

  function voltarEtapa() {
    if (etapa === 1) {
      fechar();
      return;
    }
    setErro(null);
    setEtapa((atual) => atual - 1);
  }

  async function enviarArquivos(
    lista: FileList | null,
    categoria: CategoriaAnexoSolicitacao
  ) {
    if (!lista?.length) return;
    if (!form.pacienteNome.trim()) {
      setErro(t("acompanhamento.pedido.erroPacienteAnexos"));
      setEtapa(1);
      return;
    }
    const atuais = form.anexos.filter(
      (a) =>
        (a.categoria || categoriaAnexoPorMime(a.mimeType)) === categoria
    );
    const limite =
      categoria === "imagem"
        ? LIMITE_IMAGENS_SOLICITACAO_ENVIO
        : LIMITE_ARQUIVOS_SOLICITACAO_ENVIO;
    const restantes = limite - atuais.length;
    if (restantes <= 0) {
      setErro(
        categoria === "imagem"
          ? t("acompanhamento.pedido.erroLimiteImagens")
          : t("acompanhamento.pedido.erroLimiteArquivos")
      );
      return;
    }
    const files = Array.from(lista)
      .filter((file) =>
        categoria === "imagem"
          ? file.type.startsWith("image/")
          : !file.type.startsWith("image/")
      )
      .slice(0, restantes);
    if (!files.length) {
      setErro(
        categoria === "imagem"
          ? t("acompanhamento.pedido.erroTipoImagem")
          : t("acompanhamento.pedido.erroTipoArquivo")
      );
      return;
    }
    setEnviandoArquivos(true);
    setErro(null);
    try {
      const body = new FormData();
      body.append("pacienteNome", form.pacienteNome.trim());
      body.append("tipo", categoria);
      for (const file of files) body.append("files", file);
      const res = await fetch(
        `/api/clientes/public/${token}/solicitacao-envio/upload`,
        { method: "POST", body }
      );
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error || json.message || t("acompanhamento.pedido.erroUpload"));
        return;
      }
      const novos = (Array.isArray(json) ? json : []).map(
        (item: AnexoSolicitacaoEnvio) => ({
          ...item,
          categoria: item.categoria || categoria,
        })
      ) as AnexoSolicitacaoEnvio[];
      atualizar("anexos", [...form.anexos, ...novos]);
    } catch {
      setErro(t("acompanhamento.pedido.erroUpload"));
    } finally {
      setEnviandoArquivos(false);
    }
  }

  function removerAnexo(id: string) {
    atualizar(
      "anexos",
      form.anexos.filter((a) => a.id !== id)
    );
  }

  const imagens = form.anexos.filter(
    (a) => (a.categoria || categoriaAnexoPorMime(a.mimeType)) === "imagem"
  );
  const arquivos = form.anexos.filter(
    (a) => (a.categoria || categoriaAnexoPorMime(a.mimeType)) === "arquivo"
  );

  async function confirmarEnvio() {
    if (!validarEtapa1()) {
      setEtapa(1);
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/clientes/public/${token}/solicitacao-envio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pacienteNome: form.pacienteNome.trim(),
          dentista: form.dentista.trim(),
          caixa: form.caixa.trim(),
          casoClinico: form.casoClinico.trim(),
          prioridade: form.prioridade,
          urgente: form.urgente,
          repeticao: form.repeticao,
          materialEnviado: form.materialEnviado.trim(),
          dataDesejada: form.dataDesejada || null,
          tipoProtese: form.tipoProtese.trim(),
          observacaoInterna: form.observacaoInterna.trim(),
          observacaoServico: form.observacaoServico.trim(),
          escala: form.escala.trim(),
          cor: form.cor.trim(),
          dentes: form.dentes.trim(),
          tipoTransporte: form.tipoTransporte,
          observacoesEnvio: form.observacoesEnvio.filter((l) => l.texto.trim()),
          anexos: form.anexos,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.message || json.error || t("acompanhamento.pedido.erroEnviar"));
        return;
      }
      setSucesso(true);
      onEnviado?.();
    } catch {
      setErro(t("acompanhamento.pedido.erroEnviar"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={fechar}
      title={t("acompanhamento.pedido.titulo")}
      size="lg"
    >
      {sucesso ? (
        <div className="space-y-4 p-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-800">
            {t("acompanhamento.pedido.sucessoTitulo")}
          </p>
          <p className="text-xs text-slate-500">{t("acompanhamento.pedido.sucessoDesc")}</p>
          <button
            type="button"
            onClick={fechar}
            className="inline-flex h-9 items-center rounded-md bg-[#4a90d9] px-4 text-sm font-semibold text-white"
          >
            {t("cadastros.comum.fechar")}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <ol className="flex flex-wrap gap-2">
            {titulos.map((titulo, index) => {
              const n = index + 1;
              const concluida = etapa > n;
              const atual = etapa === n;
              const podeIr =
                n <= etapa ||
                (n === etapa + 1 && validarEtapa1Silencioso());

              return (
                <li key={titulo}>
                  <button
                    type="button"
                    disabled={!podeIr}
                    onClick={() => irParaEtapa(n)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition",
                      atual
                        ? "border-[#4a90d9] bg-[#4a90d9]/10 text-[#4a90d9]"
                        : concluida
                          ? "cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400"
                          : podeIr
                            ? "cursor-pointer border-slate-200 bg-slate-50 text-slate-600 hover:border-[#4a90d9]/40"
                            : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                    )}
                    title={
                      concluida || atual
                        ? t("acompanhamento.pedido.cliqueParaEditar")
                        : undefined
                    }
                  >
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                        concluida ? "bg-emerald-600 text-white" : "bg-white"
                      )}
                    >
                      {concluida ? <Check className="h-3 w-3" /> : n}
                    </span>
                    {titulo}
                  </button>
                </li>
              );
            })}
          </ol>

          {etapa === 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                {t("acompanhamento.pedido.paciente")} *
                <input
                  className={cn(inputCls, "mt-1")}
                  value={form.pacienteNome}
                  onChange={(e) => atualizar("pacienteNome", e.target.value)}
                />
              </label>
              <div className="sm:col-span-2">
                <SelectPesquisavel
                  label={
                    <>
                      {t("acompanhamento.pedido.servico")} *
                    </>
                  }
                  value={form.tipoProtese}
                  onChange={(valor) => atualizar("tipoProtese", valor)}
                  options={opcoesServico}
                  placeholder={
                    carregandoServicos
                      ? t("acompanhamento.pedido.servicosCarregando")
                      : t("acompanhamento.pedido.servicosBusca")
                  }
                  emptyMessage={
                    carregandoServicos
                      ? t("acompanhamento.pedido.servicosCarregando")
                      : t("acompanhamento.pedido.servicosVazio")
                  }
                  required
                  disabled={carregandoServicos}
                  permitirLimpar
                  menuEmPortal
                  className="text-xs font-medium text-slate-600"
                  inputClassName="h-9 rounded-md border border-slate-200 bg-white text-sm text-slate-800"
                />
              </div>
              <label className="block text-xs font-medium text-slate-600">
                {t("acompanhamento.pedido.dentista")}
                <input
                  className={cn(inputCls, "mt-1")}
                  value={form.dentista}
                  onChange={(e) => atualizar("dentista", e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t("acompanhamento.pedido.dataDesejada")}
                <input
                  type="date"
                  className={cn(inputCls, "mt-1")}
                  value={form.dataDesejada}
                  onChange={(e) => atualizar("dataDesejada", e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t("acompanhamento.pedido.cor")}
                <input
                  className={cn(inputCls, "mt-1")}
                  value={form.cor}
                  onChange={(e) => atualizar("cor", e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t("acompanhamento.pedido.escala")}
                <input
                  className={cn(inputCls, "mt-1")}
                  value={form.escala}
                  onChange={(e) => atualizar("escala", e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t("acompanhamento.pedido.prioridade")}
                <select
                  className={cn(inputCls, "mt-1")}
                  value={form.prioridade}
                  onChange={(e) =>
                    atualizar("prioridade", e.target.value as FormEstado["prioridade"])
                  }
                >
                  <option value="alta">{t("acompanhamento.pedido.prioridadeAlta")}</option>
                  <option value="media">{t("acompanhamento.pedido.prioridadeMedia")}</option>
                  <option value="baixa">{t("acompanhamento.pedido.prioridadeBaixa")}</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t("acompanhamento.pedido.caixa")}
                <input
                  className={cn(inputCls, "mt-1")}
                  value={form.caixa}
                  onChange={(e) => atualizar("caixa", e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t("acompanhamento.pedido.casoClinico")}
                <input
                  className={cn(inputCls, "mt-1")}
                  value={form.casoClinico}
                  onChange={(e) => atualizar("casoClinico", e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                {t("acompanhamento.pedido.material")}
                <input
                  className={cn(inputCls, "mt-1")}
                  value={form.materialEnviado}
                  onChange={(e) => atualizar("materialEnviado", e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-4 sm:col-span-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.urgente}
                    onChange={(e) => atualizar("urgente", e.target.checked)}
                  />
                  {t("acompanhamento.urgente")}
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.repeticao}
                    onChange={(e) => atualizar("repeticao", e.target.checked)}
                  />
                  {t("acompanhamento.pedido.repeticao")}
                </label>
              </div>
              <div className="sm:col-span-2">
                <OdontogramaSeletorOs
                  key={open ? "odontograma-aberto" : "odontograma-fechado"}
                  value={form.dentes}
                  onChange={(resumo) => atualizar("dentes", resumo)}
                  titulo={t("acompanhamento.pedido.odontogramaTitulo")}
                  labelSelecionados={t("acompanhamento.pedido.dentesSelecionados")}
                  labelNenhum={t("acompanhamento.pedido.nenhumDente")}
                  labelPermanente={t("acompanhamento.pedido.permanente")}
                  labelDeciduos={t("acompanhamento.pedido.deciduos")}
                />
              </div>
              <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                {t("acompanhamento.pedido.obsServico")}
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#4a90d9]"
                  value={form.observacaoServico}
                  onChange={(e) => atualizar("observacaoServico", e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                {t("acompanhamento.pedido.obsInterna")}
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#4a90d9]"
                  value={form.observacaoInterna}
                  onChange={(e) => atualizar("observacaoInterna", e.target.value)}
                />
              </label>
            </div>
          )}

          {etapa === 2 && (
            <div className="space-y-5">
              <p className="text-xs text-slate-500">
                {t("acompanhamento.pedido.anexosDesc", {
                  imagens: LIMITE_IMAGENS_SOLICITACAO_ENVIO,
                  arquivos: LIMITE_ARQUIVOS_SOLICITACAO_ENVIO,
                })}
              </p>
              {form.pacienteNome.trim() ? (
                <p className="rounded-md bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                  {t("acompanhamento.pedido.pastaPaciente", {
                    paciente: form.pacienteNome.trim(),
                  })}
                </p>
              ) : null}

              <section className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">
                    {t("acompanhamento.pedido.secaoArquivos")}{" "}
                    <span className="font-normal text-slate-500">
                      ({arquivos.length}/{LIMITE_ARQUIVOS_SOLICITACAO_ENVIO})
                    </span>
                  </h3>
                  <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[#4a90d9] bg-white px-3 text-xs font-semibold text-[#4a90d9] hover:bg-[#4a90d9]/5">
                    <Upload className="h-3.5 w-3.5" />
                    {enviandoArquivos
                      ? t("acompanhamento.pedido.enviandoArquivos")
                      : t("acompanhamento.pedido.selecionarArquivos")}
                    <input
                      type="file"
                      multiple
                      accept="application/pdf"
                      className="hidden"
                      disabled={enviandoArquivos}
                      onChange={(e) => {
                        void enviarArquivos(e.target.files, "arquivo");
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {arquivos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {arquivos.map((anexo) => (
                      <div
                        key={anexo.id}
                        className="relative flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center"
                      >
                        <FileText className="h-10 w-10 text-slate-500" />
                        <p className="line-clamp-2 w-full text-[11px] font-medium text-slate-700">
                          {anexo.nome}
                        </p>
                        <a
                          href={anexo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-semibold text-[#4a90d9] hover:underline"
                        >
                          {t("acompanhamento.pedido.abrirArquivo")}
                        </a>
                        <button
                          type="button"
                          className="absolute right-1.5 top-1.5 rounded bg-white/90 p-1 text-red-600 shadow-sm hover:bg-red-50"
                          onClick={() => removerAnexo(anexo.id)}
                          aria-label={t("acompanhamento.pedido.removerAnexo")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-xs text-slate-400">
                    {t("acompanhamento.pedido.semArquivos")}
                  </p>
                )}
              </section>

              <section className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">
                    {t("acompanhamento.pedido.secaoImagens")}{" "}
                    <span className="font-normal text-slate-500">
                      ({imagens.length}/{LIMITE_IMAGENS_SOLICITACAO_ENVIO})
                    </span>
                  </h3>
                  <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[#4a90d9] bg-white px-3 text-xs font-semibold text-[#4a90d9] hover:bg-[#4a90d9]/5">
                    <Upload className="h-3.5 w-3.5" />
                    {enviandoArquivos
                      ? t("acompanhamento.pedido.enviandoArquivos")
                      : t("acompanhamento.pedido.selecionarImagens")}
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={enviandoArquivos}
                      onChange={(e) => {
                        void enviarArquivos(e.target.files, "imagem");
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {imagens.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {imagens.map((anexo) => (
                      <div
                        key={anexo.id}
                        className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={anexo.url}
                          alt={anexo.nome}
                          className="h-36 w-full object-cover"
                        />
                        <p className="truncate px-2 py-1.5 text-[10px] text-slate-600">
                          {anexo.nome}
                        </p>
                        <button
                          type="button"
                          className="absolute right-1.5 top-1.5 rounded bg-white/90 p-1 text-red-600 shadow-sm hover:bg-red-50"
                          onClick={() => removerAnexo(anexo.id)}
                          aria-label={t("acompanhamento.pedido.removerAnexo")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-xs text-slate-400">
                    {t("acompanhamento.pedido.semImagens")}
                  </p>
                )}
              </section>
            </div>
          )}

          {etapa === 3 && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-600">
                {t("acompanhamento.pedido.tipoTransporte")}
                <select
                  className={cn(inputCls, "mt-1")}
                  value={form.tipoTransporte}
                  onChange={(e) =>
                    atualizar(
                      "tipoTransporte",
                      e.target.value as TipoTransporteSolicitacao
                    )
                  }
                >
                  {TIPOS_TRANSPORTE_SOLICITACAO.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {t(`acompanhamento.pedido.transporte.${tipo}`)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="overflow-hidden rounded-md border border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-700">
                    {t("acompanhamento.pedido.obsEnvio")}
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4a90d9]"
                    onClick={() =>
                      atualizar("observacoesEnvio", [
                        ...form.observacoesEnvio,
                        { id: String(Date.now()), texto: "" },
                      ])
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("acompanhamento.pedido.adicionarLinha")}
                  </button>
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">
                        {t("acompanhamento.pedido.observacao")}
                      </th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.observacoesEnvio.map((linha, index) => (
                      <tr key={linha.id} className="border-b border-slate-50">
                        <td className="px-3 py-2 text-slate-400">{index + 1}</td>
                        <td className="px-3 py-2">
                          <input
                            className={inputCls}
                            value={linha.texto}
                            onChange={(e) =>
                              atualizar(
                                "observacoesEnvio",
                                form.observacoesEnvio.map((l) =>
                                  l.id === linha.id
                                    ? { ...l, texto: e.target.value }
                                    : l
                                )
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            className="text-red-500"
                            onClick={() =>
                              atualizar(
                                "observacoesEnvio",
                                form.observacoesEnvio.filter((l) => l.id !== linha.id)
                              )
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {erro ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {erro}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={voltarEtapa}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              {etapa === 1 ? t("cadastros.comum.fechar") : t("acompanhamento.pedido.voltar")}
            </button>
            {etapa < 3 ? (
              <button
                type="button"
                onClick={() => irParaEtapa(etapa + 1)}
                className="inline-flex h-9 items-center gap-1 rounded-md bg-[#4a90d9] px-4 text-sm font-semibold text-white"
              >
                {t("acompanhamento.pedido.proxima")}
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={enviando}
                onClick={() => void confirmarEnvio()}
                className="inline-flex h-9 items-center rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {enviando
                  ? t("acompanhamento.pedido.enviando")
                  : t("acompanhamento.pedido.confirmar")}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
