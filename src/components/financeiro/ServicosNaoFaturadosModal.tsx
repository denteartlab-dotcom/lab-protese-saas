"use client";

import { useMemo, useState } from "react";
import { FileText, Printer, X } from "lucide-react";
import {
  labelSituacaoOsReceita,
  SituacaoOsBadgeReceita,
  type TrabalhoSituacaoBadge,
} from "@/components/financeiro/SituacaoOsBadgeReceita";
import { abrirPdfNoVisualizador, prepararAbaPdf } from "@/lib/pdf-viewer";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";
import {
  contagemItensOsPorSegmento,
  rotuloContagemSegmentosOs,
} from "@/lib/trabalho-os-segmento";

export type TrabalhoNaoFaturado = TrabalhoSituacaoBadge & {
  valor?: number;
  dentes?: string | null;
  cor?: string | null;
  instrucoes?: string | null;
  cliente?: { nome?: string | null } | null;
  paciente?: { nome?: string | null } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  trabalhos: TrabalhoNaoFaturado[];
  /** Todos os trabalhos — usado para contar itens da OS (serv./prod./transp.). */
  trabalhosReferencia?: TrabalhoNaoFaturado[];
  valorTrabalho: (trabalho: TrabalhoNaoFaturado) => number;
};

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ServicosNaoFaturadosModal({
  open,
  onClose,
  trabalhos,
  trabalhosReferencia,
  valorTrabalho,
}: Props) {
  const [busca, setBusca] = useState("");
  const baseContagem = trabalhosReferencia ?? trabalhos;

  const contagemPorOs = useMemo(() => {
    const mapa = new Map<number, string>();
    const numeros = new Set(baseContagem.map((t) => t.numeroOs));
    for (const numeroOs of numeros) {
      mapa.set(
        numeroOs,
        rotuloContagemSegmentosOs(contagemItensOsPorSegmento(baseContagem, numeroOs))
      );
    }
    return mapa;
  }, [baseContagem]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return trabalhos;
    return trabalhos.filter((trabalho) => {
      const situacao = labelSituacaoOsReceita(trabalho).toLowerCase();
      return [
        trabalho.numeroOs,
        trabalho.cliente?.nome,
        trabalho.paciente?.nome,
        trabalho.tipoProtese,
        trabalho.dentes,
        trabalho.cor,
        situacao,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(termo));
    });
  }, [trabalhos, busca]);

  async function abrirPdfVisualizador(janelaReservada: Window | null) {
    try {
      const blob = await gerarRelatorioTabelaPdf({
        tituloRelatorio: "Serviços Entregues/Finalizados e não Faturados",
        periodoTexto: "",
        colunas: [
          { titulo: "OS", larguraMm: 12, alinhamento: "center" },
          { titulo: "Cliente", larguraMm: 28, alinhamento: "left" },
          { titulo: "Serviço", larguraMm: 28, alinhamento: "left" },
          { titulo: "Qtd OS", larguraMm: 26, alinhamento: "left" },
          { titulo: "Paciente", larguraMm: 24, alinhamento: "left" },
          { titulo: "Num Dente", larguraMm: 16, alinhamento: "center" },
          { titulo: "Cor", larguraMm: 14, alinhamento: "center" },
          { titulo: "Valor", larguraMm: 20, alinhamento: "right" },
          { titulo: "Situação", larguraMm: 20, alinhamento: "center" },
        ],
        linhas: filtrados.map((t) => [
          String(t.numeroOs),
          t.cliente?.nome || "—",
          t.tipoProtese,
          contagemPorOs.get(t.numeroOs) || "—",
          t.paciente?.nome || "—",
          t.dentes || "—",
          t.cor || "—",
          money(valorTrabalho(t)),
          labelSituacaoOsReceita(t),
        ]),
      });
      abrirPdfNoVisualizador(
        blob,
        "servicos-nao-faturados.pdf",
        "Serviços Entregues/Finalizados e não Faturados",
        janelaReservada
      );
    } catch {
      janelaReservada?.close();
      alert("Não foi possível gerar o PDF.");
    }
  }

  function acionarPdf() {
    const janela = prepararAbaPdf();
    void abrirPdfVisualizador(janela);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/45 p-4 pt-10">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        className="relative flex max-h-[88vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-nao-faturados-titulo"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-5 py-3.5">
          <h2
            id="modal-nao-faturados-titulo"
            className="text-[15px] font-normal text-[#374151]"
          >
            Serviços Entregues/Finalizados e não Faturados
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#f3f4f6] px-5 py-3">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="os, situação, paciente, serviço e cliente"
            className="h-[34px] min-w-[200px] flex-1 rounded-sm border border-[#d1d5db] px-3 text-[13px] text-[#374151] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
          />
          <button
            type="button"
            onClick={() => setBusca("")}
            className="h-[34px] shrink-0 rounded-sm border border-[#d1d5db] bg-[#f9fafb] px-4 text-[13px] text-[#6b7280] hover:bg-[#f3f4f6]"
          >
            Limpar
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={acionarPdf}
              className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-sm border border-[#d1d5db] bg-white text-[#6b7280] hover:bg-[#f9fafb]"
              title="Imprimir"
              aria-label="Imprimir"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={acionarPdf}
              className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-sm border border-[#d1d5db] bg-white text-[#6b7280] hover:bg-[#f9fafb]"
              title="PDF"
              aria-label="Exportar PDF"
            >
              <FileText className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <table className="w-full min-w-[900px] border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                <th className="border-b border-[#e5e7eb] px-3 py-2.5 text-left">OS</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2.5 text-left">Cliente</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2.5 text-left">Serviço</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2.5 text-left">Qtd OS</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2.5 text-left">Paciente</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2.5 text-left">Num Dente</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2.5 text-left">Cor</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2.5 text-right">Valor</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2.5 text-center">Situação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-10 text-center text-[13px] text-[#9ca3af]"
                  >
                    Nenhum serviço entregue/finalizado pendente de faturamento.
                  </td>
                </tr>
              ) : (
                filtrados.map((trabalho) => (
                  <tr
                    key={trabalho.id}
                    className="border-b border-[#f3f4f6] hover:bg-[#fafafa]"
                  >
                    <td className="px-3 py-2.5 text-[#374151]">{trabalho.numeroOs}</td>
                    <td className="px-3 py-2.5 text-[#374151]">
                      {trabalho.cliente?.nome || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[#374151]">{trabalho.tipoProtese}</td>
                    <td className="px-3 py-2.5 text-[11px] leading-snug text-[#6b7280]">
                      {contagemPorOs.get(trabalho.numeroOs) || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[#374151]">
                      {trabalho.paciente?.nome || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[#374151]">{trabalho.dentes || ""}</td>
                    <td className="px-3 py-2.5 text-[#374151]">{trabalho.cor || ""}</td>
                    <td className="px-3 py-2.5 text-right text-[#374151]">
                      {money(valorTrabalho(trabalho))}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <SituacaoOsBadgeReceita trabalho={trabalho} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
