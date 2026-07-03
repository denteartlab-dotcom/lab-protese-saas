/** Tipos e helpers puros de relatório de entregas (sem controle-entregas / servidor). */

export const MODELOS_RELATORIO_ENTREGAS = [
  { value: "entregas-modelo-1", label: "Entregas - Modelo 1" },
  { value: "entregas-modelo-2", label: "Entregas - Modelo 2 (por entregador)" },
  { value: "entregas-modelo-3", label: "Entregas - Modelo 3 (completo)" },
  { value: "entregas-pendentes", label: "Entregas Pendentes" },
  { value: "entregas-em-rota", label: "Entregas Em Rota" },
  { value: "entregas-finalizadas", label: "Entregas Finalizadas" },
] as const;

export type ModeloRelatorioEntregas =
  (typeof MODELOS_RELATORIO_ENTREGAS)[number]["value"];

export type LinhaRelatorioEntrega = {
  dataPedido: string;
  dataFinalizado: string;
  destinatario: string;
  entregador: string;
  descricao: string;
  nomeRecebedor: string;
  situacao: string;
  situacaoLabel: string;
  valor: number;
  valorLabel: string;
  numeroOs: string;
  situacaoOs: string;
  clienteOs: string;
  pacienteOs: string;
  dataEntregaOs: string;
  dataOrdenacao: Date;
  entregadorGrupo: string;
};

export function agruparPorEntregador(linhas: LinhaRelatorioEntrega[]) {
  const grupos = new Map<string, LinhaRelatorioEntrega[]>();
  for (const linha of linhas) {
    const chave = linha.entregadorGrupo;
    const lista = grupos.get(chave) || [];
    lista.push(linha);
    grupos.set(chave, lista);
  }
  return Array.from(grupos.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], "pt-BR")
  );
}
