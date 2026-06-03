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
};

export const OS_MODELO1_LAYOUT_PADRAO: OsModelo1Layout = {
  exibirBordas: true,
  bordas: "#bdbdbd",
  mensagem: "",
  infoLab: true,
  logo: true,
  dataOs: true,
  usuario: true,
  tamanhoFonte: 17,
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

/** Padding entre a borda externa e o conteúdo da requisição (mm). */
export const OS_REQUISICAO_BORDA_PADDING_MM = 8;

/** Espessura das linhas divisórias internas no PDF (mm). */
export const OS_REQUISICAO_LINHA_INTERNA_MM = 0.12;

/** Espessura da borda externa da requisição no PDF (mm). */
export const OS_REQUISICAO_BORDA_EXTERNA_MM = 0.15;

/** Espessura das linhas no preview HTML (px). */
export const OS_REQUISICAO_LINHA_PREVIEW_PX = 1;

/** Estilo de linha horizontal no preview do editor. */
export function estiloLinhaRequisicaoPreview(cor: string) {
  return {
    borderColor: cor,
    borderTopWidth: OS_REQUISICAO_LINHA_PREVIEW_PX,
    borderTopStyle: "solid" as const,
  };
}

/** Linha divisória abaixo de uma seção (cabeçalho da tabela, linhas de item). */
export function estiloLinhaInferiorRequisicaoPreview(cor: string) {
  return {
    borderColor: cor,
    borderBottomWidth: OS_REQUISICAO_LINHA_PREVIEW_PX,
    borderBottomStyle: "solid" as const,
  };
}

/** Estilo da borda externa no preview do editor. */
export function estiloBordaRequisicaoPreview(cor: string) {
  return {
    border: `${OS_REQUISICAO_LINHA_PREVIEW_PX}px solid ${cor}`,
    padding: `${OS_REQUISICAO_BORDA_PADDING_MM}mm 10mm`,
    boxSizing: "border-box" as const,
  };
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
