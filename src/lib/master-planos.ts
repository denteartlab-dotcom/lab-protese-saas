export const PLANOS_EMPRESA = ["basico", "profissional", "premium"] as const;
export type PlanoEmpresa = (typeof PLANOS_EMPRESA)[number];

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

export function rotuloPlanoEmpresa(plano: string): string {
  const mapa: Record<PlanoEmpresa, string> = {
    basico: "Básico",
    profissional: "Profissional",
    premium: "Premium",
  };
  return mapa[normalizarPlanoEmpresa(plano)];
}

export function limitesDoPlano(plano: string) {
  return LIMITES_PLANO_PADRAO[normalizarPlanoEmpresa(plano)];
}

export const PRECO_MENSAL_PLANO: Record<PlanoEmpresa, number> = {
  basico: 30,
  profissional: 40,
  premium: 50,
};

export const DIAS_RENOVACAO_MENSAL = 30;

export function precoMensalPlano(plano: string): number {
  return PRECO_MENSAL_PLANO[normalizarPlanoEmpresa(plano)];
}

export function formatarPrecoPlano(plano: string): string {
  const valor = precoMensalPlano(plano);
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type RecursoPlanoAssinatura = {
  id: PlanoEmpresa;
  nome: string;
  precoLabel: string;
  destaque?: boolean;
  destaqueRotulo?: string;
  itens: string[];
};

export const RECURSOS_PLANOS_ASSINATURA: RecursoPlanoAssinatura[] = [
  {
    id: "basico",
    nome: "Básico",
    precoLabel: `${formatarPrecoPlano("basico")} / mês`,
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
    precoLabel: `${formatarPrecoPlano("profissional")} / mês`,
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
    precoLabel: `${formatarPrecoPlano("premium")} / mês`,
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
