import type {
  ColunaKanbanId,
  OrdemServicoTv,
  PrioridadeOs,
  TvDashboardStats,
} from "@/components/modulo-tv/types";

function diasOffset(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(17, 0, 0, 0);
  return d;
}

function prazoBr(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function criarOs(
  id: string,
  numeroOs: number,
  paciente: string,
  dentista: string,
  prioridade: PrioridadeOs,
  coluna: ColunaKanbanId,
  diasPrazo: number,
  status: string
): OrdemServicoTv {
  const prazoDate = diasOffset(diasPrazo);
  const atrasada = diasPrazo < 0;
  return {
    id,
    numeroOs,
    paciente,
    dentista,
    prioridade,
    prazo: prazoBr(prazoDate),
    prazoIso: prazoDate.toISOString(),
    status,
    coluna,
    atrasada,
  };
}

export const ORDENS_MOCK_INICIAL: OrdemServicoTv[] = [
  criarOs("os-1", 1842, "Maria Helena Souza", "Dr. Ricardo Alves", "urgente", "recebido", -1, "Aguardando triagem"),
  criarOs("os-2", 1843, "João Pedro Lima", "Dra. Camila Nogueira", "alta", "recebido", 0, "Entrada registrada"),
  criarOs("os-3", 1844, "Ana Beatriz Costa", "Dr. Felipe Mendes", "normal", "recebido", 1, "Recebido"),
  criarOs("os-4", 1835, "Carlos Eduardo Ribeiro", "Dr. Paulo Santana", "urgente", "escaneamento", -2, "Escaneando"),
  criarOs("os-5", 1836, "Fernanda Dias", "Dra. Juliana Prado", "alta", "escaneamento", 0, "Modelo 3D"),
  criarOs("os-6", 1837, "Lucas Martins", "Dr. André Vieira", "normal", "escaneamento", 1, "Validação scan"),
  criarOs("os-7", 1828, "Patrícia Gomes", "Dra. Larissa Mota", "alta", "design", -1, "CAD em andamento"),
  criarOs("os-8", 1829, "Roberto Silva", "Dr. Henrique Barros", "normal", "design", 1, "Planejamento"),
  criarOs("os-9", 1830, "Juliana Freitas", "Dra. Beatriz Lopes", "baixa", "design", 2, "Aguardando aprovação"),
  criarOs("os-10", 1831, "Marcos Antônio", "Dr. Gustavo Pires", "urgente", "design", 0, "Design prioritário"),
  criarOs("os-11", 1820, "Helena Moura", "Dra. Vanessa Cruz", "alta", "impressao", 0, "Imprimindo"),
  criarOs("os-12", 1821, "Tiago Nascimento", "Dr. Bruno Carvalho", "normal", "impressao", 1, "Fila impressora"),
  criarOs("os-13", 1822, "Isabela Rocha", "Dra. Mariana Duarte", "normal", "impressao", 2, "Resina carregada"),
  criarOs("os-14", 1815, "Rafael Torres", "Dr. Eduardo Maia", "alta", "acabamento", -1, "Pigmentação"),
  criarOs("os-15", 1816, "Camila Borges", "Dra. Aline Ferreira", "normal", "acabamento", 0, "Acabamento"),
  criarOs("os-16", 1817, "Diego Araújo", "Dr. Marcelo Rios", "baixa", "acabamento", 1, "Polimento"),
  criarOs("os-17", 1810, "Larissa Pinto", "Dra. Carolina Sá", "normal", "pronto", 0, "Pronto p/ retirada"),
  criarOs("os-18", 1811, "Gabriel Monteiro", "Dr. Fábio Lacerda", "alta", "pronto", 0, "Entrega hoje"),
  criarOs("os-19", 1812, "Sofia Cardoso", "Dra. Renata Melo", "urgente", "pronto", 0, "Courier agendado"),
  criarOs("os-20", 1813, "Otávio Cunha", "Dr. Leandro Peixoto", "normal", "pronto", 1, "Aguardando cliente"),
];

const COLUNAS_ORDEM: ColunaKanbanId[] = [
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

  return {
    totalProducao: emProducao,
    atrasadas,
    entregasHoje: entregasHoje || ordens.filter((o) => o.coluna === "pronto").slice(0, 3).length,
    colaboradoresOnline: 7 + (ordens.length % 4),
    percentualConcluido,
  };
}

export function simularAtualizacaoWs(
  ordens: OrdemServicoTv[]
): OrdemServicoTv[] {
  const copia = ordens.map((o) => ({ ...o }));
  const idx = Math.floor(Math.random() * copia.length);
  const os = copia[idx];
  const colIdx = COLUNAS_ORDEM.indexOf(os.coluna);
  if (colIdx >= 0 && colIdx < COLUNAS_ORDEM.length - 1 && Math.random() > 0.35) {
    os.coluna = COLUNAS_ORDEM[colIdx + 1];
    os.status =
      os.coluna === "pronto"
        ? "Pronto / Entrega"
        : `${COLUNAS_ORDEM[colIdx + 1]} — atualizado`;
  }
  if (Math.random() > 0.7) {
    const nova = criarOs(
      `os-${Date.now()}`,
      1800 + Math.floor(Math.random() * 80),
      "Paciente Novo",
      "Dr. Demo Smart",
      "normal",
      "recebido",
      1,
      "Nova entrada"
    );
    copia.unshift(nova);
  }
  return copia.slice(0, 24);
}
