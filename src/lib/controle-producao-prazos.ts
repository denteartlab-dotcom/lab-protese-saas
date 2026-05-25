export type TipoPrazoProducao = "lab" | "dentista";

export type TrabalhoComPrazo = {
  status: string;
  dataEntrada: string | Date;
  dataPrevista?: string | null | Date;
  instrucoes?: string | null;
};

export function localDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function brDateToDate(value: string) {
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) return null;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return new Date(Number(fullYear), Number(month) - 1, Number(day));
}

export function prazoFromInstructions(
  instrucoes: string | null | undefined,
  tipo: TipoPrazoProducao
) {
  const text = instrucoes || "";
  if (tipo === "dentista") {
    const dentista = text.match(/Data dentista:\s*(\d{2}\/\d{2}\/\d{2,4})/i);
    if (dentista) return brDateToDate(dentista[1]);
  }
  const lab = text.match(/Data laboratório:\s*(\d{2}\/\d{2}\/\d{2,4})/i);
  if (lab) return brDateToDate(lab[1]);
  if (tipo === "lab") {
    const dentistaFallback = text.match(/Data dentista:\s*(\d{2}\/\d{2}\/\d{2,4})/i);
    if (dentistaFallback) return brDateToDate(dentistaFallback[1]);
  }
  return null;
}

export function prazoTrabalho(trabalho: TrabalhoComPrazo, tipo: TipoPrazoProducao = "lab") {
  if (tipo === "lab" && trabalho.dataPrevista) {
    const date = new Date(trabalho.dataPrevista);
    if (!Number.isNaN(date.getTime())) return localDate(date);
  }
  const fromInstrucoes = prazoFromInstructions(trabalho.instrucoes, tipo);
  if (fromInstrucoes) return fromInstrucoes;
  const entrada = new Date(trabalho.dataEntrada);
  if (!Number.isNaN(entrada.getTime())) return localDate(entrada);
  return null;
}

export function trabalhoAtivo(status: string) {
  return !["finalizado", "entregue", "cancelado"].includes(status);
}

export function isTrabalhoAtrasado(
  trabalho: TrabalhoComPrazo,
  tipo: TipoPrazoProducao = "lab",
  referencia = localDate(new Date())
) {
  if (!trabalhoAtivo(trabalho.status)) return false;
  const prazo = prazoTrabalho(trabalho, tipo);
  return prazo ? prazo < referencia : false;
}

export function isTrabalhoVencendoNoDia(
  trabalho: TrabalhoComPrazo,
  dia: Date,
  tipo: TipoPrazoProducao = "lab"
) {
  if (!trabalhoAtivo(trabalho.status)) return false;
  const prazo = prazoTrabalho(trabalho, tipo);
  if (!prazo) return false;
  return prazo.getTime() === localDate(dia).getTime();
}

export function filtrarTrabalhosAtrasados<T extends TrabalhoComPrazo>(
  trabalhos: T[],
  tipo: TipoPrazoProducao = "lab"
) {
  const hoje = localDate(new Date());
  return trabalhos.filter((t) => isTrabalhoAtrasado(t, tipo, hoje));
}

export function filtrarTrabalhosVencendoHoje<T extends TrabalhoComPrazo>(
  trabalhos: T[],
  tipo: TipoPrazoProducao = "lab"
) {
  return filtrarTrabalhosVencendoPeriodo(trabalhos, tipo, "hoje");
}

export function dateKeyLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDiaMesBr(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Hoje + próximos N dias no formato do Smart Prótese (até DD/MM). */
export function opcoesPeriodoVencendo(diasFuturos = 5) {
  const hoje = localDate(new Date());
  const opcoes: Array<{ value: string; label: string }> = [{ value: "hoje", label: "Hoje" }];
  for (let i = 1; i <= diasFuturos; i++) {
    const dia = new Date(hoje);
    dia.setDate(hoje.getDate() + i);
    opcoes.push({
      value: dateKeyLocal(dia),
      label: `até ${formatDiaMesBr(dia)}`,
    });
  }
  return opcoes;
}

/**
 * Serviços vencendo: prazo entre hoje e a data escolhida (sem atrasados).
 * periodo = "hoje" ou "YYYY-MM-DD" (fim do intervalo).
 */
export function filtrarTrabalhosVencendoPeriodo<T extends TrabalhoComPrazo>(
  trabalhos: T[],
  tipo: TipoPrazoProducao = "lab",
  periodo = "hoje"
) {
  const hoje = localDate(new Date());
  let fim = hoje;
  if (periodo !== "hoje") {
    const [year, month, day] = periodo.split("-").map(Number);
    if (year && month && day) fim = localDate(new Date(year, month - 1, day));
  }
  const inicioMs = hoje.getTime();
  const fimMs = fim.getTime();

  return trabalhos.filter((trabalho) => {
    if (!trabalhoAtivo(trabalho.status)) return false;
    const prazo = prazoTrabalho(trabalho, tipo);
    if (!prazo) return false;
    const prazoMs = prazo.getTime();
    return prazoMs >= inicioMs && prazoMs <= fimMs;
  });
}

export function ordenarTrabalhosPorOsDesc<T extends { numeroOs: number }>(lista: T[]) {
  return [...lista].sort((a, b) => b.numeroOs - a.numeroOs);
}

export function caixaDeInstrucoes(instrucoes?: string | null) {
  const line = (instrucoes || "")
    .split("\n")
    .find((item) => item.trim().startsWith("Caixa:"));
  return line?.replace(/^Caixa:\s*/i, "").trim() || "";
}

export function periodoVencendoNotificacoes() {
  const opcoes = opcoesPeriodoVencendo(5);
  return opcoes[opcoes.length - 1]?.value ?? "hoje";
}
