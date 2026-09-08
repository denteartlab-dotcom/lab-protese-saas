"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, Eye, FileText, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/i18n-provider";
import { PdfViewerIframe } from "@/components/pdf/PdfViewerIframe";
import { Modal } from "@/components/ui";
import { apiFetch } from "@/lib/fetch-client";
import { PDF_VIEWER_SOBRE_MODAL_CLASSES } from "@/lib/pdf-viewer-iframe";
import {
  anexoSolicitacaoEhImagem,
  anexoSolicitacaoEhPdf,
  rotuloTipoTransporte,
} from "@/lib/solicitacao-envio-types";
import { cn } from "@/lib/utils";

export type AnexoSolicitacaoDashboard = {
  id: string;
  nome: string;
  url: string;
  mimeType?: string;
  categoria?: string;
};

export type SolicitacaoEnvioDashboardItem = {
  id: string;
  status: string;
  pacienteNome: string;
  tipoProtese: string;
  tipoTransporte: string;
  tipoTransporteLabel?: string;
  tipoFrete?: string;
  numeroRastreio?: string;
  criadoEm: string;
  dentista?: string;
  materialEnviado?: string;
  observacaoServico?: string;
  observacaoInterna?: string;
  dataDesejada?: string | null;
  dentes?: string;
  cor?: string;
  escala?: string;
  urgente?: boolean;
  repeticao?: boolean;
  prioridade?: string;
  observacoesEnvio?: Array<{ id: string; texto: string }>;
  anexos?: AnexoSolicitacaoDashboard[];
  cliente?: { id: string; nome: string };
};

type Props = {
  titulo: string;
  lista: SolicitacaoEnvioDashboardItem[];
  onAtualizado?: () => void;
  solicitacaoInicialId?: string | null;
};

