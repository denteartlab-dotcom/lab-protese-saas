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
  /** Modelo térmico 80mm */
  logoTamanhoPx: number;
  logoMargemEsq: number;
  logoMargemTopo: number;
};

/** Largura da folha — impressora térmica 80mm Epson T20. */
export const FATURA_TERMICA_LARGURA_MM = 80;

export const FATURA_MODELO_LAYOUT_PADRAO: FaturaModeloLayout = {
  exibirBordas: false,
  bordas: "#111111",
  mensagem: "",
  infoLab: true,
  logo: false,
  dadosOs: true,
  usuario: true,
  tamanhoFonte: 9,
  numOs: true,
  osExterna: true,
  cliente: true,
  clienteEmail: true,
  dentista: false,
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
  logoTamanhoPx: 91,
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

/** Cabeçalho — Smart Prótese Fatura Modelo 4 térmica 80mm. */
export const CAMPOS_FATURA_TERMICA_CABECALHO: Array<{
  key: keyof FaturaModeloLayout;
  label: string;
}> = [
  { key: "infoLab", label: "Laboratório" },
  { key: "logo", label: "Logo" },
  { key: "data", label: "Data OS" },
  { key: "usuario", label: "Usuário" },
];

/** Pares no menu lateral — ordem Smart Prótese Fatura Modelo 4 térmica. */
export const CAMPOS_FATURA_TERMICA_PARES: Array<[CampoCheckbox, CampoCheckbox | null]> = [
  [{ key: "cliente", label: "Cliente" }, { key: "clienteEmail", label: "Cliente Email" }],
  [{ key: "clienteTel", label: "Cliente Tel" }, { key: "clienteEnd", label: "Cliente End" }],
  [{ key: "saldoAnterior", label: "Saldo Anterior" }, { key: "dentista", label: "Dentista" }],
  [{ key: "osExterna", label: "OS Externa" }, { key: "numDente", label: "Nome Dente" }],
  [{ key: "valorUnit", label: "Valor Unit" }, null],
  [{ key: "data", label: "Data" }, { key: "formaPgto", label: "Forma Pgto" }],
  [{ key: "assinatura", label: "Assinatura" }, { key: "corDente", label: "Cor Dente" }],
  [{ key: "desconto", label: "Desconto" }, { key: "ultimoPgto", label: "Última Pgto" }],
  [{ key: "finalizado", label: "Entregue" }, { key: "observacao", label: "Observações" }],
  [{ key: "pix", label: "Pix" }, null],
];

/** Padrão Smart — Modelo Fatura 4 térmica 80mm Epson T20. */
export const FATURA_MODELO4_LAYOUT_PADRAO: Partial<FaturaModeloLayout> = {
  exibirBordas: false,
  tamanhoFonte: 12,
  logoTamanhoPx: 120,
  logoMargemEsq: 0,
  logoMargemTopo: 0,
  infoLab: true,
  logo: true,
  data: true,
  usuario: true,
  dadosOs: true,
  cliente: true,
  clienteEmail: true,
  clienteTel: true,
  clienteEnd: true,
  saldoAnterior: true,
  dentista: true,
  osExterna: true,
  numDente: true,
  valorUnit: true,
  subtotal: false,
  formaPgto: true,
  assinatura: true,
  corDente: true,
  desconto: true,
  ultimoPgto: true,
  finalizado: true,
  observacao: true,
  pix: true,
  qtd: true,
  servico: true,
  numOs: true,
  paciente: true,
  totalServicos: true,
  descontoServicos: true,
  descontoFatura: true,
  total: true,
  condicaoPagamento: true,
  pixQrTamanhoPx: 120,
  pixQrFonte: 10,
};

/** Padrão Smart — Modelo Fatura 5 térmica 80mm (igual ao 4, Saldo Anterior nos totais). */
export const FATURA_MODELO5_LAYOUT_PADRAO: Partial<FaturaModeloLayout> = {
  ...FATURA_MODELO4_LAYOUT_PADRAO,
};

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

/** Padrões Smart Prótese — Fatura Modelo 1 A4 (campos marcados na referência). */
export const FATURA_MODELO1_SMART_PADRAO: Partial<FaturaModeloLayout> = {
  exibirBordas: true,
  bordas: "#d5d4d4",
  infoLab: true,
  logo: true,
  dadosOs: true,
  usuario: true,
  tamanhoFonte: 15,
  numOs: true,
  osExterna: true,
  qtd: true,
  servico: true,
  numDente: true,
  paciente: true,
  valorUnit: true,
  desconto: true,
  subtotal: true,
  cliente: true,
  clienteEmail: true,
  clienteTel: true,
  clienteEnd: true,
  ultimoPgto: true,
  saldoAnterior: true,
  data: true,
  finalizado: true,
  corDente: true,
  formaPgto: true,
  observacao: true,
  assinatura: true,
  pix: true,
  pixQrTamanhoPx: 64,
  pixQrFonte: 10,
  totalServicos: true,
  descontoServicos: true,
  descontoFatura: true,
  total: true,
  condicaoPagamento: true,
  dentista: false,
};

/** Mescla layout salvo com padrões Smart — Faturas A4 modelos 1, 2 e 3. */
export function layoutFaturaModelo1Smart(layout: FaturaModeloLayout): FaturaModeloLayout {
  return normalizarFaturaModeloLayout({
    ...FATURA_MODELO1_SMART_PADRAO,
    ...layout,
  });
}

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

export function normalizarFaturaModelo4Layout(
  valor?: Partial<FaturaModeloLayout> & Record<string, unknown> | null
): FaturaModeloLayout {
  return normalizarFaturaModeloLayout({
    ...FATURA_MODELO_LAYOUT_PADRAO,
    ...FATURA_MODELO4_LAYOUT_PADRAO,
    ...(valor ?? {}),
  });
}

export function normalizarFaturaModelo5Layout(
  valor?: Partial<FaturaModeloLayout> & Record<string, unknown> | null
): FaturaModeloLayout {
  return normalizarFaturaModeloLayout({
    ...FATURA_MODELO_LAYOUT_PADRAO,
    ...FATURA_MODELO5_LAYOUT_PADRAO,
    ...(valor ?? {}),
  });
}

function clampNumero(valor: number, min: number, max: number, padrao: number) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}

