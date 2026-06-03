export type OsModelo1Layout = {
  /** Exibir borda ao redor da página A4. */
  exibirBordas: boolean;
  /** Cor da borda da página A4 (hex). */
  bordas: string;
  /** Texto opcional exibido no rodapé da requisição. */
  mensagem: string;
  infoLab: boolean;
  logo: boolean;
  dataOs: boolean;
  usuario: boolean;
  tamanhoFonte: number;
  numOs: boolean;
  osExterna: boolean;
  cliente: boolean;
  clienteEmail: boolean;
  dentista: boolean;
  clienteTel: boolean;
  paciente: boolean;
  caixa: boolean;
  clienteEnd: boolean;
  numDente: boolean;
  corDente: boolean;
  valorUnit: boolean;
  desconto: boolean;
  subtotal: boolean;
  total: boolean;
  dataPrazo: boolean;
  finalizado: boolean;
  colaborador: boolean;
  produtos: boolean;
  producao: boolean;
  obsFicha: boolean;
  obsServico: boolean;
  materialRec: boolean;
  etapas: boolean;
  pecas: boolean;
  assinatura: boolean;
  codBarras: boolean;
  /** Espaçamento vertical da requisição (70–130, padrão 88 ≈ Smart). */
  espacamentoRequisicao: number;
};

export const OS_MODELO1_LAYOUT_PADRAO: OsModelo1Layout = {
  exibirBordas: true,
  bordas: "#bdbdbd",
  mensagem: "",
  infoLab: true,
  logo: true,
  dataOs: true,
  usuario: true,
  tamanhoFonte: 13,
  numOs: true,
  osExterna: true,
  cliente: true,
  clienteEmail: true,
  dentista: true,
  clienteTel: true,
  paciente: true,
  caixa: true,
  clienteEnd: true,
  numDente: true,
  corDente: true,
  valorUnit: true,
  desconto: true,
  subtotal: true,
  total: true,
  dataPrazo: true,
  finalizado: true,
  colaborador: true,
  produtos: true,
  producao: false,
  obsFicha: true,
  obsServico: true,
  materialRec: true,
  etapas: true,
  pecas: false,
  assinatura: true,
  codBarras: true,
  espacamentoRequisicao: 88,
};

export const CAMPOS_MODELO1_GERAL: Array<{
  key: keyof OsModelo1Layout;
  label: string;
}> = [
  { key: "infoLab", label: "Info Lab" },
  { key: "logo", label: "Logo" },
  { key: "dataOs", label: "Data OS" },
  { key: "usuario", label: "Usuário" },
];

type CampoCheckbox = { key: keyof OsModelo1Layout; label: string };

/** Pares de checkboxes no menu lateral (estilo Smart Prótese). */
export const CAMPOS_MODELO1_PARES: Array<[CampoCheckbox, CampoCheckbox | null]> = [
  [{ key: "numOs", label: "Num OS" }, { key: "osExterna", label: "OS Externa" }],
  [{ key: "cliente", label: "Cliente" }, { key: "clienteEmail", label: "Cliente Email" }],
  [{ key: "dentista", label: "Dentista" }, { key: "clienteTel", label: "Cliente Tel" }],
  [{ key: "paciente", label: "Paciente" }, { key: "caixa", label: "Caixa" }],
  [{ key: "clienteEnd", label: "Cliente End" }, null],
  [{ key: "numDente", label: "Num Dente" }, { key: "corDente", label: "Cor Dente" }],
  [{ key: "valorUnit", label: "Valor Unit" }, { key: "desconto", label: "Desconto" }],
  [{ key: "subtotal", label: "Subtotal" }, { key: "total", label: "Total" }],
  [{ key: "dataPrazo", label: "Data Prazo" }, { key: "finalizado", label: "Finalizado" }],
  [{ key: "colaborador", label: "Colaborador" }, { key: "produtos", label: "Produtos" }],
  [{ key: "obsFicha", label: "Obs Ficha" }, { key: "obsServico", label: "Obs Serviço" }],
  [{ key: "materialRec", label: "Material Rec" }, { key: "etapas", label: "Etapas" }],
  [{ key: "assinatura", label: "Assinatura" }, { key: "codBarras", label: "Cod Barras" }],
];

export function normalizarCorBorda(valor?: string): string {
  const v = String(valor ?? "").trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) return v;
  return OS_MODELO1_LAYOUT_PADRAO.bordas;
}

