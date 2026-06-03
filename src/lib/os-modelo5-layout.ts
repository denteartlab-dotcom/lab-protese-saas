import {
  normalizarCorBorda,
  normalizarOsModelo1Layout,
  OS_MODELO1_LAYOUT_PADRAO,
  type OsModelo1Layout,
} from "@/lib/os-modelo1-layout";

export type OsModelo5Layout = OsModelo1Layout & {
  logoTamanhoPx: number;
};

const BASE_MODELO5: OsModelo1Layout = {
  ...OS_MODELO1_LAYOUT_PADRAO,
  exibirBordas: false,
  tamanhoFonte: 12,
  infoLab: true,
  logo: true,
  dataOs: true,
  usuario: true,
  numOs: true,
  osExterna: true,
  cliente: true,
  clienteEmail: true,
  dentista: true,
  clienteTel: true,
  paciente: true,
  caixa: true,
  clienteEnd: true,
  dataPrazo: true,
  numDente: true,
  corDente: true,
  valorUnit: true,
  desconto: true,
  subtotal: true,
  total: true,
  finalizado: true,
  colaborador: true,
  produtos: true,
  obsFicha: true,
  obsServico: true,
  materialRec: true,
  assinatura: true,
  codBarras: true,
  producao: false,
  etapas: false,
  pecas: false,
};

/** Padrão Smart — Modelo 5 comprovante de entrega térmica 80mm Epson T20. */
export const OS_MODELO5_LAYOUT_PADRAO: OsModelo5Layout = {
  ...BASE_MODELO5,
  bordas: "#000000",
  logoTamanhoPx: 120,
};

export const CAMPOS_MODELO5_GERAL: Array<{
  key: keyof OsModelo5Layout;
  label: string;
}> = [
  { key: "infoLab", label: "Info Lab" },
  { key: "logo", label: "Logo" },
  { key: "dataOs", label: "Data OS" },
  { key: "usuario", label: "Usuário" },
];

type CampoCheckbox = { key: keyof OsModelo5Layout; label: string };

export const CAMPOS_MODELO5_PARES: Array<[CampoCheckbox, CampoCheckbox | null]> = [
  [{ key: "numOs", label: "Num OS" }, { key: "osExterna", label: "OS Externa" }],
  [{ key: "cliente", label: "Cliente" }, { key: "clienteEmail", label: "Cliente Email" }],
  [{ key: "dentista", label: "Dentista" }, { key: "clienteTel", label: "Cliente Tel" }],
  [{ key: "paciente", label: "Paciente" }, { key: "caixa", label: "Caixa" }],
  [{ key: "numDente", label: "Num Dente" }, { key: "corDente", label: "Cor Dente" }],
  [{ key: "valorUnit", label: "Valor Unit" }, { key: "desconto", label: "Desconto" }],
  [{ key: "subtotal", label: "Subtotal" }, { key: "total", label: "Total" }],
  [{ key: "dataPrazo", label: "Data Prazo" }, { key: "finalizado", label: "Finalizado" }],
  [{ key: "colaborador", label: "Colaborador" }, { key: "produtos", label: "Produtos" }],
  [{ key: "obsFicha", label: "Obs Ficha" }, { key: "obsServico", label: "Obs Serviço" }],
  [{ key: "materialRec", label: "Material" }, { key: "assinatura", label: "Assinatura" }],
  [{ key: "codBarras", label: "Cod Barras" }, null],
];

export function normalizarOsModelo5Layout(
  valor?: Partial<OsModelo5Layout> | null
): OsModelo5Layout {
  const base = normalizarOsModelo1Layout({
    ...OS_MODELO5_LAYOUT_PADRAO,
    ...(valor ?? {}),
  }) as OsModelo5Layout;

  base.logoTamanhoPx = Math.min(200, Math.max(40, Number(valor?.logoTamanhoPx) || 120));
  base.bordas = normalizarCorBorda(valor?.bordas ?? base.bordas);
  base.tamanhoFonte = Math.min(18, Math.max(8, Number(valor?.tamanhoFonte) || 12));

  for (const key of Object.keys(BASE_MODELO5) as Array<keyof OsModelo1Layout>) {
    if (
      key in (valor ?? {}) &&
      key !== "tamanhoFonte" &&
      key !== "bordas" &&
      key !== "mensagem" &&
      key !== "espacamentoRequisicao"
    ) {
      base[key] = Boolean(valor![key]);
    }
  }

  return base;
}

export const PREVIEW_OS_MODELO5 = {
  numeroOs: 154,
  osInterna: "1.234",
  dataEntrada: "05/05/2022",
  usuario: "Fernando",
  cliente: "Dra. Ana Carla Silva",
  dentista: "Dr. Alisson Lima",
  paciente: "Maycon Silva Teste",
  caixa: "110",
  telefone: "(31) 7777-8888 / (31) 98888-8888",
  email: "drana@carla@teste.com",
  endereco: "Av. Jose Maria de Testes, 2000 Centro",
  prazo: "05/05/2022",
  finalizado: "05/05/2022",
  colaborador: "Funcionario de teste (Metal/Acabamento)",
  obsServico: "Informações sobre o Serviço",
  obsFicha: "Aqui vai as Informações Internas do Laboratório",
  materiais: "Materiais enviados pelo dentista",
  totalServicos: 1275,
  totalDescontos: 127.5,
  total: 1147.5,
  itens: [
    {
      qtd: "5",
      descricao: "Elemento Metal Free Cerâmica",
      dente: "22-25-27-33-35",
      cor: "A2 - Vita",
      unitario: 250,
      desconto: "% 10,00",
      subtotal: 1147.5,
    },
  ],
};
