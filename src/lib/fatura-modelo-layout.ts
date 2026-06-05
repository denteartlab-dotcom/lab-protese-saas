import {
  normalizarCorBorda,
  OS_MODELO1_BORDA_MARGEM_MM,
  OS_REQUISICAO_BORDA_PADDING_MM,
  OS_REQUISICAO_LINHA_PREVIEW_PX,
  OS_REQUISICAO_MARGEM_CONTEUDO_MM,
  OS_REQUISICAO_PREVIEW_INSET_MM,
  OS_REQUISICAO_TOPO_MM,
} from "@/lib/os-modelo1-layout";

/** Folha A4 — modelos 1, 2 e 3. */
export const FATURA_A4_LARGURA_MM = 210;
export const FATURA_A4_ALTURA_MM = 297;

export type FaturaModeloLayout = {
  exibirBordas: boolean;
  bordas: string;
  mensagem: string;
  infoLab: boolean;
  logo: boolean;
  dadosOs: boolean;
  usuario: boolean;
  tamanhoFonte: number;
  numOs: boolean;
  osExterna: boolean;
  cliente: boolean;
  clienteEmail: boolean;
  dentista: boolean;
  clienteTel: boolean;
  paciente: boolean;
  clienteEnd: boolean;
  numDente: boolean;
  corDente: boolean;
  valorUnit: boolean;
  desconto: boolean;
  subtotal: boolean;
  saldoAnterior: boolean;
  ultimoPgto: boolean;
  finalizado: boolean;
  data: boolean;
  formaPgto: boolean;
  observacao: boolean;
  assinatura: boolean;
  pix: boolean;
  /** Imagem do QR Code PIX (data URL). */
  pixQrImagem: string;
  /** Largura/altura do QR Code em pixels. */
  pixQrTamanhoPx: number;
  /** Tamanho da fonte da legenda «Pagar com PIX». */
  pixQrFonte: number;
  qtd: boolean;
  servico: boolean;
  totalServicos: boolean;
  descontoServicos: boolean;
  descontoFatura: boolean;
  total: boolean;
  condicaoPagamento: boolean;
  /** Modelo térmico 60mm */
  logoTamanhoPx: number;
  logoMargemEsq: number;
  logoMargemTopo: number;
};

export const FATURA_MODELO_LAYOUT_PADRAO: FaturaModeloLayout = {
  exibirBordas: true,
  bordas: "#bdbdbd",
  mensagem: "",
  infoLab: true,
  logo: true,
  dadosOs: true,
  usuario: true,
  tamanhoFonte: 15,
  numOs: true,
  osExterna: true,
  cliente: true,
  clienteEmail: true,
  dentista: true,
  clienteTel: true,
  paciente: true,
  clienteEnd: true,
  numDente: true,
  corDente: true,
  valorUnit: true,
  desconto: true,
  subtotal: true,
  saldoAnterior: true,
  ultimoPgto: true,
  finalizado: true,
  data: true,
  formaPgto: true,
  observacao: true,
  assinatura: true,
  pix: true,
  pixQrImagem: "",
  pixQrTamanhoPx: 64,
  pixQrFonte: 10,
  qtd: true,
  servico: true,
  totalServicos: true,
  descontoServicos: true,
  descontoFatura: true,
  total: true,
  condicaoPagamento: true,
  logoTamanhoPx: 118,
  logoMargemEsq: 0,
  logoMargemTopo: 0,
};

/** Cabeçalho — Smart Prótese (Laboratório, Logo, Dados OS, Usuário). */
export const CAMPOS_FATURA_CABECALHO: Array<{ key: keyof FaturaModeloLayout; label: string }> = [
  { key: "infoLab", label: "Laboratório" },
  { key: "logo", label: "Logo" },
  { key: "dadosOs", label: "Dados OS" },
  { key: "usuario", label: "Usuário" },
];

type CampoCheckbox = { key: keyof FaturaModeloLayout; label: string };

