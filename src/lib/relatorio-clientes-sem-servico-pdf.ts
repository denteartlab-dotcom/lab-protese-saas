import {
  ordenarClientesSemServicoPorMenosTempo,
  type ClienteSemServicoItem,
} from "@/lib/dashboard-clientes-servico";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";
import { formatDate } from "@/lib/utils";

/** PDF do painel do dashboard — módulo isolado (sem imports de servidor). */
export async function gerarClientesSemServicoPdf(
  titulo: string,
  diasMinimos: number,
  lista: ClienteSemServicoItem[]
) {
  const ordenada = ordenarClientesSemServicoPorMenosTempo(lista);
  return gerarRelatorioTabelaPdf({
    tituloRelatorio: titulo,
    periodoTexto: `Não solicita serviço há mais de ${diasMinimos} dias`,
    colunas: [
      { titulo: "Cliente", larguraMm: 120, alinhamento: "left" },
      { titulo: "Data último", larguraMm: 56, alinhamento: "right" },
    ],
    linhas: ordenada.map((cliente) => [
      cliente.nome,
      cliente.ultimoServicoEm ? formatDate(cliente.ultimoServicoEm) : "—",
    ]),
  });
}