function PreviewAnexoSolicitacao({
  anexo,
  onClose,
}: {
  anexo: AnexoSolicitacaoDashboard;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [portalPronto, setPortalPronto] = useState(false);
  const ehImagem = anexoSolicitacaoEhImagem(anexo);
  const ehPdf = anexoSolicitacaoEhPdf(anexo);

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!portalPronto) return null;

  const conteudo = (
    <div className={PDF_VIEWER_SOBRE_MODAL_CLASSES} role="dialog" aria-modal="true">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{anexo.nome}</h2>
          <p className="text-xs text-slate-300">
            {anexo.mimeType || t("acompanhamento.pedido.etapaAnexos")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={anexo.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-slate-500 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            {t("acompanhamento.pedido.abrirArquivo")}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-300 hover:bg-slate-700 hover:text-white"
            aria-label={t("cadastros.comum.fechar")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {ehPdf ? (
        <PdfViewerIframe title={anexo.nome} pdfUrl={anexo.url} />
      ) : ehImagem ? (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#525659] p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={anexo.url}
            alt={anexo.nome}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-auto bg-[#525659] p-6 text-center text-white">
          <FileText className="h-16 w-16 text-slate-300" />
          <p className="max-w-md text-sm text-slate-200">{anexo.nome}</p>
          <p className="text-xs text-slate-400">
            {t("dashboard.solicitacaoPreviewArquivo")}
          </p>
          <a
            href={anexo.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded bg-[#4a90d9] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3a7bc0]"
          >
            <Download className="h-3.5 w-3.5" />
            {t("acompanhamento.pedido.abrirArquivo")}
          </a>
        </div>
      )}
    </div>
  );

  return createPortal(conteudo, document.body);
}

export function PainelSolicitacoesEnvioDashboard({
  titulo,
  lista: listaInicial,
  onAtualizado,
  solicitacaoInicialId,
}: Props) {
  const { t } = useI18n();
  const [aberto, setAberto] = useState(Boolean(solicitacaoInicialId));
  const [lista, setLista] = useState(listaInicial);
  const [detalhe, setDetalhe] = useState<SolicitacaoEnvioDashboardItem | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState("");
  const [previewAnexo, setPreviewAnexo] = useState<AnexoSolicitacaoDashboard | null>(
    null
  );

  useEffect(() => {
    setLista(listaInicial);
  }, [listaInicial]);

  useEffect(() => {
    if (!solicitacaoInicialId) return;
    const item = listaInicial.find((s) => s.id === solicitacaoInicialId);
    if (item) {
      setAberto(true);
      setDetalhe(item);
    } else {
      void (async () => {
        try {
          const json = await apiFetch<{ solicitacao?: SolicitacaoEnvioDashboardItem }>(
            `/api/solicitacoes-envio?id=${solicitacaoInicialId}`
          );
          if (json.solicitacao) {
            setAberto(true);
            setDetalhe(json.solicitacao);
          }
        } catch {
          /* ignore */
        }
      })();
    }
  }, [solicitacaoInicialId, listaInicial]);

  const anexosDetalhe = useMemo(() => detalhe?.anexos || [], [detalhe]);

  async function aprovar() {
    if (!detalhe) return;
    setProcessando(true);
    setErro(null);
    try {
      await apiFetch("/api/solicitacoes-envio", {
        method: "POST",
        body: JSON.stringify({ acao: "aprovar", id: detalhe.id }),
      });
      setLista((atual) => atual.filter((s) => s.id !== detalhe.id));
      setDetalhe(null);
      onAtualizado?.();
    } catch (err) {
      setErro(err instanceof Error ? err.message : t("dashboard.solicitacaoErroAprovar"));
    } finally {
      setProcessando(false);
    }
  }

  async function recusar() {
    if (!detalhe) return;
    setProcessando(true);
    setErro(null);
    try {
      await apiFetch("/api/solicitacoes-envio", {
        method: "POST",
        body: JSON.stringify({
          acao: "recusar",
          id: detalhe.id,
          motivo: motivoRecusa,
        }),
      });
      setLista((atual) => atual.filter((s) => s.id !== detalhe.id));
      setDetalhe(null);
      setMotivoRecusa("");
      onAtualizado?.();
    } catch (err) {
      setErro(err instanceof Error ? err.message : t("dashboard.solicitacaoErroRecusar"));
    } finally {
      setProcessando(false);
    }
  }

  const total = lista.length;

  return (
    <>
      <section className="rounded-lg border border-emerald-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className={cn(
            "flex w-full flex-wrap items-center justify-between gap-3 bg-emerald-50/70 px-4 py-3 text-left transition hover:bg-emerald-50",
            aberto && "border-b border-emerald-100"
          )}
          aria-expanded={aberto}
        >
          <div className="flex min-w-0 items-center gap-2">
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-emerald-700 transition-transform",
                aberto && "rotate-180"
              )}
            />
            <div>
              <h2 className="text-sm font-semibold text-emerald-900">{titulo}</h2>
              <p className="text-[12px] text-emerald-800/80">
                {t("dashboard.solicitacoesResumo", { total })}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-lg font-bold text-white">
            {total}
          </span>
        </button>

        {aberto ? (
          total === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-slate-500">
              {t("dashboard.semSolicitacoes")}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lista.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[12px]"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">
                      {item.cliente?.nome || "—"} — {item.pacienteNome}
                    </p>
                    <p className="text-slate-500">
                      {item.tipoProtese} ·{" "}
                      {item.tipoTransporteLabel ||
                        rotuloTipoTransporte(item.tipoTransporte)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetalhe(item)}
                    className="rounded border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50"
                  >
                    {t("dashboard.revisar")}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      <Modal
        open={Boolean(detalhe)}
        onClose={() => {
          if (processando) return;
          setDetalhe(null);
          setErro(null);
        }}
        title={t("dashboard.solicitacaoDetalheTitulo")}
        size="lg"
      >
        {detalhe ? (
          <div className="space-y-4 text-sm text-slate-700">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="font-semibold">{t("relatorio.comum.cliente")}:</span>{" "}
                {detalhe.cliente?.nome || "—"}
              </p>
              <p>
                <span className="font-semibold">{t("relatorio.comum.paciente")}:</span>{" "}
                {detalhe.pacienteNome}
              </p>
              <p className="sm:col-span-2">
                <span className="font-semibold">{t("acompanhamento.pedido.servico")}:</span>{" "}
                {detalhe.tipoProtese}
              </p>
              <p>
                <span className="font-semibold">{t("acompanhamento.pedido.tipoTransporte")}:</span>{" "}
                {detalhe.tipoTransporteLabel ||
                  rotuloTipoTransporte(detalhe.tipoTransporte)}
              </p>
              <p>
                <span className="font-semibold">{t("acompanhamento.pedido.tipoFrete")}:</span>{" "}
                {detalhe.tipoFrete || "—"}
              </p>
              <p>
                <span className="font-semibold">{t("acompanhamento.pedido.numeroRastreio")}:</span>{" "}
                {detalhe.numeroRastreio || "—"}
              </p>
              <p>
                <span className="font-semibold">{t("acompanhamento.pedido.dataDesejada")}:</span>{" "}
                {detalhe.dataDesejada || "—"}
              </p>
              <p>
                <span className="font-semibold">{t("acompanhamento.pedido.dentista")}:</span>{" "}
                {detalhe.dentista || "—"}
              </p>
              <p>
                <span className="font-semibold">{t("acompanhamento.pedido.material")}:</span>{" "}
                {detalhe.materialEnviado || "—"}
              </p>
            </div>

            {detalhe.observacaoServico ? (
              <p className="rounded bg-slate-50 px-3 py-2 text-xs">
                <span className="font-semibold">{t("acompanhamento.pedido.obsServico")}:</span>{" "}
                {detalhe.observacaoServico}
              </p>
            ) : null}

            {(detalhe.observacoesEnvio || []).filter((l) => l.texto.trim()).length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-600">
                  {t("acompanhamento.pedido.obsEnvio")}
                </p>
                <ul className="list-disc space-y-1 pl-5 text-xs">
                  {detalhe.observacoesEnvio!.filter((l) => l.texto.trim()).map((l) => (
                    <li key={l.id}>{l.texto}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {anexosDetalhe.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600">
                  {t("acompanhamento.pedido.etapaAnexos")}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {anexosDetalhe.map((anexo) => {
                    const ehImagem = anexoSolicitacaoEhImagem(anexo);
                    return (
                      <button
                        key={anexo.id}
                        type="button"
                        onClick={() => setPreviewAnexo(anexo)}
                        className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left transition hover:border-[#4a90d9] hover:shadow-sm"
                      >
                        {ehImagem ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={anexo.url}
                            alt={anexo.nome}
                            className="h-28 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-28 w-full flex-col items-center justify-center gap-1 bg-slate-100 px-2">
                            <FileText className="h-9 w-9 text-slate-500" />
                            <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                              {(anexo.nome.split(".").pop() || "file").slice(0, 6)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-1 px-2 py-1.5">
                          <p className="line-clamp-2 min-w-0 flex-1 text-[10px] font-medium text-slate-700">
                            {anexo.nome}
                          </p>
                          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4a90d9] opacity-80 group-hover:opacity-100" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <label className="block text-xs font-medium text-slate-600">
              {t("dashboard.motivoRecusa")}
              <input
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                className="mt-1 h-9 w-full rounded border border-slate-200 px-3 text-sm"
                disabled={processando}
              />
            </label>

            {erro ? (
              <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                disabled={processando}
                onClick={() => void recusar()}
                className="h-9 rounded border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 disabled:opacity-60"
              >
                {t("dashboard.recusar")}
              </button>
              <button
                type="button"
                disabled={processando}
                onClick={() => void aprovar()}
                className="h-9 rounded bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {processando
                  ? t("dashboard.processando")
                  : t("dashboard.aprovarCriarOs")}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {previewAnexo ? (
        <PreviewAnexoSolicitacao
          anexo={previewAnexo}
          onClose={() => setPreviewAnexo(null)}
        />
      ) : null}
    </>
  );
}
