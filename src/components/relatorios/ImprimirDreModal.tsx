"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { useI18n } from "@/components/i18n-provider";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileSpreadsheet, Printer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { calcularMatrizDre, MESES_DRE } from "@/lib/dre";
import {
  dreMesSemDados,
  exportarRelatorioDreMesCsv,
  montarRelatorioDreMes,
  type TipoRelatorioDre,
} from "@/lib/dre-relatorio";
import {
  CATEGORIAS_RELATORIO_DRE_DETALHADO,
  exportarRelatorioDreDetalhadoCsv,
  IDS_CATEGORIAS_DRE_DETALHADO_PADRAO,
  montarRelatorioDreDetalhadoItens,
  type DreCategoriaRelatorioId,
} from "@/lib/dre-relatorio-detalhado";
import { gerarRelatorioDreDetalhadoPdf } from "@/lib/dre-relatorio-detalhado-pdf";
import { gerarRelatorioDrePdf } from "@/lib/dre-relatorio-pdf";
import type { DreMatriz } from "@/lib/dre";
import type { ItemPlanoContas } from "@/lib/plano-contas";
import { prepararAbaPdf } from "@/lib/pdf-viewer";
import { abrirPdfBlobGerandoNoVisualizadorUnificado } from "@/lib/pdf-viewer-unificado";

const selectClass =
  "h-[36px] w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9]";

type ImprimirDreModalProps = {
  open: boolean;
  onClose: () => void;
  matriz: DreMatriz;
  planoContas: ItemPlanoContas[];
  anoPadrao: number;
};