/** Margem externa da folha A4 até a borda da requisição (mm). */
export const OS_MODELO1_BORDA_MARGEM_MM = 10;

/** Margem horizontal do texto — não muda ao ligar/desligar borda. */
export const OS_REQUISICAO_MARGEM_CONTEUDO_MM = 15;

export const OS_REQUISICAO_ESPACAMENTO_MIN = 70;
export const OS_REQUISICAO_ESPACAMENTO_MAX = 130;
export const OS_REQUISICAO_ESPACAMENTO_PADRAO = 88;

/** Espessura das linhas divisórias internas no PDF (mm). */
export const OS_REQUISICAO_LINHA_INTERNA_MM = 0.12;

/** Espessura da borda externa da requisição no PDF (mm). */
export const OS_REQUISICAO_BORDA_EXTERNA_MM = 0.15;

/** Espessura das linhas no preview HTML (px). */
export const OS_REQUISICAO_LINHA_PREVIEW_PX = 1;

/** Cor fixa das linhas divisórias internas (independente do seletor de cor da borda). */
export const OS_REQUISICAO_LINHA_DIVISAO_COR = "#000000";

/** Estilo de linha horizontal divisória no preview do editor. */
export function estiloLinhaRequisicaoPreview() {
  return {
    borderColor: OS_REQUISICAO_LINHA_DIVISAO_COR,
    borderTopWidth: OS_REQUISICAO_LINHA_PREVIEW_PX,
    borderTopStyle: "solid" as const,
  };
}

/** Linha divisória abaixo de uma seção (cabeçalho da tabela, linhas de item). */
export function estiloLinhaInferiorRequisicaoPreview() {
  return {
    borderColor: OS_REQUISICAO_LINHA_DIVISAO_COR,
    borderBottomWidth: OS_REQUISICAO_LINHA_PREVIEW_PX,
    borderBottomStyle: "solid" as const,
  };
}

/** Borda no preview sem deslocar o texto (outline, sem padding extra). */
export function estiloBordaRequisicaoPreview(cor: string) {
  return {
    outline: `${OS_REQUISICAO_LINHA_PREVIEW_PX}px solid ${cor}`,
    outlineOffset: 0,
  };
}

/** Recuo entre margem do texto (15 mm) e a borda externa (10 mm). */
export const OS_REQUISICAO_PREVIEW_INSET_MM =
  OS_REQUISICAO_MARGEM_CONTEUDO_MM - OS_MODELO1_BORDA_MARGEM_MM;

/** Página A4 do preview: texto sempre a 15 mm da folha. */
export function estiloPaginaRequisicaoPreview() {
  return {
    padding: `${OS_REQUISICAO_MARGEM_CONTEUDO_MM}mm`,
    boxSizing: "border-box" as const,
  };
}

/**
 * Wrapper do conteúdo: com borda, expande até 10 mm sem mover o texto;
 * sem borda, ocupa só a área útil de 15 mm.
 */
export function estiloWrapperConteudoRequisicaoPreview(
  lay: Pick<OsModelo1Layout, "exibirBordas" | "bordas">
) {
  const base = { boxSizing: "border-box" as const, width: "100%" };
  if (!lay.exibirBordas) return base;
  const inset = OS_REQUISICAO_PREVIEW_INSET_MM;
  return {
    ...base,
    marginLeft: `-${inset}mm`,
    marginRight: `-${inset}mm`,
    paddingLeft: `${inset}mm`,
    paddingRight: `${inset}mm`,
    ...estiloBordaRequisicaoPreview(normalizarCorBorda(lay.bordas)),
  };
}

/** Linha divisória de ponta a ponta (encontra a borda quando ativa). */
export function estiloLinhaFullBleedPreview(lay: Pick<OsModelo1Layout, "exibirBordas">) {
  if (!lay.exibirBordas) return {};
  const inset = OS_REQUISICAO_PREVIEW_INSET_MM;
  return {
    marginLeft: `-${inset}mm`,
    marginRight: `-${inset}mm`,
    width: `calc(100% + ${inset * 2}mm)`,
  };
}

export function escalaEspacamentoRequisicao(layout: Pick<OsModelo1Layout, "espacamentoRequisicao">) {
  const pct = clamp(
    Number(layout.espacamentoRequisicao) || OS_REQUISICAO_ESPACAMENTO_PADRAO,
    OS_REQUISICAO_ESPACAMENTO_MIN,
    OS_REQUISICAO_ESPACAMENTO_MAX
  );
  return pct / 100;
}