/** Pares no menu lateral — ordem Smart Prótese Fatura Modelo 1. */
export const CAMPOS_FATURA_PARES: Array<[CampoCheckbox, CampoCheckbox | null]> = [
  [{ key: "numOs", label: "Num OS" }, { key: "osExterna", label: "OS Externa" }],
  [{ key: "cliente", label: "Cliente" }, { key: "clienteEmail", label: "Cliente Email" }],
  [{ key: "dentista", label: "Dentista" }, { key: "clienteTel", label: "Cliente Tel" }],
  [{ key: "paciente", label: "Paciente" }, { key: "clienteEnd", label: "Cliente End" }],
  [{ key: "numDente", label: "Num Dente" }, { key: "corDente", label: "Cor Dente" }],
  [{ key: "valorUnit", label: "Valor Unit" }, { key: "desconto", label: "Desconto" }],
  [{ key: "subtotal", label: "Subtotal" }, { key: "ultimoPgto", label: "Último Pgto" }],
  [{ key: "saldoAnterior", label: "Saldo Anterior" }, { key: "data", label: "Data" }],
  [{ key: "finalizado", label: "Finalizado" }, { key: "formaPgto", label: "Forma Pgto" }],
  [{ key: "observacao", label: "Observação" }, { key: "assinatura", label: "Assinatura" }],
  [{ key: "pix", label: "Pix" }, { key: "qtd", label: "Qtd" }],
  [{ key: "servico", label: "Serviços/Produtos" }, { key: "totalServicos", label: "Total Serviços" }],
  [
    { key: "descontoServicos", label: "Desconto Serviços" },
    { key: "descontoFatura", label: "Desconto Fatura" },
  ],
  [{ key: "total", label: "Total" }, { key: "condicaoPagamento", label: "Condição Pagamento" }],
];

const LEGADO_FATURA_MAP: Record<string, keyof FaturaModeloLayout> = {
  numFatura: "dadosOs",
  dataFatura: "data",
  telefones: "clienteTel",
  email: "clienteEmail",
  endereco: "clienteEnd",
  os: "numOs",
  dentes: "numDente",
  unitario: "valorUnit",
  jurosFatura: "total",
};

export function normalizarFaturaModeloLayout(
  valor?: Partial<FaturaModeloLayout> & Record<string, unknown> | null
): FaturaModeloLayout {
  if (!valor || typeof valor !== "object") {
    return { ...FATURA_MODELO_LAYOUT_PADRAO };
  }

  const mesclado: Record<string, unknown> = { ...FATURA_MODELO_LAYOUT_PADRAO };
  for (const [k, v] of Object.entries(valor)) {
    if (v === undefined) continue;
    const destino = LEGADO_FATURA_MAP[k] ?? k;
    if (destino in FATURA_MODELO_LAYOUT_PADRAO) {
      mesclado[destino] = v;
    }
  }

  const base = { ...FATURA_MODELO_LAYOUT_PADRAO };
  for (const key of Object.keys(base) as Array<keyof FaturaModeloLayout>) {
    const raw = mesclado[key];
    if (raw === undefined) continue;
    if (typeof base[key] === "boolean") {
      (base as Record<string, unknown>)[key] = Boolean(raw);
    } else if (typeof base[key] === "number") {
      const n = Number(raw);
      (base as Record<string, unknown>)[key] = Number.isFinite(n) ? n : base[key];
    } else if (key === "bordas") {
      base.bordas = normalizarCorBorda(String(raw));
    } else if (key === "mensagem") {
      base.mensagem = String(raw ?? "");
    } else if (key === "pixQrImagem") {
      const url = String(raw ?? "");
      base.pixQrImagem = url.startsWith("data:image") ? url : "";
    }
  }

  base.pixQrTamanhoPx = clampNumero(base.pixQrTamanhoPx, 32, 240, FATURA_MODELO_LAYOUT_PADRAO.pixQrTamanhoPx);
  base.pixQrFonte = clampNumero(base.pixQrFonte, 7, 20, FATURA_MODELO_LAYOUT_PADRAO.pixQrFonte);

  return base;
}

function clampNumero(valor: number, min: number, max: number, padrao: number) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}

/** Estilos de borda/página — mesma lógica do OS Modelo 1. */
export function estiloPaginaFaturaPreview() {
  return {
    width: `${FATURA_A4_LARGURA_MM}mm`,
    minHeight: `${FATURA_A4_ALTURA_MM}mm`,
    maxWidth: "100%",
    paddingTop: `${OS_REQUISICAO_TOPO_MM}mm`,
    paddingLeft: `${OS_REQUISICAO_MARGEM_CONTEUDO_MM}mm`,
    paddingRight: `${OS_REQUISICAO_MARGEM_CONTEUDO_MM}mm`,
    paddingBottom: `${OS_REQUISICAO_MARGEM_CONTEUDO_MM}mm`,
    boxSizing: "border-box" as const,
    overflow: "visible" as const,
    fontFamily: "Arial, Helvetica, sans-serif",
    background: "#fff",
    color: "#111",
  };
}

