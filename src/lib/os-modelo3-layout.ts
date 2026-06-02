import {
  normalizarCorBorda,
  normalizarOsModelo1Layout,
  OS_MODELO1_LAYOUT_PADRAO,
  PREVIEW_OS_MODELO1,
  type OsModelo1Layout,
} from "@/lib/os-modelo1-layout";

export type OsModelo3Layout = OsModelo1Layout;

/** Padrão Smart — Modelo 3 Comprovante de Entrega (somente campos marcados na foto). */
export const OS_MODELO3_LAYOUT_PADRAO: OsModelo3Layout = {
  exibirBordas: false,
  bordas: "#bdbdbd",
  mensagem: "",
  infoLab: true,
  logo: true,
  dataOs: false,
  usuario: false,
  tamanhoFonte: 16,
  numOs: true,
  osExterna: false,
  cliente: true,
  clienteEmail: false,
  dentista: true,
  clienteTel: false,
  paciente: true,
  caixa: true,
  clienteEnd: true,
  numDente: true,
  corDente: true,
  valorUnit: true,
  desconto: true,
  subtotal: true,
  total: true,
  dataPrazo: false,
  finalizado: false,
  colaborador: true,
  produtos: false,
  producao: false,
  obsFicha: false,
  obsServico: false,
  materialRec: true,
  etapas: false,
  pecas: false,
  assinatura: true,
  codBarras: true,
};

export const CAMPOS_MODELO3_GERAL: Array<{
  key: keyof OsModelo3Layout;
  label: string;
}> = [
  { key: "infoLab", label: "Info Lab" },
  { key: "logo", label: "Logo" },
  { key: "dataOs", label: "Data OS" },
  { key: "usuario", label: "Usuário" },
];

type CampoCheckbox = { key: keyof OsModelo3Layout; label: string };

/** Pares de checkboxes do Modelo 3 (Comprovante de Entrega — Smart Prótese). */
export const CAMPOS_MODELO3_PARES: Array<[CampoCheckbox, CampoCheckbox | null]> = [
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
  [{ key: "obsFicha", label: "Obs Ficha" }, { key: "obsServico", label: "Cód Serviço" }],
  [{ key: "materialRec", label: "Material Rec" }, { key: "pecas", label: "Peças" }],
  [{ key: "assinatura", label: "Assinatura" }, { key: "codBarras", label: "Cod Barras" }],
];

export function normalizarOsModelo3Layout(
  valor?: Partial<OsModelo3Layout> | null
): OsModelo3Layout {
  if (!valor || typeof valor !== "object") {
    return { ...OS_MODELO3_LAYOUT_PADRAO };
  }
  const base = normalizarOsModelo1Layout({ ...OS_MODELO3_LAYOUT_PADRAO, ...valor });
  base.tamanhoFonte = Math.min(
    24,
    Math.max(8, Number(valor.tamanhoFonte) || OS_MODELO3_LAYOUT_PADRAO.tamanhoFonte)
  );
  base.bordas = normalizarCorBorda(valor.bordas ?? base.bordas);
  base.exibirBordas = Boolean(valor.exibirBordas);
  base.mensagem = String(valor.mensagem ?? "").trim();
  for (const key of Object.keys(OS_MODELO3_LAYOUT_PADRAO) as Array<keyof OsModelo3Layout>) {
    if (key in valor && key !== "tamanhoFonte" && key !== "bordas" && key !== "mensagem") {
      base[key] = Boolean(valor[key]);
    }
  }
  return base;
}

export const PREVIEW_OS_MODELO3 = {
  ...PREVIEW_OS_MODELO1,
  totalServicos: 1275,
  totalDescontos: 127.5,
  produtos: "Elemento Metalo Cerâmica (serviço principal)",
  pecas: "22, 25, 27, 32, 35",
};
