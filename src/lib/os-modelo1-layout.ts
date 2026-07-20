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
  /** Exibir data/hora antes de cada etapa na lista (Modelo 1: padrão sem datas; Modelo 2: com datas). */
  etapasComDatas: boolean;
  pecas: boolean;
  assinatura: boolean;
  codBarras: boolean;
  /** Espaçamento vertical da requisição (70–130, padrão 88 ≈ Smart). */
  espacamentoRequisicao: number;
};

export const OS_MODELO1_LAYOUT_PADRAO: OsModelo1Layout = {
  exibirBordas: false,
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
  obsServico: false,
  materialRec: true,
  etapas: true,
  etapasComDatas: false,
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

/** Início vertical do conteúdo na folha (mm). */
export const OS_REQUISICAO_TOPO_MM = 10;

/** Folga entre o conteúdo e a moldura externa (mm), acima e abaixo. */
export const OS_REQUISICAO_BORDA_PADDING_MM = 3;

/** Recuo de Qtd/Subtotal em relação às linhas laterais (mm). */
export const OS_REQUISICAO_COLUNA_MARGEM_MM = 2.5;

/** Posição X (mm) da coluna Descrição no PDF A4 — alinha metadados do item ao texto da descrição. */
export const OS_REQUISICAO_COL_DESCRICAO_MM = 28;

/** Recuo no preview para alinhar metadados (Prazo, Colaborador…) à coluna Descrição do PDF. */
export function recuoMetadadosColunaDescricaoPreviewMm() {
  return (
    OS_REQUISICAO_COL_DESCRICAO_MM -
    OS_REQUISICAO_MARGEM_CONTEUDO_MM -
    OS_REQUISICAO_COLUNA_MARGEM_MM
  );
}

/** Largura da linha de assinatura — Modelos 1 e 2 (preview w-48 ≈ 50 mm). */
export const OS_ASSINATURA_LINHA_PRODUCAO_MM = 50;

/** Largura da linha de assinatura — Modelo 3 comprovante (preview w-56). */
export const OS_ASSINATURA_LINHA_COMPROVANTE_MM = 56;

/** Margem horizontal do texto — não muda ao ligar/desligar borda. */
export const OS_REQUISICAO_MARGEM_CONTEUDO_MM = 15;

export const OS_REQUISICAO_ESPACAMENTO_MIN = 70;
export const OS_REQUISICAO_ESPACAMENTO_MAX = 130;
export const OS_REQUISICAO_ESPACAMENTO_PADRAO = 88;

/**
 * Espessura das linhas no PDF (mm), equivalente a ~1px do preview HTML (96dpi).
 * Traço via `line()` no jsPDF costuma ficar grosso no viewer; usamos retângulo preenchido.
 */
export const OS_REQUISICAO_LINHA_INTERNA_MM = 0.264583;

/** Moldura externa — mesma espessura visual das divisórias. */
export const OS_REQUISICAO_BORDA_EXTERNA_MM = OS_REQUISICAO_LINHA_INTERNA_MM;

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

/** Recuo entre margem do texto (15 mm) e a borda externa (10 mm). */
export const OS_REQUISICAO_PREVIEW_INSET_MM =
  OS_REQUISICAO_MARGEM_CONTEUDO_MM - OS_MODELO1_BORDA_MARGEM_MM;

/** Página A4 do preview: topo compacto, laterais fixas em 15 mm. */
export function estiloPaginaRequisicaoPreview() {
  return {
    paddingTop: `${OS_REQUISICAO_TOPO_MM}mm`,
    paddingLeft: `${OS_REQUISICAO_MARGEM_CONTEUDO_MM}mm`,
    paddingRight: `${OS_REQUISICAO_MARGEM_CONTEUDO_MM}mm`,
    paddingBottom: `${OS_REQUISICAO_MARGEM_CONTEUDO_MM}mm`,
    boxSizing: "border-box" as const,
    overflow: "visible" as const,
  };
}

/** Container do conteúdo — mesma caixa com ou sem moldura. */
export function estiloWrapperConteudoRequisicaoPreview() {
  return {
    position: "relative" as const,
    width: "100%",
    boxSizing: "border-box" as const,
  };
}

/**
 * Moldura no preview em camada absoluta: não altera largura nem posição do texto.
 */
export function estiloMolduraOverlayRequisicaoPreview(
  lay: Pick<OsModelo1Layout, "exibirBordas" | "bordas">
) {
  if (!lay.exibirBordas) {
    return { display: "none" as const };
  }
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

/** Expande linhas até o limite lateral da folha (10 mm), onde a moldura será desenhada. */
export function estiloLimiteLinhasPaginaPreview() {
  const inset = OS_REQUISICAO_PREVIEW_INSET_MM;
  return {
    marginLeft: `-${inset}mm`,
    marginRight: `-${inset}mm`,
    width: `calc(100% + ${inset * 2}mm)`,
  };
}

/** Linha divisória no limite da página (não muda ao ligar/desligar borda). */
export function estiloLinhaDivisoriaLimitePaginaPreview() {
  return {
    ...estiloLimiteLinhasPaginaPreview(),
    ...estiloLinhaRequisicaoPreview(),
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

export function margensLinhaRequisicao(pageWidthMm: number) {
  const conteudoEsq = OS_REQUISICAO_MARGEM_CONTEUDO_MM;
  const conteudoDir = pageWidthMm - OS_REQUISICAO_MARGEM_CONTEUDO_MM;
  const linhaEsq = OS_MODELO1_BORDA_MARGEM_MM;
  const linhaDir = pageWidthMm - OS_MODELO1_BORDA_MARGEM_MM;
  const pad = OS_REQUISICAO_COLUNA_MARGEM_MM;
  return {
    linhaEsq,
    linhaDir,
    conteudoEsq,
    conteudoDir,
    tabelaEsq: linhaEsq + pad,
    tabelaDir: linhaDir - pad,
  };
}

/** Preview: afasta Qtd e Subtotal das linhas laterais. */
export function estiloTabelaMargemColunasPreview() {
  return {
    paddingLeft: `${OS_REQUISICAO_COLUNA_MARGEM_MM}mm`,
    paddingRight: `${OS_REQUISICAO_COLUNA_MARGEM_MM}mm`,
    boxSizing: "border-box" as const,
  };
}

/** Largura do bloco de rótulos dos totais (mm) — alinha com coluna Subtotal e fatura Smart. */
export const OS_REQUISICAO_TOTAIS_LARGURA_MM = 68;

/** Largura da coluna de valores dos totais (mm) — mesma da coluna Subtotal/Desc no PDF. */
export const OS_REQUISICAO_TOTAIS_COL_VALOR_MM = 22;

/** Coluna de valores no preview HTML (px) — par com grid 1fr + 92px da fatura. */
export const OS_REQUISICAO_TOTAIS_COL_VALOR_PX = 92;

type ColunaTabelaOsComprovante =
  | "qtd"
  | "desc"
  | "dente"
  | "cor"
  | "unit"
  | "desc_pct"
  | "subtotal";

const PESO_COLUNA_OS_COMPROVANTE: Record<ColunaTabelaOsComprovante, number> = {
  qtd: 15.5,
  desc: 75.5,
  dente: 20,
  cor: 26,
  unit: 26,
  desc_pct: 22,
  subtotal: 22,
};

/** Colunas visíveis da tabela de itens — Modelo 3 comprovante. */
export function colunasVisiveisOsComprovante(
  layout: Pick<
    OsModelo1Layout,
    "numDente" | "corDente" | "valorUnit" | "desconto" | "subtotal"
  >
): ColunaTabelaOsComprovante[] {
  const cols: ColunaTabelaOsComprovante[] = ["qtd", "desc"];
  if (layout.numDente) cols.push("dente");
  if (layout.corDente) cols.push("cor");
  if (layout.valorUnit) cols.push("unit");
  if (layout.desconto) cols.push("desc_pct");
  if (layout.subtotal) cols.push("subtotal");
  return cols;
}

/** Coluna do rótulo dos totais (alinhado à direita, antes do Subtotal). */
export function colunaRotuloTotaisOsComprovante(
  layout: Pick<OsModelo1Layout, "desconto" | "valorUnit">
): ColunaTabelaOsComprovante {
  if (layout.desconto) return "desc_pct";
  if (layout.valorUnit) return "unit";
  return "desc";
}

/** Índices das colunas vazias, rótulo e valor nos totais do comprovante. */
export function indicesColunasTotaisOsComprovante(
  layout: Pick<
    OsModelo1Layout,
    "numDente" | "corDente" | "valorUnit" | "desconto" | "subtotal"
  >
) {
  const cols = colunasVisiveisOsComprovante(layout);
  const rotulo = colunaRotuloTotaisOsComprovante(layout);
  const idxRotulo = cols.indexOf(rotulo);
  const idxSubtotal = cols.indexOf("subtotal");
  const colspanEntre =
    idxRotulo >= 0 && idxSubtotal > idxRotulo + 1 ? idxSubtotal - idxRotulo - 1 : 0;
  return {
    colspanAntes: Math.max(0, idxRotulo),
    colspanEntre,
    temRotulo: idxRotulo >= 0,
    temSubtotal: idxSubtotal >= 0,
  };
}

/** `<colgroup>` com larguras proporcionais ao PDF Smart. */
export function largurasColunasOsComprovantePreview(
  layout: Pick<
    OsModelo1Layout,
    "numDente" | "corDente" | "valorUnit" | "desconto" | "subtotal"
  >
) {
  const cols = colunasVisiveisOsComprovante(layout);
  const total = cols.reduce((s, c) => s + PESO_COLUNA_OS_COMPROVANTE[c], 0);
  return cols.map((c) => `${((PESO_COLUNA_OS_COMPROVANTE[c] / total) * 100).toFixed(2)}%`);
}

/** HTML string `<col />` para impressão HTML legada. */
export function colgroupOsComprovantePreview(
  layout: Pick<
    OsModelo1Layout,
    "numDente" | "corDente" | "valorUnit" | "desconto" | "subtotal"
  >
) {
  return largurasColunasOsComprovantePreview(layout)
    .map((w) => `<col style="width:${w}" />`)
    .join("");
}

/** Posição X dos rótulos e valores dos totais no PDF (mm). */
export function posicaoTotaisRequisicaoPdf(pageWidthMm: number) {
  const m = margensLinhaRequisicao(pageWidthMm);
  const xValor = m.tabelaDir;
  const xFimRotulo = xValor - OS_REQUISICAO_TOTAIS_COL_VALOR_MM;
  return { ...m, xValor, xFimRotulo };
}

/** Container dos totais no preview HTML — mesma largura da tabela de itens. */
export function estiloBlocoTotaisRequisicaoPreview() {
  return {
    width: "100%",
    boxSizing: "border-box" as const,
  };
}

/** Linha de totais no preview HTML — rótulo à direita, valor à direita. */
export function estiloLinhaTotaisRequisicaoPreview() {
  return {
    display: "grid",
    gridTemplateColumns: `1fr ${OS_REQUISICAO_TOTAIS_COL_VALOR_PX}px`,
    gap: "4px",
    padding: "1px 0",
    alignItems: "baseline" as const,
  };
}

/** Rótulo dos totais no preview HTML — alinhado à direita antes do valor. */
export function estiloRotuloTotaisRequisicaoPreview() {
  return { textAlign: "right" as const, paddingRight: "2px" };
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
      base.exibirBordas = valor.exibirBordas === true;
    } else if (key in valor) {
      base[key] = Boolean(valor[key]);
    }
  }
  base.obsServico = false;
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