export function estiloWrapperFaturaPreview() {
  return {
    position: "relative" as const,
    width: "100%",
    boxSizing: "border-box" as const,
  };
}

export function estiloMolduraFaturaPreview(lay: Pick<FaturaModeloLayout, "exibirBordas" | "bordas">) {
  if (!lay.exibirBordas) return { display: "none" as const };
  const inset = OS_REQUISICAO_PREVIEW_INSET_MM;
  return {
    position: "absolute" as const,
    top: `-${OS_REQUISICAO_BORDA_PADDING_MM}mm`,
    left: `-${inset}mm`,
    right: `-${inset}mm`,
    bottom: `-${OS_REQUISICAO_BORDA_PADDING_MM}mm`,
    border: `${OS_REQUISICAO_LINHA_PREVIEW_PX}px solid ${normalizarCorBorda(lay.bordas)}`,
    pointerEvents: "none" as const,
    boxSizing: "border-box" as const,
  };
}

export function estiloLimiteLinhasFaturaPreview() {
  const inset = OS_REQUISICAO_PREVIEW_INSET_MM;
  return {
    marginLeft: `-${inset}mm`,
    marginRight: `-${inset}mm`,
    width: `calc(100% + ${inset * 2}mm)`,
  };
}

export function estiloLinhaFaturaPreview() {
  return {
    borderColor: "#000000",
    borderTopWidth: OS_REQUISICAO_LINHA_PREVIEW_PX,
    borderTopStyle: "solid" as const,
  };
}

export function estiloLinhaDivisoriaFaturaPreview() {
  return {
    ...estiloLimiteLinhasFaturaPreview(),
    ...estiloLinhaFaturaPreview(),
  };
}

/** Linha cinza entre blocos (totais, pagamento, rodapé) — Smart Prótese. */
export function estiloLinhaDivisoriaCinzaFaturaPreview() {
  return {
    ...estiloLimiteLinhasFaturaPreview(),
    borderTopWidth: OS_REQUISICAO_LINHA_PREVIEW_PX,
    borderTopStyle: "solid" as const,
    borderColor: "#bdbdbd",
  };
}

export function estiloLinhaInferiorFaturaPreview() {
  return {
    borderColor: "#000000",
    borderBottomWidth: OS_REQUISICAO_LINHA_PREVIEW_PX,
    borderBottomStyle: "solid" as const,
  };
}

export function estiloTabelaMargemFaturaPreview() {
  return {
    paddingLeft: "2.5mm",
    paddingRight: "2.5mm",
    boxSizing: "border-box" as const,
  };
}

export const PREVIEW_FATURA_AMOSTRA = {
  numFatura: 194,
  data: "05/05/2022",
  usuario: "Mateus Bonfim",
  cliente: "Clínica Exemplo",
  dentista: "Dr. João Silva",
  paciente: "Fernando Costa",
  telefones: "(33) 3333-4444",
  email: "contato@clinica.com.br",
  endereco: "Rua Exemplo, 100 — Governador Valadares/MG",
  ultimoPgto: "R$ 1.700,55 em 12/10/2021",
  saldoAnterior: "R$ 850,00",
  linhas: [
    {
      os: "125",
      osExterna: "—",
      dataOs: "01/05/2022",
      finalizado: "05/05/2022",
      cor: "A2",
      servico: "Elemento Metalo Cerâmica",
      dentes: "22 25 27 32 35",
      paciente: "Fernando Costa",
      qtd: "1",
      unitario: "R$ 255,00",
      desconto: "% 10,00",
      subtotal: "R$ 229,50",
    },
  ],
  totalServicos: "R$ 255,00",
  descontoServicos: "R$ 25,50",
  descontoFatura: "R$ 0,00",
  total: "R$ 229,50",
  parcelas: [
    { parcela: "1 / 3", vencimento: "10/05/2022", forma: "Boleto", valor: "R$ 76,50" },
    { parcela: "2 / 3", vencimento: "10/06/2022", forma: "Boleto", valor: "R$ 76,50" },
    { parcela: "3 / 3", vencimento: "10/07/2022", forma: "Boleto", valor: "R$ 76,50" },
  ],
  observacao: "Observação de exemplo para a fatura.",
};
