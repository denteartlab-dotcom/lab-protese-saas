import { normalizarCorBorda } from "@/lib/os-modelo1-layout";

export type FaturaModeloLayout = {
  margemSuperior: number;
  margemInferior: number;
  margemEsquerda: number;
  margemDireita: number;
  tamanhoFonte: number;
  bordas: string;
  exibirBordas: boolean;
  infoLab: boolean;
  logo: boolean;
  numFatura: boolean;
  dataFatura: boolean;
  cliente: boolean;
  telefones: boolean;
  saldoAnterior: boolean;
  email: boolean;
  endereco: boolean;
  os: boolean;
  servico: boolean;
  dentes: boolean;
  paciente: boolean;
  qtd: boolean;
  unitario: boolean;
  desconto: boolean;
  subtotal: boolean;
  totalServicos: boolean;
  descontoServicos: boolean;
  descontoFatura: boolean;
  jurosFatura: boolean;
  total: boolean;
  condicaoPagamento: boolean;
  observacao: boolean;
  /** Modelo térmico 60mm */
  logoTamanhoPx: number;
  logoMargemEsq: number;
  logoMargemTopo: number;
};

export const FATURA_MODELO_LAYOUT_PADRAO: FaturaModeloLayout = {
  margemSuperior: 12,
  margemInferior: 12,
  margemEsquerda: 14,
  margemDireita: 14,
  tamanhoFonte: 9,
  bordas: "#111111",
  exibirBordas: true,
  infoLab: true,
  logo: true,
  numFatura: true,
  dataFatura: true,
  cliente: true,
  telefones: true,
  saldoAnterior: true,
  email: true,
  endereco: true,
  os: true,
  servico: true,
  dentes: true,
  paciente: true,
  qtd: true,
  unitario: true,
  desconto: true,
  subtotal: true,
  totalServicos: true,
  descontoServicos: true,
  descontoFatura: true,
  jurosFatura: true,
  total: true,
  condicaoPagamento: true,
  observacao: true,
  logoTamanhoPx: 90,
  logoMargemEsq: 0,
  logoMargemTopo: 0,
};

export const CAMPOS_FATURA_GERAL: Array<{ key: keyof FaturaModeloLayout; label: string }> = [
  { key: "infoLab", label: "Info Lab" },
  { key: "logo", label: "Logo" },
  { key: "numFatura", label: "Nº Fatura" },
  { key: "dataFatura", label: "Data Fatura" },
];

type CampoCheckbox = { key: keyof FaturaModeloLayout; label: string };

export const CAMPOS_FATURA_PARES: Array<[CampoCheckbox, CampoCheckbox | null]> = [
  [{ key: "cliente", label: "Cliente" }, { key: "telefones", label: "Telefones" }],
  [{ key: "saldoAnterior", label: "Saldo Anterior" }, { key: "email", label: "E-mail" }],
  [{ key: "endereco", label: "Endereço" }, { key: "os", label: "OS" }],
  [{ key: "servico", label: "Serviço/Produtos" }, { key: "dentes", label: "Número Dente" }],
  [{ key: "paciente", label: "Paciente" }, { key: "qtd", label: "Qtd" }],
  [{ key: "unitario", label: "Unitário" }, { key: "desconto", label: "Desc" }],
  [{ key: "subtotal", label: "Subtotal" }, { key: "totalServicos", label: "Total Serviços" }],
  [{ key: "descontoServicos", label: "Desconto Serviços" }, { key: "descontoFatura", label: "Desconto Fatura" }],
  [{ key: "jurosFatura", label: "Juros Fatura" }, { key: "total", label: "Total" }],
  [{ key: "condicaoPagamento", label: "Condição Pagamento" }, { key: "observacao", label: "Observação" }],
];

export function normalizarFaturaModeloLayout(
  valor?: Partial<FaturaModeloLayout> | null
): FaturaModeloLayout {
  if (!valor || typeof valor !== "object") {
    return { ...FATURA_MODELO_LAYOUT_PADRAO };
  }
  const base = { ...FATURA_MODELO_LAYOUT_PADRAO };
  for (const key of Object.keys(base) as Array<keyof FaturaModeloLayout>) {
    const raw = valor[key];
    if (raw === undefined) continue;
    if (typeof base[key] === "boolean") {
      (base as Record<string, unknown>)[key] = Boolean(raw);
    } else if (typeof base[key] === "number") {
      const n = Number(raw);
      (base as Record<string, unknown>)[key] = Number.isFinite(n) ? n : base[key];
    } else if (key === "bordas") {
      base.bordas = normalizarCorBorda(String(raw));
    }
  }
  return base;
}

export const PREVIEW_FATURA_AMOSTRA = {
  numFatura: 1284,
  data: "02/06/2026 14:30",
  cliente: "Clínica Odonto Exemplo",
  telefones: "(31) 3333-4444",
  email: "contato@exemplo.com.br",
  endereco: "Rua das Flores, 100 — Belo Horizonte/MG",
  linhas: [
    {
      os: "4521",
      dataOs: "28/05/2026",
      servico: "Coroa em Zircônia",
      dentes: "16",
      paciente: "Maria Silva",
      qtd: "1",
      unitario: "R$ 450,00",
      desconto: "0,00 %",
      subtotal: "R$ 450,00",
    },
    {
      os: "4528",
      dataOs: "30/05/2026",
      servico: "Prótese Total Superior",
      dentes: "—",
      paciente: "João Souza",
      qtd: "1",
      unitario: "R$ 820,00",
      desconto: "0,00 %",
      subtotal: "R$ 820,00",
    },
  ],
  totalServicos: "R$ 1.270,00",
  descontoServicos: "R$ 0,00",
  descontoFatura: "R$ 0,00",
  jurosFatura: "R$ 0,00",
  total: "R$ 1.270,00",
  parcela: "1 / 1",
  vencimento: "10/06/2026",
  formaPagamento: "Boleto Bancário",
  valorParcela: "R$ 1.270,00",
  pago: "R$ 0,00",
};
