"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Home,
  Trash2,
} from "lucide-react";
import { CampoDataBr } from "@/components/campo-data-br";
import { useI18n } from "@/components/i18n-provider";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { Modal } from "@/components/ui";
import { brShortToIso, dateToBrShort, parseBrDate } from "@/lib/datas-br";
import {
  ehImagemGaleria,
  ehPdfGaleria,
  formatarMbExclusao,
  type ArquivoGaleriaItem,
} from "@/lib/galeria-uploads-types";
import {
  formatarTamanhoArmazenamento,
  notificarUploadsAtualizados,
  UPLOADS_ATUALIZADO_EVENT,
} from "@/lib/uploads-armazenamento";
import { cn } from "@/lib/utils";

const POR_PAGINA = 48;

function inicioAnoBr() {
  const hoje = new Date();
  return dateToBrShort(new Date(hoje.getFullYear(), 0, 1));
}

function hojeBr() {
  return dateToBrShort(new Date());
}

function formatarDataArquivo(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return dateToBrShort(d);
}

export function LiberarEspacoConteudo() {
  const { t } = useI18n();
  const [arquivos, setArquivos] = useState<ArquivoGaleriaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [previewArquivo, setPreviewArquivo] = useState<ArquivoGaleriaItem | null>(null);
  const [pagina, setPagina] = useState(1);
  // Padrão: mostrar todos (evita esconder uploads recentes por período).
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [pathsExcluir, setPathsExcluir] = useState<string[] | null>(null);
  const [alertaMsg, setAlertaMsg] = useState<string | null>(null);

  const recarregarLista = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (dataInicio.trim()) params.set("de", dataInicio.trim());
      if (dataFim.trim()) params.set("ate", dataFim.trim());
      const qs = params.toString();
      const res = await fetch(`/api/uploads/arquivos${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setArquivos([]);
        return;
      }
      const data = (await res.json()) as { arquivos: ArquivoGaleriaItem[] };
      setArquivos(data.arquivos || []);
      setSelecionados(new Set());
      setPagina(1);
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void recarregarLista();
    }, 280);
    return () => window.clearTimeout(t);
  }, [recarregarLista]);

  useEffect(() => {
    const atualizar = () => void recarregarLista();
    window.addEventListener(UPLOADS_ATUALIZADO_EVENT, atualizar);
    return () => window.removeEventListener(UPLOADS_ATUALIZADO_EVENT, atualizar);
  }, [recarregarLista]);

  const totalPaginas = Math.max(1, Math.ceil(arquivos.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const arquivosPagina = useMemo(() => {
    const inicio = (paginaAtual - 1) * POR_PAGINA;
    return arquivos.slice(inicio, inicio + POR_PAGINA);
  }, [arquivos, paginaAtual]);

  const todosSelecionadosPagina = useMemo(
    () =>
      arquivosPagina.length > 0 &&
      arquivosPagina.every((arq) => selecionados.has(arq.relativePath)),
    [arquivosPagina, selecionados]
  );

  const todosSelecionados = useMemo(
    () => arquivos.length > 0 && selecionados.size === arquivos.length,
    [arquivos.length, selecionados.size]
  );

  const bytesSelecionados = useMemo(() => {
    let total = 0;
    for (const arq of arquivos) {
      if (selecionados.has(arq.relativePath)) total += arq.bytes;
    }
    return total;
  }, [arquivos, selecionados]);

  function alternarSelecao(relativePath: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(relativePath)) proximo.delete(relativePath);
      else proximo.add(relativePath);
      return proximo;
    });
  }

  function marcarTodos() {
    if (todosSelecionados) {
      setSelecionados(new Set());
      return;
    }
    setSelecionados(new Set(arquivos.map((arq) => arq.relativePath)));
  }

  function marcarPaginaAtual() {
    if (todosSelecionadosPagina) {
      setSelecionados((atual) => {
        const proximo = new Set(atual);
        for (const arq of arquivosPagina) proximo.delete(arq.relativePath);
        return proximo;
      });
      return;
    }
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      for (const arq of arquivosPagina) proximo.add(arq.relativePath);
      return proximo;
    });
  }

  async function excluirArquivos(paths: string[]) {
    if (paths.length === 0) return;
    setPathsExcluir(paths);
  }

  async function confirmarExclusaoArquivos() {
    const paths = pathsExcluir || [];
    if (paths.length === 0) return;
    setExcluindo(true);
    try {
      const res = await fetch("/api/uploads/arquivos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        excluidos?: number;
        erros?: string[];
        resumo?: import("@/lib/uploads-armazenamento").UploadsResumoArmazenamento;
      };
      if (!res.ok || (data.erros?.length ?? 0) > 0) {
        setAlertaMsg(t("liberarEspaco.erroExcluir"));
      }
      await recarregarLista();
      notificarUploadsAtualizados();
      // Graph às vezes demora a atualizar a cota — reconsulta em seguida.
      window.setTimeout(() => notificarUploadsAtualizados(), 2000);
      window.setTimeout(() => notificarUploadsAtualizados(), 6000);
    } finally {
      setExcluindo(false);
      setPathsExcluir(null);
    }
  }

  const mensagemExclusaoArquivos = useMemo(() => {
    const paths = pathsExcluir || [];
    if (paths.length === 0) return "";
    if (paths.length === 1) return t("liberarEspaco.confirmarExcluirUm");
    return t("liberarEspaco.confirmarExcluirVarios", {
      n: paths.length,
      mb: formatarMbExclusao(
        paths.reduce((s, p) => {
          const arq = arquivos.find((a) => a.relativePath === p);
          return s + (arq?.bytes ?? 0);
        }, 0)
      ),
    });
  }, [pathsExcluir, arquivos, t]);

  function aplicarPeriodoRapido(tipo: "ano" | "mes" | "todos") {
    const hoje = new Date();
    if (tipo === "todos") {
      setDataInicio("");
      setDataFim("");
      return;
    }
    if (tipo === "mes") {
      setDataInicio(dateToBrShort(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
      setDataFim(hojeBr());
      return;
    }
    setDataInicio(inicioAnoBr());
    setDataFim(hojeBr());
  }

  const periodoValido =
    !dataInicio.trim() ||
    !dataFim.trim() ||
    !parseBrDate(dataInicio) ||
    !parseBrDate(dataFim) ||
    brShortToIso(dataInicio) <= brShortToIso(dataFim);

  return (
    <div className="bg-[#f3f4f6] pb-8 pt-1 text-[12px] text-[#374151] dark:bg-slate-950 dark:text-slate-200">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-normal leading-none text-[#6b7280] dark:text-slate-400">
          {t("liberarEspaco.titulo")}
        </h1>
        <div className="flex items-center gap-1.5 text-[12px] text-[#9ca3af] dark:text-slate-500">
          <Link href="/app" className="inline-flex items-center hover:text-[#4a90d9]">
            <Home className="h-3.5 w-3.5 shrink-0" />
          </Link>
          <span className="text-[#d1d5db] dark:text-slate-600">/</span>
          <span className="text-[#6b7280] dark:text-slate-400">{t("liberarEspaco.breadcrumbImagens")}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] px-4 py-3 dark:border-slate-700">
          <h2 className="text-[13px] font-medium text-[#374151] dark:text-slate-200">
            {t("liberarEspaco.galeriaTitulo")}
          </h2>
          <p className="basis-full text-[11px] text-[#6b7280] dark:text-slate-400 sm:basis-auto sm:max-w-md">
            {t("liberarEspaco.subtituloNuvem")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={carregando || arquivos.length === 0 || excluindo}
              onClick={marcarTodos}
              className="inline-flex items-center gap-1.5 rounded border border-[#4a90d9] bg-[#4a90d9] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#3a7bc8] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {todosSelecionados ? t("liberarEspaco.desmarcarTodos") : t("liberarEspaco.marcarTodos")}
            </button>
            <button
              type="button"
              disabled={excluindo || selecionados.size === 0}
              onClick={() => void excluirArquivos([...selecionados])}
              className="inline-flex items-center gap-1.5 rounded border border-red-300 bg-red-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("liberarEspaco.excluirMb", { mb: formatarMbExclusao(bytesSelecionados) })}
            </button>
          </div>
        </div>

        <div className="border-b border-[#e5e7eb] px-4 py-3 dark:border-slate-700">
          <p className="mb-2 text-[11px] font-medium text-[#6b7280] dark:text-slate-400">
            {t("liberarEspaco.periodo")}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-36">
              <CampoDataBr
                value={dataInicio}
                onChange={setDataInicio}
                inputClassName="h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <span className="pb-2 text-[11px] text-[#9ca3af]">{t("liberarEspaco.ate")}</span>
            <div className="w-36">
              <CampoDataBr
                value={dataFim}
                onChange={setDataFim}
                inputClassName="h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 pb-0.5">
              {(
                [
                  ["ano", t("liberarEspaco.anoVigente")],
                  ["mes", t("liberarEspaco.mesVigente")],
                  ["todos", t("liberarEspaco.mostrarTodos")],
                ] as const
              ).map(([id, rotulo]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => aplicarPeriodoRapido(id)}
                  className="rounded border border-[#d1d5db] px-2 py-1 text-[10px] text-[#6b7280] hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
          {!periodoValido ? (
            <p className="mt-2 text-[11px] text-red-600">{t("liberarEspaco.periodoInvalido")}</p>
          ) : null}
        </div>

        <div className="px-4 py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-[#6b7280] dark:text-slate-400">
              Selecione as Imagens:
              {!carregando && (
                <span className="ml-1 text-[#9ca3af]">
                  ({arquivos.length} arquivo{arquivos.length === 1 ? "" : "s"})
                </span>
              )}
            </p>
            {arquivosPagina.length > 0 ? (
              <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-[#6b7280]">
                <input
                  type="checkbox"
                  checked={todosSelecionadosPagina}
                  onChange={marcarPaginaAtual}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Página atual
              </label>
            ) : null}
          </div>

          {carregando ? (
            <p className="py-16 text-center text-[#9ca3af]">Carregando arquivos...</p>
          ) : arquivos.length === 0 ? (
            <p className="py-16 text-center text-[#9ca3af]">
              Nenhum arquivo no período selecionado.
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
              {arquivosPagina.map((arq) => {
                const marcado = selecionados.has(arq.relativePath);
                const imagem = ehImagemGaleria(arq.nome);
                return (
                  <div
                    key={arq.relativePath}
                    className={cn(
                      "relative overflow-hidden rounded border bg-slate-50 transition dark:bg-slate-800",
                      marcado
                        ? "border-sky-400 ring-1 ring-sky-200"
                        : "border-[#e5e7eb] dark:border-slate-600"
                    )}
                  >
                    <label className="absolute left-1 top-1 z-10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarSelecao(arq.relativePath)}
                        className="h-3 w-3 rounded border-slate-300 bg-white shadow"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={excluindo}
                      onClick={() => setPreviewArquivo(arq)}
                      className="absolute right-1 top-1 z-10 rounded bg-white/90 p-0.5 text-[#4a90d9] shadow hover:bg-sky-50 disabled:opacity-40"
                      title="Conferir"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewArquivo(arq)}
                      className="flex h-14 w-full items-center justify-center bg-white p-1 dark:bg-slate-900"
                    >
                      {imagem ? (
                        <img
                          src={arq.url}
                          alt={arq.nome}
                          className="max-h-full max-w-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <FileText className="h-6 w-6 text-slate-300" />
                      )}
                    </button>
                    <div className="border-t border-slate-100 px-1 py-1 dark:border-slate-700">
                      <p
                        className="truncate text-[9px] font-medium leading-tight text-slate-700 dark:text-slate-200"
                        title={arq.nome}
                      >
                        {arq.nome}
                      </p>
                      <p className="truncate text-[8px] leading-tight text-slate-400">
                        {formatarDataArquivo(arq.criadoEm)} ·{" "}
                        {formatarTamanhoArmazenamento(arq.bytes)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPaginas > 1 ? (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={paginaAtual <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                className="rounded border border-[#d1d5db] p-1.5 disabled:opacity-30 dark:border-slate-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[2rem] text-center text-[12px] font-medium text-[#6b7280]">
                {paginaAtual}
              </span>
              <button
                type="button"
                disabled={paginaAtual >= totalPaginas}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                className="rounded border border-[#d1d5db] p-1.5 disabled:opacity-30 dark:border-slate-600"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <Modal
        open={previewArquivo !== null}
        onClose={() => setPreviewArquivo(null)}
        title={previewArquivo?.nome ?? "Conferir arquivo"}
        size="xl"
        layerClassName="z-[70]"
      >
        {previewArquivo ? (
          <div className="space-y-3 text-[12px] text-slate-600">
            <p className="text-[11px] text-slate-500">
              {formatarDataArquivo(previewArquivo.criadoEm)} ·{" "}
              {formatarTamanhoArmazenamento(previewArquivo.bytes)}
            </p>
            {ehImagemGaleria(previewArquivo.nome) ? (
              <div className="flex max-h-[65vh] items-center justify-center overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                <img
                  src={previewArquivo.url}
                  alt={previewArquivo.nome}
                  className="max-h-[60vh] max-w-full object-contain"
                />
              </div>
            ) : ehPdfGaleria(previewArquivo.nome) ? (
              <iframe
                src={previewArquivo.url}
                title={previewArquivo.nome}
                className="h-[65vh] w-full rounded-lg border border-slate-200 bg-white"
              />
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center">
                <FileText className="mx-auto mb-2 h-12 w-12 text-slate-300" />
                <p className="text-[11px] text-slate-500">
                  Pré-visualização não disponível para este tipo de arquivo.
                </p>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setPreviewArquivo(null)}
                className="rounded border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                type="button"
                disabled={excluindo}
                onClick={() => {
                  void excluirArquivos([previewArquivo.relativePath]).then(() => {
                    setPreviewArquivo(null);
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-100 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir arquivo
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmacaoExclusaoModal
        open={pathsExcluir !== null}
        titulo={t("liberarEspaco.titulo")}
        mensagem={mensagemExclusaoArquivos}
        onClose={() => setPathsExcluir(null)}
        onConfirm={() => void confirmarExclusaoArquivos()}
        processando={excluindo}
      />

      <ConfirmacaoExclusaoModal
        open={Boolean(alertaMsg)}
        titulo={t("acompanhamento.avisoTituloErro")}
        mensagem={alertaMsg || ""}
        modo="alerta"
        onClose={() => setAlertaMsg(null)}
        onConfirm={() => setAlertaMsg(null)}
      />
    </div>
  );
}
