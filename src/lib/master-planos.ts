export const PLANOS_EMPRESA = ["basico", "profissional", "premium"] as const;
export type PlanoEmpresa = (typeof PLANOS_EMPRESA)[number];

export const PERIODOS_COBRANCA = ["mensal", "anual"] as const;
export type PeriodoCobranca = (typeof PERIODOS_COBRANCA)[number];

export const LIMITES_PLANO_PADRAO: Record<
  PlanoEmpresa,
  { usuarios: number; trabalhos: number }
> = {
  basico: { usuarios: 2, trabalhos: 100 },
  profissional: { usuarios: 5, trabalhos: 500 },
  premium: { usuarios: 9999, trabalhos: 99999 },
};

export function normalizarPlanoEmpresa(plano: string): PlanoEmpresa {
  const valor = plano.trim().toLowerCase();
  if (valor === "profissional" || valor === "premium") return valor;
  return "basico";
}

export function normalizarPeriodoCobranca(periodo: string): PeriodoCobranca {
  return periodo?.trim().toLowerCase() === "anual" ? "anual" : "mensal";
}

export function rotuloPlanoEmpresa(plano: string): string {
  const mapa: Record<PlanoEmpresa, string> = {
    basico: "Básico",
    profissional: "Profissional",
    premium: "Premium",
  };
  return mapa[normalizarPlanoEmpresa(plano)];
}

export function rotuloPeriodoCobranca(periodo: string): string {
  return normalizarPeriodoCobranca(periodo) === "anual" ? "Anual" : "Mensal";
}

export function limitesDoPlano(plano: string) {
  return LIMITES_PLANO_PADRAO[normalizarPlanoEmpresa(plano)];
}

export const PRECO_MENSAL_PLANO: Record<PlanoEmpresa, number> = {
  basico: 0.5,
  profissional: 40,
  premium: 50,
};

/** Desconto no plano anual (12 meses). */
export const DESCONTO_ANUAL_PLANO: Record<PlanoEmpresa, number> = {
  basico: 0.1,
  profissional: 0.13,
  premium: 0.15,
};

export const DIAS_RENOVACAO_MENSAL = 30;
export const DIAS_RENOVACAO_ANUAL = 365;

export function precoMensalPlano(plano: string): number {
  return PRECO_MENSAL_PLANO[normalizarPlanoEmpresa(plano)];
}

export function percentualDescontoAnual(plano: string): number {
  return Math.round(DESCONTO_ANUAL_PLANO[normalizarPlanoEmpresa(plano)] * 100);
}

export function precoCheioAnualPlano(plano: string): number {
  return arredondarPrecoPlano(precoMensalPlano(plano) * 12);
}

export function arredondarPrecoPlano(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function precoPlano(plano: string, periodo: string = "mensal"): number {
  const mensal = precoMensalPlano(plano);
  if (normalizarPeriodoCobranca(periodo) === "mensal") {
    return mensal;
  }
  const desconto = DESCONTO_ANUAL_PLANO[normalizarPlanoEmpresa(plano)];
  return arredondarPrecoPlano(mensal * 12 * (1 - desconto));
}

export function diasRenovacaoPlano(periodo: string): number {
  return normalizarPeriodoCobranca(periodo) === "anual"
    ? DIAS_RENOVACAO_ANUAL
    : DIAS_RENOVACAO_MENSAL;
}

export function formatarMoedaPlano(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarPrecoPlano(plano: string, periodo: string = "mensal"): string {
  return formatarMoedaPlano(precoPlano(plano, periodo));
}

export function sufixoPeriodoCobranca(periodo: string): string {
  return normalizarPeriodoCobranca(periodo) === "anual" ? "/ ano" : "/ mês";
}

export function formatarPrecoPlanoComPeriodo(
  plano: string,
  periodo: string = "mensal"
): string {
  return `${formatarPrecoPlano(plano, periodo)} ${sufixoPeriodoCobranca(periodo)}`;
}

export type RecursoPlanoAssinatura = {
  id: PlanoEmpresa;
  nome: string;
  precoLabel: string;
  precoCheioAnualLabel?: string;
  descontoAnualLabel?: string;
  destaque?: boolean;
  destaqueRotulo?: string;
  itens: string[];
};

export function recursosPlanosAssinatura(
  periodo: PeriodoCobranca = "mensal"
): RecursoPlanoAssinatura[] {
  const ehAnual = periodo === "anual";

  return [
    {
      id: "basico",
      nome: "Básico",
      precoLabel: formatarPrecoPlanoComPeriodo("basico", periodo),
      ...(ehAnual
        ? {
            precoCheioAnualLabel: formatarMoedaPlano(precoCheioAnualPlano("basico")),
            descontoAnualLabel: `${percentualDescontoAnual("basico")}% off`,
          }
        : {}),
      itens: [
        "Até 2 usuários",
        "Até 100 trabalhos por mês",
        "Relatórios básicos",
        "Suporte por e-mail",
      ],
    },
    {
      id: "profissional",
      nome: "Profissional",
      precoLabel: formatarPrecoPlanoComPeriodo("profissional", periodo),
      ...(ehAnual
        ? {
            precoCheioAnualLabel: formatarMoedaPlano(precoCheioAnualPlano("profissional")),
            descontoAnualLabel: `${percentualDescontoAnual("profissional")}% off`,
          }
        : {}),
      destaque: true,
      destaqueRotulo: "MAIS CONTRATADO",
      itens: [
        "Até 5 usuários",
        "Até 500 trabalhos por mês",
        "Relatórios avançados",
        "Backup automático",
        "Suporte prioritário",
      ],
    },
    {
      id: "premium",
      nome: "Premium",
      precoLabel: formatarPrecoPlanoComPeriodo("premium", periodo),
      ...(ehAnual
        ? {
            precoCheioAnualLabel: formatarMoedaPlano(precoCheioAnualPlano("premium")),
            descontoAnualLabel: `${percentualDescontoAnual("premium")}% off`,
          }
        : {}),
      itens: [
        "Usuários ilimitados",
        "Trabalhos ilimitados",
        "Relatórios avançados",
        "Backup automático",
        "Integrações exclusivas",
        "Suporte 24h",
      ],
    },
  ];
}

/** @deprecated Use recursosPlanosAssinatura("mensal") */
export const RECURSOS_PLANOS_ASSINATURA = recursosPlanosAssinatura("mensal");
