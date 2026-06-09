import type {
  ColaboradorTv,
  ColunaKanbanId,
  OrdemServicoTv,
  PrioridadeOs,
  TvChartPoint,
  TvDashboardStats,
} from "@/components/modulo-tv/types";

export const COLABORADORES_TV: ColaboradorTv[] = [
  { id: "col-1", nome: "Rafael M.", online: true },
  { id: "col-2", nome: "Ana Paula", online: true },
  { id: "col-3", nome: "Bruno S.", online: true },
  { id: "col-4", nome: "Camila R.", online: true },
  { id: "col-5", nome: "Diego F.", online: true },
  { id: "col-6", nome: "Elena V.", online: false },
  { id: "col-7", nome: "Felipe T.", online: true },
];

function diasOffset(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(17, 0, 0, 0);
  return d;
}

function prazoBr(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function horasAtras(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function criarOs(
  id: string,
  numeroOs: number,
  paciente: string,
  dentista: string,
  prioridade: PrioridadeOs,
  coluna: ColunaKanbanId,
  diasPrazo: number,
  status: string,
  colaboradorIdx: number,
  horasNaEtapa: number
): OrdemServicoTv {
  const prazoDate = diasOffset(diasPrazo);
  const colab = COLABORADORES_TV[colaboradorIdx % COLABORADORES_TV.length];
  return {
    id,
    numeroOs,
    paciente,
    dentista,
    colaborador: colab.nome,
    colaboradorId: colab.id,
    prioridade,
    prazo: prazoBr(prazoDate),
    prazoIso: prazoDate.toISOString(),
    status,
    coluna,
    atrasada: diasPrazo < 0,
    etapaDesde: horasAtras(horasNaEtapa),
  };
}

export const ORDENS_MOCK_INICIAL: OrdemServicoTv[] = [
  criarOs("os-1", 1842, "Maria Helena Souza", "Dr. Ricardo Alves", "urgente", "recebido", -1, "Aguardando triagem", 0, 2),
  criarOs("os-2", 1843, "João Pedro Lima", "Dra. Camila Nogueira", "alta", "recebido", 0, "Entrada registrada", 1, 1),
  criarOs("os-3", 1844, "Ana Beatriz Costa", "Dr. Felipe Mendes", "normal", "recebido", 1, "Recebido", 2, 0.5),
  criarOs("os-4", 1835, "Carlos Eduardo Ribeiro", "Dr. Paulo Santana", "urgente", "escaneamento", -2, "Escaneando", 3, 5),
  criarOs("os-5", 1836, "Fernanda Dias", "Dra. Juliana Prado", "alta", "escaneamento", 0, "Modelo 3D", 4, 3),
  criarOs("os-6", 1837, "Lucas Martins", "Dr. André Vieira", "normal", "escaneamento", 1, "Validação scan", 0, 2),
  criarOs("os-7", 1828, "Patrícia Gomes", "Dra. Larissa Mota", "alta", "design", -1, "CAD em andamento", 1, 8),
  criarOs("os-8", 1829, "Roberto Silva", "Dr. Henrique Barros", "normal", "design", 1, "Planejamento", 2, 4),
  criarOs("os-9", 1830, "Juliana Freitas", "Dra. Beatriz Lopes", "baixa", "design", 2, "Aguardando aprovação", 3, 6),
  criarOs("os-10", 1831, "Marcos Antônio", "Dr. Gustavo Pires", "urgente", "design", 0, "Design prioritário", 4, 1),
  criarOs("os-11", 1820, "Helena Moura", "Dra. Vanessa Cruz", "alta", "impressao", 0, "Imprimindo", 5, 2),
  criarOs("os-12", 1821, "Tiago Nascimento", "Dr. Bruno Carvalho", "normal", "impressao", 1, "Fila impressora", 6, 5),
  criarOs("os-13", 1822, "Isabela Rocha", "Dra. Mariana Duarte", "normal", "impressao", 2, "Resina carregada", 0, 3),
  criarOs("os-14", 1815, "Rafael Torres", "Dr. Eduardo Maia", "alta", "acabamento", -1, "Pigmentação", 1, 7),
  criarOs("os-15", 1816, "Camila Borges", "Dra. Aline Ferreira", "normal", "acabamento", 0, "Acabamento", 2, 4),
  criarOs("os-16", 1817, "Diego Araújo", "Dr. Marcelo Rios", "baixa", "acabamento", 1, "Polimento", 3, 2),
  criarOs("os-17", 1810, "Larissa Pinto", "Dra. Carolina Sá", "normal", "pronto", 0, "Pronto p/ retirada", 4, 1),
  criarOs("os-18", 1811, "Gabriel Monteiro", "Dr. Fábio Lacerda", "alta", "pronto", 0, "Entrega hoje", 5, 0.5),
  criarOs("os-19", 1812, "Sofia Cardoso", "Dra. Renata Melo", "urgente", "pronto", 0, "Courier agendado", 6, 2),
  criarOs("os-20", 1813, "Otávio Cunha", "Dr. Leandro Peixoto", "normal", "pronto", 1, "Aguardando cliente", 0, 3),
];

export const COLUNAS_ORDEM: ColunaKanbanId[] = [
  "recebido",
  "escaneamento",
  "design",
  "impressao",
  "acabamento",
  "pronto",
];

export function calcularStats(ordens: OrdemServicoTv[]): TvDashboardStats {
  const emProducao = ordens.filter((o) => o.coluna !== "pronto").length;
  const atrasadas = ordens.filter((o) => o.atrasada).length;
  const hoje = new Date().toDateString();
  const entregasHoje = ordens.filter((o) => {
    if (o.coluna !== "pronto") return false;
    return new Date(o.prazoIso).toDateString() === hoje;
  }).length;
  const prontas = ordens.filter((o) => o.coluna === "pronto").length;
  const percentualConcluido = ordens.length
    ? Math.round((prontas / ordens.length) * 100)
    : 0;
  const colaboradoresOnline = COLABORADORES_TV.filter((c) => c.online).length;

  return {
    totalProducao: emProducao,
    atrasadas,
    entregasHoje: entregasHoje || Math.min(3, prontas),
    colaboradoresOnline,
    percentualConcluido,
  };
}

export function contagemPorColuna(ordens: OrdemServicoTv[]) {
  return COLUNAS_ORDEM.reduce(
    (acc, col) => {
      acc[col] = ordens.filter((o) => o.coluna === col).length;
      return acc;
    },
    {} as Record<ColunaKanbanId, number>
  );
}

export function criarPontoChart(ordens: OrdemServicoTv[]): TvChartPoint {
  const contagem = contagemPorColuna(ordens);
  const agora = new Date();
  return {
    timestamp: agora.toISOString(),
    label: agora.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    recebido: contagem.recebido,
    escaneamento: contagem.escaneamento,
    design: contagem.design,
    impressao: contagem.impressao,
    acabamento: contagem.acabamento,
    pronto: contagem.pronto,
    total: ordens.length,
  };
}

export function criarNovaOsMock(ordens: OrdemServicoTv[]): OrdemServicoTv {
  const numeroOs = 1800 + Math.floor(Math.random() * 120);
  const colab = COLABORADORES_TV[Math.floor(Math.random() * COLABORADORES_TV.length)];
  const prioridades: PrioridadeOs[] = ["urgente", "alta", "normal", "baixa"];
  const prioridade = prioridades[Math.floor(Math.random() * prioridades.length)];
  const prazoDate = diasOffset(1 + Math.floor(Math.random() * 3));

  return {
    id: `os-${Date.now()}`,
    numeroOs,
    paciente: `Paciente ${String.fromCharCode(65 + (ordens.length % 26))}. Silva`,
    dentista: "Dr. Entrada Automática",
    colaborador: colab.nome,
    colaboradorId: colab.id,
    prioridade,
    prazo: prazoBr(prazoDate),
    prazoIso: prazoDate.toISOString(),
    status: "Nova entrada",
    coluna: "recebido",
    atrasada: false,
    etapaDesde: new Date().toISOString(),
  };
}
