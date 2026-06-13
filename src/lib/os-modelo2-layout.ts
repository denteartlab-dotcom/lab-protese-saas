import {
  normalizarCorBorda,
  normalizarOsModelo1Layout,
  OS_MODELO1_LAYOUT_PADRAO,
  PREVIEW_OS_MODELO1,
  type OsModelo1Layout,
} from "@/lib/os-modelo1-layout";

export type OsModelo2Layout = OsModelo1Layout;

export const OS_MODELO2_LAYOUT_PADRAO: OsModelo2Layout = {
  ...OS_MODELO1_LAYOUT_PADRAO,
  exibirBordas: false,
  tamanhoFonte: 16,
  produtos: false,
  etapas: true,
  etapasComDatas: true,
  producao: true,
  pecas: true,
};

type CampoCheckbox = { key: keyof OsModelo2Layout; label: string };

/** Pares de checkboxes do Modelo 2 (Produção / Peças no lugar de Produtos / Etapas). */
export const CAMPOS_MODELO2_PARES: Array<[CampoCheckbox, CampoCheckbox | null]> = [
  [{ key: "numOs", label: "Num OS" }, { key: "osExterna", label: "OS Externa" }],
  [{ key: "cliente", label: "Cliente" }, { key: "clienteEmail", label: "Cliente Email" }],
  [{ key: "dentista", label: "Dentista" }, { key: "clienteTel", label: "Cliente Tel" }],
  [{ key: "paciente", label: "Paciente" }, { key: "caixa", label: "Caixa" }],
  [{ key: "clienteEnd", label: "Cliente End" }, null],
  [{ key: "numDente", label: "Num Dente" }, { key: "corDente", label: "Cor Dente" }],
  [{ key: "valorUnit", label: "Valor Unit" }, { key: "desconto", label: "Desconto" }],
  [{ key: "subtotal", label: "Subtotal" }, { key: "total", label: "Total" }],
  [{ key: "dataPrazo", label: "Data Prazo" }, { key: "finalizado", label: "Finalizado" }],
  [{ key: "colaborador", label: "Colaborador" }, { key: "producao", label: "Produção" }],
  [{ key: "obsFicha", label: "Obs Ficha" }, { key: "obsServico", label: "Obs Serviço" }],
  [{ key: "materialRec", label: "Material Rec" }, { key: "pecas", label: "Peças" }],
  [{ key: "etapas", label: "Etapas" }, null],
  [{ key: "assinatura", label: "Assinatura" }, { key: "codBarras", label: "Cod Barras" }],
];

export function normalizarOsModelo2Layout(
  valor?: Partial<OsModelo2Layout> | null
): OsModelo2Layout {
  if (!valor || typeof valor !== "object") {
    return { ...OS_MODELO2_LAYOUT_PADRAO };
  }
  const base = normalizarOsModelo1Layout({ ...OS_MODELO2_LAYOUT_PADRAO, ...valor });
  base.tamanhoFonte = Math.min(
    24,
    Math.max(8, Number(valor.tamanhoFonte) || OS_MODELO2_LAYOUT_PADRAO.tamanhoFonte)
  );
  base.bordas = normalizarCorBorda(valor.bordas ?? base.bordas);
  if ("producao" in valor) base.producao = Boolean(valor.producao);
  if ("pecas" in valor) base.pecas = Boolean(valor.pecas);
  if ("produtos" in valor) base.produtos = Boolean(valor.produtos);
  if ("etapas" in valor) base.etapas = Boolean(valor.etapas);
  if ("etapasComDatas" in valor) base.etapasComDatas = Boolean(valor.etapasComDatas);
  base.exibirBordas = valor.exibirBordas === true;
  return base;
}

export const PREVIEW_OS_MODELO2 = {
  ...PREVIEW_OS_MODELO1,
  producao: "Metal / Acabamento — Em produção",
  pecas: "22, 25, 27, 32, 35",
};
