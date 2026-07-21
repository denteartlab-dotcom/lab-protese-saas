"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { AgendaVerProdutosModal } from "@/components/producao/AgendaVerProdutosModal";
import { OsDetalheCampo } from "@/components/producao/OsDetalheCampo";
import {
  anexosAgendaGrupo,
  dataFinalizadoEntregueAgenda,
  descontoTextoAgendaGrupo,
  instrucoesConsolidadasGrupo,
  osExternaAgenda,
  prazoDentistaTextoAgenda,
  prazoTextoAgendaGrupo,
  produtosAgendaGrupo,
  totalAgendaGrupo,
  valorUnitarioAgendaGrupo,
  type LinhaAgendaGrupoOs,
} from "@/lib/agenda-producao-grupo";
import { instrucoesTextoLivre } from "@/lib/etapas-os";
import {
  parseHistoricoSituacao,
  textoHistoricoSituacaoExibicao,
} from "@/lib/historico-situacao-os";
import { labelStatusTrabalho } from "@/lib/i18n/status-trabalho-i18n";
import { exibirTexto } from "@/lib/utils";

type Props = {
  linha: LinhaAgendaGrupoOs;
  anexoAberto: { name: string; type: string; url: string } | null;
  onAnexoAberto: (anexo: { name: string; type: string; url: string } | null) => void;
  onAdicionarImagem?: () => void;
};

export function AgendaOsDetalheExpandido({
  linha,
  anexoAberto,
  onAnexoAberto,
  onAdicionarImagem,
}: Props) {
  const { t, locale } = useI18n();
  const [produtosAbertos, setProdutosAbertos] = useState(false);
  const { principal } = linha;
  const instrucoes = instrucoesConsolidadasGrupo(linha);
  const anexos = anexosAgendaGrupo(linha);
  const produtos = produtosAgendaGrupo(linha);
  const historicoSituacao = useMemo(() => {
    const entradas = parseHistoricoSituacao(instrucoes);
    return textoHistoricoSituacaoExibicao(
      entradas,
      (status) => labelStatusTrabalho(t, status),
      locale
    );
  }, [instrucoes, t, locale]);

  return (
    <>
      <div className="grid gap-4 border-t border-slate-200 bg-white px-4 py-4 md:grid-cols-3">
        <div className="space-y-3">
          <OsDetalheCampo label={t("producao.os.campo.osExterna")} value={osExternaAgenda(instrucoes)} />
          <OsDetalheCampo
            label={t("producao.os.campo.prazoLaboratorio")}
            value={prazoTextoAgendaGrupo(linha)}
          />
          <OsDetalheCampo
            label={t("producao.os.campo.valorUn")}
            value={valorUnitarioAgendaGrupo(linha)}
          />
          <OsDetalheCampo
            label={t("producao.os.campo.material")}
            value={exibirTexto(principal.material)}
          />
          <OsDetalheCampo
            label={t("producao.controle.detalhe.observacaoServico")}
            value={instrucoesTextoLivre(instrucoes)}
          />
          <OsDetalheCampo
            label={t("producao.controle.detalhe.observacaoInternaFicha")}
            value={principal.observacoes?.trim() || ""}
          />
          <button
            type="button"
            onClick={() => setProdutosAbertos(true)}
            className="rounded border border-emerald-400 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
          >
            {t("producao.controle.detalhe.verProdutos")}
          </button>
        </div>

        <div className="space-y-3">
          <OsDetalheCampo
            label={t("producao.os.tabela.numeroDente")}
            value={exibirTexto(principal.dentes)}
          />
          <OsDetalheCampo
            label={t("producao.os.campo.prazoDentista")}
            value={prazoDentistaTextoAgenda(principal)}
          />
          <OsDetalheCampo
            label={t("producao.controle.detalhe.desconto")}
            value={descontoTextoAgendaGrupo(linha)}
          />
        </div>

        <div className="space-y-3">
          <OsDetalheCampo
            label={t("producao.os.tabela.corDente")}
            value={exibirTexto(principal.cor)}
          />
          <OsDetalheCampo
            label={t("producao.controle.detalhe.dataFinalizadoEntregue")}
            value={dataFinalizadoEntregueAgenda(linha)}
          />
          <OsDetalheCampo
            label={t("producao.controle.detalhe.total")}
            value={totalAgendaGrupo(linha)}
          />
          <OsDetalheCampo
            label={t("producao.controle.detalhe.historicoSituacao")}
            value={historicoSituacao}
          />
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-600">
            {t("producao.controle.detalhe.galeriaImagens")}:
          </p>
          {onAdicionarImagem ? (
            <button
              type="button"
              onClick={onAdicionarImagem}
              className="inline-flex items-center gap-1 rounded border border-emerald-300 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("producao.controle.detalhe.adicionarImagem")}
            </button>
          ) : null}
        </div>
        {anexos.length === 0 ? (
          <p className="text-[11px] text-slate-400">
            {t("producao.controle.detalhe.nenhumaImagem")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {anexos.map((anexo) => (
              <button
                type="button"
                key={`${anexo.url}-${anexo.name}`}
                onClick={() => onAnexoAberto(anexo)}
                className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm hover:border-primary-300"
                title={anexo.name}
              >
                {anexo.type.startsWith("image/") ? (
                  <img
                    src={anexo.url}
                    alt={anexo.name}
                    className="h-16 w-24 object-cover"
                  />
                ) : anexo.type.startsWith("video/") ? (
                  <video src={anexo.url} className="h-16 w-24 bg-black object-cover" />
                ) : (
                  <div className="flex h-16 w-24 items-center justify-center text-[10px] text-slate-400">
                    {t("common.arquivo")}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <AgendaVerProdutosModal
        open={produtosAbertos}
        onClose={() => setProdutosAbertos(false)}
        numeroOs={principal.numeroOs}
        produtos={produtos}
      />

      {anexoAberto && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-slate-700">
                  {anexoAberto.name}
                </h2>
                <p className="text-xs text-slate-400">
                  {anexoAberto.type || t("producao.controle.detalhe.arquivoAnexado")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAnexoAberto(null)}
                className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {t("common.fechar")}
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-950 p-4">
              {anexoAberto.type.startsWith("image/") ? (
                <img
                  src={anexoAberto.url}
                  alt={anexoAberto.name}
                  className="max-h-[78vh] max-w-full rounded bg-white object-contain"
                />
              ) : anexoAberto.type.startsWith("video/") ? (
                <video
                  src={anexoAberto.url}
                  controls
                  autoPlay
                  className="max-h-[78vh] max-w-full rounded bg-black"
                />
              ) : (
                <div className="rounded bg-white p-8 text-center text-slate-500">
                  <p>{t("producao.controle.detalhe.previewIndisponivel")}</p>
                  <a
                    href={anexoAberto.url}
                    download={anexoAberto.name}
                    className="mt-3 inline-block text-primary-700"
                  >
                    {t("producao.controle.detalhe.baixarArquivo")}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
