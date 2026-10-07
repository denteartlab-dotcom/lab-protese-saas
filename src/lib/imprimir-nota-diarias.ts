import type { NotaPagamentoDiariasInput } from "@/lib/pdf-nota-pagamento-diarias";
import {
  gerarNotaPagamentoDiariasPdf,
  nomeArquivoNotaDiarias,
} from "@/lib/pdf-nota-pagamento-diarias";
import type { Locale } from "@/lib/i18n";
import { abrirPdfGerando } from "@/lib/pdf-viewer";

export async function imprimirNotasPagamentoDiarias(
  notas: NotaPagamentoDiariasInput[],
  locale: Locale
) {
  if (notas.length === 0) return false;
  await abrirPdfGerando(
    () => gerarNotaPagamentoDiariasPdf(notas, locale),
    nomeArquivoNotaDiarias(notas),
    undefined
  );
  return true;
}
