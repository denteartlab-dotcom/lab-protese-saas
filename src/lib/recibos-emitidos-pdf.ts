import type { LinhaReciboEmitido } from "@/lib/recibos-emitidos";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";
import type { Locale } from "@/lib/i18n";
import {
  iniciarImpressaoRelatorio,
  moneyRelatorio,
  pl,
} from "@/lib/i18n/print-relatorio-helpers";
import { periodoPdf, tradutorImpressao } from "@/lib/i18n/relatorio-print-i18n";

export function formatarPeriodoRecibosEmitidos(
  dataInicio: string,
  dataFim: string,
  locale?: Locale
) {
  if (locale) iniciarImpressaoRelatorio({ locale });
  const a = dataInicio?.trim() || "—";
  const b = dataFim?.trim() || "—";
  return periodoPdf(a, b);
}

export async function gerarRelatorioRecibosEmitidosPdf(
  linhas: LinhaReciboEmitido[],
  dataInicio: string,
  dataFim: string,
  opts?: { locale?: Locale }
) {
  iniciarImpressaoRelatorio({ locale: opts?.locale });
  const t = tradutorImpressao();
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  return gerarRelatorioTabelaPdf({
    tituloRelatorio: t("relatorio.recibos.tituloPdf"),
    periodoTexto: formatarPeriodoRecibosEmitidos(dataInicio, dataFim),
    colunas: [
      { titulo: pl("print.extrato.data"), larguraMm: 32, alinhamento: "left" },
      { titulo: pl("print.relatorio.cliente"), larguraMm: 88, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.valor"), larguraMm: 56, alinhamento: "right" },
    ],
    linhas: linhas.map((l) => [
      l.dataLabel,
      l.clienteNome,
      moneyRelatorio(l.valor),
    ]),
    linhaTotal: {
      indiceRotulo: 1,
      rotulo: pl("print.relatorio.total"),
      celulas: [null, null, moneyRelatorio(total)],
    },
  });
}
