export type OsModelo1Layout = {
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
  obsFicha: boolean;
  obsServico: boolean;
  materialRec: boolean;
  etapas: boolean;
  assinatura: boolean;
  codBarras: boolean;
};

export const OS_MODELO1_LAYOUT_PADRAO: OsModelo1Layout = {
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
  obsFicha: true,
  obsServico: true,
  materialRec: true,
  etapas: true,
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

export const CAMPOS_MODELO1_CAMPOS: Array<{
  key: keyof OsModelo1Layout;
  label: string;
}> = [
  { key: "numOs", label: "Num OS" },
  { key: "osExterna", label: "OS Externa" },
  { key: "cliente", label: "Cliente" },
  { key: "clienteEmail", label: "Cliente Email" },
  { key: "dentista", label: "Dentista" },
  { key: "clienteTel", label: "Cliente Tel" },
  { key: "paciente", label: "Paciente" },
  { key: "caixa", label: "Caixa" },
  { key: "clienteEnd", label: "Cliente End" },
  { key: "numDente", label: "Num Dente" },
  { key: "corDente", label: "Cor Dente" },
  { key: "valorUnit", label: "Valor Unit" },
  { key: "desconto", label: "Desconto" },
  { key: "subtotal", label: "Subtotal" },
  { key: "total", label: "Total" },
  { key: "dataPrazo", label: "Data Prazo" },
  { key: "finalizado", label: "Finalizado" },
  { key: "colaborador", label: "Colaborador" },
  { key: "produtos", label: "Produtos" },
  { key: "obsFicha", label: "Obs Ficha" },
  { key: "obsServico", label: "Obs Serviço" },
  { key: "materialRec", label: "Material Rec" },
  { key: "etapas", label: "Etapas" },
  { key: "assinatura", label: "Assinatura" },
  { key: "codBarras", label: "Cod Barras" },
];

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
  for (const key of Object.keys(base) as Array<keyof OsModelo1Layout>) {
    if (key === "tamanhoFonte") {
      base.tamanhoFonte = clamp(Number(valor.tamanhoFonte) || 17, 8, 24);
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
  dataEntrada: "19/08/2021 08:35",
  usuario: "Fernando",
  status: "Em Produção",
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
      cor: "A2 - Vitta",
      unitario: 255,
      desconto: "% 10,00",
      subtotal: 1147.5,
    },
  ],
};
