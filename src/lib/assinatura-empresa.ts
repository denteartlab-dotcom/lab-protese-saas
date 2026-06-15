export type DadosAssinaturaEmpresa = {
  status: string;
  dataVencimento: Date | string | null;
};

export type StatusPagamentoAssinatura = "PAGO" | "VENCIDO" | "PENDENTE";

export function calcularDataVencimentoAssinatura(dias: number, base = new Date()): Date {
  const data = new Date(base);
  data.setHours(12, 0, 0, 0);
  data.setDate(data.getDate() + Math.max(1, Math.floor(dias)));
  return data;
}

export function normalizarDataAssinatura(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const data = value instanceof Date ? value : new Date(value);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function empresaAssinaturaExpirada(dataVencimento: Date | string | null | undefined): boolean {
  const vencimento = normalizarDataAssinatura(dataVencimento);
  if (!vencimento) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limite = new Date(vencimento);
  limite.setHours(23, 59, 59, 999);
  return limite < hoje;
}

export function empresaAguardandoAtivacao(status: string): boolean {
  return status === "pendente" || status === "inativo";
}

export function empresaTemAcessoAssinatura(empresa: DadosAssinaturaEmpresa): boolean {
  if (empresa.status !== "ativo") return false;
  const vencimento = normalizarDataAssinatura(empresa.dataVencimento);
  if (!vencimento) return false;
  return !empresaAssinaturaExpirada(vencimento);
}

/** Login permitido, mas usuário deve ir para /assinatura-vencida. */
export function empresaPrecisaPaginaRenovacao(empresa: DadosAssinaturaEmpresa): boolean {
  if (empresaBloqueadaAguardandoAtivacao(empresa)) return false;
  if (empresa.status === "bloqueado") return true;
  const vencimento = normalizarDataAssinatura(empresa.dataVencimento);
  if (!vencimento) return false;
  return empresaAssinaturaExpirada(vencimento);
}

export function empresaBloqueadaAguardandoAtivacao(empresa: DadosAssinaturaEmpresa): boolean {
  if (empresaAguardandoAtivacao(empresa.status)) return true;
  if (empresa.status === "ativo" && !normalizarDataAssinatura(empresa.dataVencimento)) {
    return true;
  }
  return false;
}

export function statusPagamentoAssinatura(empresa: DadosAssinaturaEmpresa): StatusPagamentoAssinatura {
  if (empresaBloqueadaAguardandoAtivacao(empresa)) return "PENDENTE";
  if (empresaPrecisaPaginaRenovacao(empresa)) return "VENCIDO";
  return "PAGO";
}

export function mensagemBloqueioAssinatura(empresa: DadosAssinaturaEmpresa): string {
  if (empresaAguardandoAtivacao(empresa.status)) {
    return "Sua conta foi criada, mas a assinatura ainda não foi ativada. Aguarde a liberação pelo administrador.";
  }
  if (empresa.status === "bloqueado") {
    return "Laboratório bloqueado. Entre em contato com o suporte.";
  }
  if (empresaAssinaturaExpirada(empresa.dataVencimento)) {
    return "Sua assinatura expirou. Escolha um plano para continuar usando o sistema.";
  }
  if (empresa.status === "ativo" && !normalizarDataAssinatura(empresa.dataVencimento)) {
    return "Assinatura sem data de validade. Aguarde a ativação pelo administrador.";
  }
  return "Laboratório indisponível. Contate o suporte.";
}

export function formatarDataAssinatura(data: Date | string | null | undefined): string {
  const normalizada = normalizarDataAssinatura(data);
  if (!normalizada) return "—";
  return normalizada.toLocaleDateString("pt-BR");
}

export function diasRestantesAssinatura(
  dataVencimento: Date | string | null | undefined
): number | null {
  const vencimento = normalizarDataAssinatura(dataVencimento);
  if (!vencimento) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limite = new Date(vencimento);
  limite.setHours(0, 0, 0, 0);
  return Math.ceil((limite.getTime() - hoje.getTime()) / 86400000);
}

/** Empilha dias sobre a validade atual (se ainda vigente) ou a partir de hoje. */
export function calcularRenovacaoAssinaturaEmpilhada(
  dataVencimentoAtual: Date | string | null | undefined,
  dias: number
): Date {
  const vencimento = normalizarDataAssinatura(dataVencimentoAtual);
  const base =
    vencimento && !empresaAssinaturaExpirada(vencimento) ? vencimento : new Date();
  return calcularDataVencimentoAssinatura(dias, base);
}