/** Converte mm de espaçamento vertical para PDF conforme configuração. */
export function gapRequisicaoMm(
  layout: Pick<OsModelo1Layout, "espacamentoRequisicao">,
  mm: number
) {
  return mm * escalaEspacamentoRequisicao(layout);
}

/** Espaçamento em mm para o preview HTML. */
export function gapRequisicaoPreviewMm(
  layout: Pick<OsModelo1Layout, "espacamentoRequisicao">,
  mm: number
) {
  return `${(mm * escalaEspacamentoRequisicao(layout)).toFixed(2)}mm`;
}

export function margensLinhaRequisicao(
  pageWidthMm: number,
  lay: Pick<OsModelo1Layout, "exibirBordas">
) {
  const conteudoEsq = OS_REQUISICAO_MARGEM_CONTEUDO_MM;
  const conteudoDir = pageWidthMm - OS_REQUISICAO_MARGEM_CONTEUDO_MM;
  const linhaEsq = lay.exibirBordas ? OS_MODELO1_BORDA_MARGEM_MM : conteudoEsq;
  const linhaDir = lay.exibirBordas ? pageWidthMm - OS_MODELO1_BORDA_MARGEM_MM : conteudoDir;
  return { linhaEsq, linhaDir, conteudoEsq, conteudoDir };
}

export function hexParaRgb(hex: string): { r: number; g: number; b: number } {
  const normalizado = normalizarCorBorda(hex).replace("#", "");
  const expandido =
    normalizado.length === 3
      ? normalizado
          .split("")
          .map((c) => c + c)
          .join("")
      : normalizado.slice(0, 6);
  const n = Number.parseInt(expandido, 16);
  if (Number.isNaN(n)) return { r: 189, g: 189, b: 189 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function normalizarOsModelo1Layout(
  valor?: Partial<OsModelo1Layout> | null
): OsModelo1Layout {
  if (!valor || typeof valor !== "object") {
    return { ...OS_MODELO1_LAYOUT_PADRAO };
  }
  const base = { ...OS_MODELO1_LAYOUT_PADRAO };
  base.bordas = normalizarCorBorda(valor.bordas);
  base.mensagem = String(valor.mensagem ?? "").trim();
  for (const key of Object.keys(base) as Array<keyof OsModelo1Layout>) {
    if (key === "tamanhoFonte") {
      base.tamanhoFonte = clamp(Number(valor.tamanhoFonte) || 17, 8, 24);
    } else if (key === "espacamentoRequisicao") {
      base.espacamentoRequisicao = clamp(
        Number(valor.espacamentoRequisicao) || OS_REQUISICAO_ESPACAMENTO_PADRAO,
        OS_REQUISICAO_ESPACAMENTO_MIN,
        OS_REQUISICAO_ESPACAMENTO_MAX
      );
    } else if (key === "bordas" || key === "mensagem") {
      /* já tratados */
    } else if (key === "exibirBordas") {
      base.exibirBordas = valor.exibirBordas !== false;
    } else if (key in valor) {
      base[key] = Boolean(valor[key]);
    }
  }
  return base;
}

/** Dados de exemplo para preview do editor (Smart Prótese). */
export const PREVIEW_OS_MODELO1 = {
  numeroOs: 194,
  osExterna: "1.570",
  dataEntrada: "18/02/2021 08:28",
  usuario: "TATIANE",
  cliente: "Dr. Manoel Costa",
  dentista: "Dra. Ana",
  paciente: "Solange Shultter Silva",
  caixa: "547",
  telefones: "(48) 3000-0100 / (48) 91111-0111",
  email: "emaildeteste@teste.com",
  endereco: "Av. José Melo de Testes, 0000 Centro",
  prazo: "19/02/2021 08:00",
  finalizado: "18/02/2021 15:30",
  colaborador: "Funcionário (Metal/Acabamento)",
  obsServico: "Aqui vai a observação do Serviço",
  obsFicha: "Aqui vai as informações internas do Laboratório",
  materiais: "Materias enviados pelo Dentista",
  etapas: "Modelagem → Metal → Cerâmica → Acabamento",
  total: 1147.5,
  itens: [
    {
      qtd: "5",
      descricao: "Elemento Metalo Cerâmica",
      dente: "22-25-27-32-35",
      cor: "A2 - Vita",
      unitario: 255,
      desconto: "% 10,00",
      subtotal: 1147.5,
    },
  ],
};