export function ImprimirDreModal({
  open,
  onClose,
  matriz,
  planoContas,
  anoPadrao,
}: ImprimirDreModalProps) {
  const { t } = useI18n();
  const [tipo, setTipo] = useState<TipoRelatorioDre>("detalhado");
  const [mesIndex, setMesIndex] = useState(new Date().getMonth());
  const [ano, setAno] = useState(anoPadrao);
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<
    DreCategoriaRelatorioId[]
  >(IDS_CATEGORIAS_DRE_DETALHADO_PADRAO);
  const [menuAdicionarAberto, setMenuAdicionarAberto] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipo("detalhado");
    setMesIndex(new Date().getMonth());
    setAno(anoPadrao);
    setCategoriasSelecionadas([...IDS_CATEGORIAS_DRE_DETALHADO_PADRAO]);
    setMenuAdicionarAberto(false);
  }, [open, anoPadrao]);

  const categoriasDisponiveis = useMemo(
    () =>
      CATEGORIAS_RELATORIO_DRE_DETALHADO.filter(
        (c) => !categoriasSelecionadas.includes(c.id)
      ),
    [categoriasSelecionadas]
  );

  if (!open) return null;

  const matrizAno = { ...matriz, ano };

  async function imprimir() {
    if (tipo === "detalhado" && categoriasSelecionadas.length === 0) {
      alert(t("relatorio.dre.alertaSemCategoria"));
      return;
    }

    setGerando(true);
    setProgresso(10);
    const janela = prepararAbaPdf();
    try {
      const lancamentos = matriz.lancamentos ?? [];

      if (dreMesSemDados(lancamentos, ano, mesIndex)) {
        janela?.close();
        alert(t("relatorio.dre.alertaSemLancamentos"));
        onClose();
        return;
      }

      const matrizAnoLocal = calcularMatrizDre(lancamentos, ano, planoContas);
      setProgresso(40);

      if (tipo === "detalhado") {
        const relatorio = montarRelatorioDreDetalhadoItens(
          matrizAnoLocal,
          mesIndex,
          planoContas,
          categoriasSelecionadas
        );
        await abrirPdfBlobGerandoNoVisualizadorUnificado(
          () => gerarRelatorioDreDetalhadoPdf(relatorio),
          relatorio.titulo,
          `relatorio-dre-detalhado-${mesIndex + 1}-${ano}.pdf`,
          { janela, origem: t("relatorio.origemPdf") }
        );
      } else {
        const relatorio = montarRelatorioDreMes(
          matrizAnoLocal,
          mesIndex,
          planoContas,
          "resumo"
        );
        await abrirPdfBlobGerandoNoVisualizadorUnificado(
          () => gerarRelatorioDrePdf(relatorio),
          relatorio.titulo,
          `relatorio-dre-${mesIndex + 1}-${ano}.pdf`,
          { janela, origem: t("relatorio.origemPdf") }
        );
      }

      setProgresso(100);
      onClose();
    } catch (err) {
      janela?.close();
      console.error("gerar PDF DRE", err);
      alert(t("relatorio.alerta.pdfErro"));
    } finally {
      setGerando(false);
      setProgresso(0);
    }
  }

  function exportarExcel() {
    if (tipo === "detalhado") {
      if (categoriasSelecionadas.length === 0) {
        alert(t("relatorio.dre.alertaSemCategoriaExport"));
        return;
      }
      const relatorio = montarRelatorioDreDetalhadoItens(
        matrizAno,
        mesIndex,
        planoContas,
        categoriasSelecionadas
      );
      exportarRelatorioDreDetalhadoCsv(relatorio);
      return;
    }
    const relatorio = montarRelatorioDreMes(
      matrizAno,
      mesIndex,
      planoContas,
      tipo
    );
    exportarRelatorioDreMesCsv(relatorio);
  }

  function removerCategoria(id: DreCategoriaRelatorioId) {
    setCategoriasSelecionadas((prev) => prev.filter((c) => c !== id));
    setMenuAdicionarAberto(false);
  }

  function adicionarCategoria(id: DreCategoriaRelatorioId) {
    setCategoriasSelecionadas((prev) =>
      [...prev, id].sort(
        (a, b) =>
          IDS_CATEGORIAS_DRE_DETALHADO_PADRAO.indexOf(a) -
          IDS_CATEGORIAS_DRE_DETALHADO_PADRAO.indexOf(b)
      )
    );
    setMenuAdicionarAberto(false);
  }

  const anos = [anoPadrao - 1, anoPadrao, anoPadrao + 1];

  return (
    <I18nPortal>
      <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4">
      <div
        className={cn(
          "w-full rounded-md border border-[#e5e7eb] bg-white shadow-xl",
          tipo === "detalhado" ? "max-w-lg" : "max-w-md"
        )}
        role="dialog"
        aria-labelledby="imprimir-dre-titulo"
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
          <h2
            id="imprimir-dre-titulo"
            className="text-[14px] font-semibold text-[#374151]"
          >
            {t("relatorio.dre.imprimirTitulo")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#374151]"
            aria-label={t("cadastros.comum.fechar")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-6 text-[12px] text-[#374151]">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="tipo-dre-print"
                checked={tipo === "resumo"}
                onChange={() => setTipo("resumo")}
                className="accent-[#4a90d9]"
              />
              {t("relatorio.dre.tipoResumo")}
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="tipo-dre-print"
                checked={tipo === "detalhado"}
                onChange={() => setTipo("detalhado")}
                className="accent-[#4a90d9]"
              />
              {t("relatorio.dre.tipoDetalhado")}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] text-[#6b7280]">
                {t("relatorio.dre.selecioneMes")}
              </label>
              <select
                className={selectClass}
                value={mesIndex}
                onChange={(e) => setMesIndex(Number(e.target.value))}
              >
                {MESES_DRE.map((mes, i) => (
                  <option key={mes} value={i}>
                    {mes.charAt(0) + mes.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-[#6b7280]">
                {t("relatorio.dre.selecioneAno")}
              </label>
              <select
                className={selectClass}
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
              >
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {tipo === "detalhado" && (
            <div>
              <label className="mb-1 block text-[11px] text-[#6b7280]">
                {t("relatorio.dre.categoriasSelecionadas")}
              </label>
              <div className="min-h-[80px] rounded-sm border border-[#d1d5db] bg-white p-2">
                <div className="flex flex-wrap gap-1.5">
                  {categoriasSelecionadas.map((id) => {
                    const cat = CATEGORIAS_RELATORIO_DRE_DETALHADO.find(
                      (c) => c.id === id
                    );
                    if (!cat) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex max-w-full items-center gap-1 rounded-sm bg-[#4a90d9] px-2 py-1 text-[11px] text-white"
                      >
                        <span className="truncate">{cat.label}</span>
                        <button
                          type="button"
                          onClick={() => removerCategoria(id)}
                          className="shrink-0 rounded hover:bg-white/20"
                          aria-label={t("relatorio.comum.removerItem", { item: cat.label })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                  {categoriasSelecionadas.length === 0 && (
                    <p className="text-[11px] text-[#9ca3af]">
                      {t("relatorio.dre.nenhumaCategoria")}
                    </p>
                  )}
                </div>
                {categoriasDisponiveis.length > 0 && (
                  <div className="relative mt-2">
                    <button
                      type="button"
                      onClick={() => setMenuAdicionarAberto((v) => !v)}
                      className="flex items-center gap-1 text-[11px] text-[#4a90d9] hover:underline"
                    >
                      {t("relatorio.dre.adicionarCategoria")}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {menuAdicionarAberto && (
                      <ul className="absolute left-0 z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-sm border border-[#e5e7eb] bg-white py-1 shadow-md">
                        {categoriasDisponiveis.map((cat) => (
                          <li key={cat.id}>
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-[11px] text-[#374151] hover:bg-[#f3f4f6]"
                              onClick={() => adicionarCategoria(cat.id)}
                            >
                              {cat.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-1 text-[10px] text-[#9ca3af]">
                {t("relatorio.dre.categoriasDica")}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-[#e5e7eb] px-4 py-4">
          <button
            type="button"
            disabled={gerando}
            onClick={() => void imprimir()}
            className={cn(
              "flex h-[36px] min-w-[110px] items-center justify-center gap-2 rounded-sm bg-[#22c55e] px-4 text-[12px] font-medium text-white hover:bg-[#16a34a] disabled:opacity-60"
            )}
          >
            <Printer className="h-4 w-4" />
            {gerando
              ? progresso > 0
                ? t("relatorio.gerandoPdf", { progresso })
                : t("relatorio.gerando")
              : t("relatorio.imprimir")}
          </button>
          <button
            type="button"
            onClick={exportarExcel}
            className="flex h-[36px] min-w-[100px] items-center justify-center gap-2 rounded-sm bg-[#4a90d9] px-4 text-[12px] font-medium text-white hover:bg-[#3d7fc4]"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t("relatorio.excel")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[36px] min-w-[100px] items-center justify-center gap-2 rounded-sm bg-[#f06292] px-4 text-[12px] font-medium text-white hover:bg-[#ec407a]"
          >
            <X className="h-4 w-4" />
            {t("cadastros.comum.fechar")}
          </button>
        </div>
      </div>
    </div>
    </I18nPortal>
  );
}