/** Margem lateral do conteúdo — Fatura Modelo 1 Smart (alinhada à moldura 10 mm). */
export const FATURA_SMART_MARGEM_LATERAL_MM = OS_MODELO1_BORDA_MARGEM_MM;

/** Espaço entre observação e bloco assinatura/PIX (Modelo 1 Smart). */
export const FATURA_SMART_ESPACO_OBS_RODAPE_MM = 22;

/** Espaço entre assinatura e QR PIX. */
export const FATURA_SMART_ESPACO_ASSINATURA_PIX_MM = 14;

/** Espaço antes do rodapé quando não há observação. */
export const FATURA_SMART_ESPACO_RODAPE_MM = 14;

/** Recuo das linhas até a moldura (0 quando margem = borda). */
export const FATURA_SMART_INSET_LINHA_MM = Math.max(
  0,
  FATURA_SMART_MARGEM_LATERAL_MM - OS_MODELO1_BORDA_MARGEM_MM
);

/** Estilos de borda/página — mesma lógica do OS Modelo 1. */
export function estiloPaginaFaturaPreview() {
  return {
    width: `${FATURA_A4_LARGURA_MM}mm`,
    minHeight: `${FATURA_A4_ALTURA_MM}mm`,
    maxWidth: "100%",
    paddingTop: `${OS_REQUISICAO_TOPO_MM}mm`,
    paddingLeft: `${FATURA_SMART_MARGEM_LATERAL_MM}mm`,
    paddingRight: `${FATURA_SMART_MARGEM_LATERAL_MM}mm`,
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
  const inset = FATURA_SMART_INSET_LINHA_MM;
  return {
    position: "absolute" as const,
    top: `-${OS_REQUISICAO_BORDA_PADDING_MM}mm`,
    left: inset > 0 ? `-${inset}mm` : "0",
    right: inset > 0 ? `-${inset}mm` : "0",
    width: inset > 0 ? `calc(100% + ${inset * 2}mm)` : "100%",
    bottom: `-${OS_REQUISICAO_BORDA_PADDING_MM}mm`,
    border: `${OS_REQUISICAO_LINHA_PREVIEW_PX}px solid ${normalizarCorBorda(lay.bordas)}`,
    pointerEvents: "none" as const,
    boxSizing: "border-box" as const,
  };
}

export function estiloLimiteLinhasFaturaPreview() {
  const inset = FATURA_SMART_INSET_LINHA_MM;
  if (inset <= 0) {
    return { width: "100%" };
  }
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

/** Linha divisória até a moldura lateral (10 mm da folha), igual OS Modelo 1. */
export function estiloLinhaDivisoriaFaturaPreview() {
  return {
    ...estiloLimiteLinhasFaturaPreview(),
    boxSizing: "border-box" as const,
    ...estiloLinhaFaturaPreview(),
  };
}

/** Linha cinza entre blocos — mesma largura das divisórias pretas. */
export function estiloLinhaDivisoriaCinzaFaturaPreview() {
  return {
    ...estiloLimiteLinhasFaturaPreview(),
    boxSizing: "border-box" as const,
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
  data: "30/05/2022",
  usuario: "Fernando",
  cliente: "Dr. Manoel Costa",
  dentista: "Dr. Manoel Costa",
  paciente: "Fernando Costa",
  telefones: "(48) 3033-0100 / (48) 91111-0111",
  email: "emailcliente@teste.com",
  endereco: "Av. José Melo de Testes, 0000 Centro",
  ultimoPgto: "R$ 1.730,55 em 12/10/2021",
  saldoAnterior: "R$ 850,00",
  linhas: [
    {
      os: "125",
      osExterna: "1.274",
      dataOs: "05/05/2022",
      finalizado: "05/05/2022",
      cor: "A2",
      servico: "Elemento Metálo Cerâmica",
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
    { parcela: "1", vencimento: "10/06/2022", forma: "Boleto", valor: "R$ 76,50" },
    { parcela: "2", vencimento: "10/07/2022", forma: "Boleto", valor: "R$ 76,50" },
    { parcela: "3", vencimento: "10/08/2022", forma: "Boleto", valor: "R$ 76,50" },
  ],
  observacao: "Aqui vai as informações do faturamento",
};

/** Amostra Smart — Fatura Modelo 4 térmica 80mm. */
export const PREVIEW_FATURA_TERMICA_AMOSTRA = {
  numFatura: 194,
  data: "05/06/2022",
  usuario: "Fernanda",
  cliente: "Lab Ana Carla Atiah",
  dentista: "Carlos Almeida",
  telefones: "(33) 1111-0000 / (33) 98888-0000",
  email: "lab@anaatiah.com",
  endereco: "AV. Juscelino de Freitas, 0000 Centro",
  ultimoPgto: "R$ 1.230,00 em 12/10/2021",
  saldoAnterior: "R$ 450,00",
  linhas: [
    {
      os: "10",
      osExterna: "11111",
      dataOs: "05/06/2022",
      finalizado: "05/06/2022",
      cor: "A3 - Vita",
      servico: "Elemento Metalo Cerâmica",
      dentes: "23, 24, 25, 27, 32, 34",
      paciente: "Ana Clara Batistela",
      qtd: "1",
      unitario: "R$ 250,00",
      desconto: "% 10,00",
      subtotal: "R$ 225,00",
    },
  ],
  subtotal: "R$ 225,00",
  totalServicos: "R$ 250,00",
  descontoServicos: "R$ 25,00",
  descontoFatura: "R$ 0,00",
  total: "R$ 225,00",
  parcelas: [
    { parcela: "1 / 3", vencimento: "10/06/2022", forma: "Boleto", valor: "R$ 75,00" },
    { parcela: "2 / 3", vencimento: "10/07/2022", forma: "Boleto", valor: "R$ 75,00" },
    { parcela: "3 / 3", vencimento: "10/08/2022", forma: "Boleto", valor: "R$ 75,00" },
  ],
  observacao: "Aqui vai as informações de faturamento",
};
