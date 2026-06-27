import { formatDate, STATUS_TRABALHO } from "@/lib/utils";
import { prisma } from "@/lib/db";
import {
  segmentoEfetivoTrabalho,
  whereGrupoOs,
  type SegmentoFaturamento,
} from "@/lib/trabalho-os-segmento";
import { telefoneWhatsappCliente } from "@/lib/cliente-observacoes";
import {
  colaboradorParaImpressao,
  etapasPorServicoImpressao,
  instrucoesTextoLivre,
  parseColaboradoresInstrucoes,
  parseEtapasInstrucoes,
} from "@/lib/etapas-os-impressao";
import {
  anexarPrazosServicoPorTrabalho,
  extrairDataPrazoBr,
  extrairItensImpressaoOs,
  flagsUrgenteRepeticaoInstrucoes,
} from "@/lib/os-itens-impressao";
import {
  garantirNomeLaboratorioParaImpressao,
  nomeUsuarioDocumentosLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { carregarConfiguracoesOsServidor } from "@/lib/configuracoes-os-servidor";
import type { ConfiguracoesOs } from "@/lib/configuracoes-os";
import { resolverDataFinalizadoImpressao } from "@/lib/os-itens-impressao";

export type DadosImpressaoOsPdf = {
  numeroOs: number;
  usuarioCriou?: string;
  dataEntrada: string;
  status: string;
  cliente: string;
  dentista: string;
  paciente: string;
  caixa: string;
  telefones: string;
  email: string;
  endereco: string;
  valor: number;
  prazo: string;
  prazoLaboratorio: string;
  prazoDentista: string;
  materiais: string;
  observacoes: string;
  prazoLinhaServico?: string;
  osExterna?: string;
  chavePed?: string;
  finalizado?: string;
  colaborador?: string;
  colaboradoresLista?: ReturnType<typeof parseColaboradoresInstrucoes>;
  etapasLista?: ReturnType<typeof parseEtapasInstrucoes>;
  etapasPorServico?: ReturnType<typeof etapasPorServicoImpressao>;
  etapas?: string;
  urgente?: boolean;
  repeticao?: boolean;
  producao?: string;
  pecas?: string;
  obsFicha?: string;
  itens: ReturnType<typeof extrairItensImpressaoOs>;
  /** Config do laboratório (cabeçalho, logo) — carregada no servidor para impressão. */
  configLaboratorio?: ConfigLaboratorio;
  /** Layout da OS (Configurações › Ordem de serviço) — carregado no servidor. */
  configuracoesOs?: ConfiguracoesOs;
};

export type OpcoesImpressaoOs = {
  somenteItem: boolean;
  duasVias: boolean;
  formato: string;
  modelo: string;
  segmentoParam: string;
};

export type ResultadoImpressaoOs =
  | {
      ok: true;
      dados: DadosImpressaoOsPdf;
      opcoes: OpcoesImpressaoOs;
    }
  | {
      ok: false;
      titulo: string;
      detalhe: string;
      status: number;
    };

const selectTrabalhoImpressao = {
  id: true,
  empresaId: true,
  numeroOs: true,
  segmentoFaturamento: true,
  grupoOsId: true,
  tipoProtese: true,
  dentes: true,
  cor: true,
  material: true,
  escala: true,
  valor: true,
  dataEntrada: true,
  dataPrevista: true,
  dataEntrega: true,
  status: true,
  instrucoes: true,
  updatedAt: true,
  cliente: {
    select: {
      nome: true,
      cro: true,
      telefone: true,
      celular: true,
      email: true,
      endereco: true,
      cidade: true,
      observacoes: true,
    },
  },
  paciente: { select: { nome: true } },
} as const;

function empty(value?: string | null) {
  return value?.trim() || "";
}

function dateOrEmpty(value?: string | Date | null) {
  if (!value) return "";
  return formatDate(value instanceof Date ? value.toISOString() : value);
}

function linesFrom(instrucoes?: string | null) {
  return (instrucoes || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function lineValue(lines: string[], prefix: string) {
  return lines.find((line) => line.startsWith(prefix))?.replace(prefix, "").trim() || "";
}

function clienteNomeComAbreviacao(
  cliente: NonNullable<
    Awaited<
      ReturnType<typeof prisma.trabalho.findFirst<{ select: typeof selectTrabalhoImpressao }>>
    >
  >["cliente"]
) {
  const nome = empty(cliente?.nome);
  const abreviacao = (cliente?.observacoes || "")
    .split("\n")
    .find((line) => line.startsWith("Abreviação:"))
    ?.replace("Abreviação:", "")
    .trim();

  if (!abreviacao || nome.startsWith(`${abreviacao} `)) return nome;
  return `${abreviacao} ${nome}`;
}

export function searchFlagImpressaoOs(value: string | string[] | undefined) {
  const texto = Array.isArray(value) ? value[0] : value;
  return texto === "1" || texto === "sim" || texto === "true";
}

export function resolverOpcoesImpressaoOs(
  sp: Record<string, string | string[] | undefined>
): OpcoesImpressaoOs {
  const somenteItem = searchFlagImpressaoOs(sp.somenteItem);
  const duasVias = sp.vias === "2" || searchFlagImpressaoOs(sp.duasVias);
  const formato = String(Array.isArray(sp.formato) ? sp.formato[0] : sp.formato || "a4");
  const modeloRaw = String(Array.isArray(sp.modelo) ? sp.modelo[0] : sp.modelo || "");
  const modelo =
    formato === "etiquetas"
      ? ["slk-54x101", "2rle-36x89", "2rlh-28x89", "mrl-20x51"].includes(modeloRaw)
        ? modeloRaw
        : "slk-54x101"
      : formato === "termica"
        ? modeloRaw === "modelo5"
          ? "modelo5"
          : modeloRaw === "modelo4"
            ? "modelo4"
            : "modelo4"
        : modeloRaw === "modelo3" || modeloRaw === "comprovante"
          ? "modelo3"
          : modeloRaw === "modelo2"
            ? "modelo2"
            : "modelo1";
  const segmentoParam = String(Array.isArray(sp.segmento) ? sp.segmento[0] : sp.segmento || "");

  return { somenteItem, duasVias, formato, modelo, segmentoParam };
}

function valorMonetarioSeguro(valor: number) {
  return Number.isFinite(valor) ? valor : 0;
}

function nomeUsuarioDocumentosImpressao(
  config: Awaited<ReturnType<typeof carregarConfigLaboratorioServidor>>,
  empresaNome?: string
) {
  const nomeLab =
    config.nomeLaboratorio?.trim() ||
    config.nomeFantasia?.trim() ||
    config.razaoSocial?.trim() ||
    config.nome?.trim() ||
    "";
  return (
    nomeLab ||
    empresaNome?.trim() ||
    config.responsavel?.trim() ||
    ""
  );
}

function codigoErroPrisma(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: string }).code);
  }
  return "";
}

export function mensagemErroImpressaoOs(err: unknown) {
  const prismaCode = codigoErroPrisma(err);
  if (prismaCode === "P2022") {
    return "O banco Neon está desatualizado em relação ao sistema. No servidor, na pasta do projeto, execute: npx prisma db push (com DATABASE_URL do Neon no .env).";
  }
  if (prismaCode === "P1001" || prismaCode === "P1017") {
    return "Não foi possível conectar ao banco de dados (Neon). Verifique DATABASE_URL no servidor e tente novamente.";
  }
  if (err instanceof Error) {
    const msg = err.message.trim();
    if (/plain objects|cannot be passed to client components/i.test(msg)) {
      return "Erro ao montar os dados da OS para impressão. Atualize a página (Ctrl+F5) e tente novamente.";
    }
    if (process.env.NODE_ENV === "development") return msg;
    if (msg.length > 0 && msg.length <= 160) return msg;
  }
  return "Não foi possível gerar a requisição. Verifique a conexão com o banco (Neon) e faça um novo deploy no servidor.";
}

function sanitizarItensImpressao(itens: ReturnType<typeof extrairItensImpressaoOs>) {
  return itens.map((item) => ({
    ...item,
    unitario: valorMonetarioSeguro(item.unitario),
  }));
}

/** Garante JSON seguro para o cliente (sem Date, NaN ou undefined). */
export function sanitizarDadosPdfOs<T>(valor: T): T {
  return JSON.parse(
    JSON.stringify(valor, (_chave, item) => {
      if (typeof item === "number" && !Number.isFinite(item)) return 0;
      if (item === undefined) return null;
      return item;
    })
  ) as T;
}

export async function carregarDadosImpressaoOs({
  id,
  empresaId,
  sp,
}: {
  id: string;
  empresaId: string;
  sp: Record<string, string | string[] | undefined>;
}): Promise<ResultadoImpressaoOs> {
  const opcoes = resolverOpcoesImpressaoOs(sp);
  const { somenteItem, segmentoParam } = opcoes;

  let t: Awaited<
    ReturnType<typeof prisma.trabalho.findFirst<{ select: typeof selectTrabalhoImpressao }>>
  > = null;

  try {
    t = await prisma.trabalho.findFirst({
      where: { id, empresaId },
      select: selectTrabalhoImpressao,
    });
  } catch (err) {
    console.error("imprimir: findFirst", { id, empresaId, err });
    throw err;
  }

  if (!t) {
    return {
      ok: false,
      titulo: "OS não encontrada ou removida.",
      detalhe: "Volte para o Controle de Produção e abra uma OS existente.",
      status: 404,
    };
  }

  type TrabalhoComRelacoes = NonNullable<typeof t>;

  let grupo: TrabalhoComRelacoes[] = [t];
  try {
    grupo = await prisma.trabalho.findMany({
      where: { empresaId, ...whereGrupoOs(t) },
      orderBy: { segmentoFaturamento: "asc" },
      select: selectTrabalhoImpressao,
    });
  } catch (err) {
    console.error("imprimir: grupo OS", { id, empresaId, err });
    grupo = [t];
  }

  const instrucoesGrupo = somenteItem
    ? [t.instrucoes]
    : grupo.length > 0
      ? grupo.map((row) => row.instrucoes)
      : [t.instrucoes];
  const valorGrupo = somenteItem
    ? valorMonetarioSeguro(t.valor)
    : grupo.length > 0
      ? grupo.reduce((sum, row) => sum + valorMonetarioSeguro(row.valor), 0)
      : valorMonetarioSeguro(t.valor);
  const trabalhoServico =
    grupo.find((row) => (row.segmentoFaturamento || "servico") === "servico") || t;

  const segmentoSomenteItem: SegmentoFaturamento | null = somenteItem
    ? segmentoParam === "servico" ||
      segmentoParam === "produto" ||
      segmentoParam === "transporte"
      ? segmentoParam
      : segmentoEfetivoTrabalho(t)
    : null;

  const textoInstrucoesGrupo = instrucoesGrupo.filter(Boolean).join("\n");
  const linhas = linesFrom(textoInstrucoesGrupo);
  const prazoLaboratorio = extrairDataPrazoBr(lineValue(linhas, "Data laboratório:"));
  const prazoDentista = extrairDataPrazoBr(lineValue(linhas, "Data dentista:"));
  const statusServico = trabalhoServico.status;

  let itens = extrairItensImpressaoOs(
    instrucoesGrupo,
    {
      tipoProtese: t.tipoProtese,
      dentes: t.dentes,
      cor: t.cor,
      escala: trabalhoServico.escala ?? t.escala,
      valor: valorMonetarioSeguro(t.valor),
    },
    {},
    segmentoSomenteItem
  );

  itens = sanitizarItensImpressao(
    anexarPrazosServicoPorTrabalho(
      itens,
      grupo,
      (status) => STATUS_TRABALHO[status]?.label || status
    )
  );

  const prazoLinhaServico =
    segmentoSomenteItem && segmentoSomenteItem !== "servico"
      ? ""
      : itens.find((item) => item.tipo === "servico")?.notasAbaixo?.[0] || "";
  const materiais = lineValue(linhas, "Material enviado:") || empty(t.material);
  const caixa = lineValue(linhas, "Caixa:");
  const osExterna =
    lineValue(linhas, "OS Interna:") ||
    lineValue(linhas, "OS Externa:") ||
    lineValue(linhas, "OS externa:");
  const chavePed = lineValue(linhas, "Chave Ped:") || lineValue(linhas, "Chave ped:");
  const colaborador = colaboradorParaImpressao(textoInstrucoesGrupo);
  const dentistaNome =
    lineValue(linhas, "Dentista:") || lineValue(linhas, "Dentista convidado:");
  const observacoesUsuario = somenteItem
    ? instrucoesTextoLivre(t.instrucoes)
    : instrucoesTextoLivre(trabalhoServico.instrucoes);
  const cliente = t.cliente || {
    nome: "",
    cro: "",
    telefone: "",
    celular: "",
    email: "",
    endereco: "",
    cidade: "",
    observacoes: "",
  };
  const paciente = t.paciente || { nome: "" };
  const nomeCliente = clienteNomeComAbreviacao(cliente);
  const { urgente, repeticao } = flagsUrgenteRepeticaoInstrucoes(
    instrucoesGrupo,
    segmentoSomenteItem
  );

  let empresaNome: string | undefined;
  try {
    const empresa = await prisma.empresa.findUnique({
      where: { id: t.empresaId },
      select: { nome: true },
    });
    empresaNome = empresa?.nome;
  } catch (err) {
    console.error("imprimir: empresa", { id, empresaId: t.empresaId, err });
  }

  const configLabRaw = await carregarConfigLaboratorioServidor(t.empresaId);
  const configLab = garantirNomeLaboratorioParaImpressao(configLabRaw, empresaNome);
  const configuracoesOs = await carregarConfiguracoesOsServidor(t.empresaId);
  const usuarioCriou = nomeUsuarioDocumentosImpressao(configLab, empresaNome);

  const etapasPorServico = somenteItem
    ? segmentoEfetivoTrabalho(t) === "servico"
      ? etapasPorServicoImpressao([t], segmentoEfetivoTrabalho)
      : []
    : etapasPorServicoImpressao(grupo, segmentoEfetivoTrabalho);

  const dados = sanitizarDadosPdfOs({
    numeroOs: t.numeroOs,
    usuarioCriou,
    dataEntrada: dateOrEmpty(t.dataEntrada),
    status: STATUS_TRABALHO[t.status]?.label || t.status || "",
    cliente: nomeCliente,
    dentista: empty(dentistaNome) || empty(cliente.cro),
    paciente: empty(paciente.nome),
    caixa,
    telefones: telefoneWhatsappCliente(cliente),
    email: empty(cliente.email),
    endereco: [cliente.endereco, cliente.cidade].filter(Boolean).join(" - "),
    valor: valorMonetarioSeguro(valorGrupo),
    prazo: dateOrEmpty(trabalhoServico.dataPrevista),
    prazoLaboratorio,
    prazoDentista,
    materiais,
    observacoes: observacoesUsuario,
    prazoLinhaServico,
    osExterna,
    chavePed,
    finalizado: resolverDataFinalizadoImpressao({
      status: trabalhoServico.status,
      dataEntrega: trabalhoServico.dataEntrega,
      updatedAt: trabalhoServico.updatedAt,
    }),
    colaborador,
    colaboradoresLista: parseColaboradoresInstrucoes(textoInstrucoesGrupo),
    etapasLista: parseEtapasInstrucoes(textoInstrucoesGrupo),
    etapasPorServico,
    etapas: lineValue(linhas, "Etapas:"),
    urgente,
    repeticao,
    producao: STATUS_TRABALHO[statusServico]?.label || statusServico || "",
    pecas: empty(t.dentes),
    obsFicha: "",
    itens,
    configLaboratorio: sanitizarDadosPdfOs(configLab),
    configuracoesOs: sanitizarDadosPdfOs(configuracoesOs),
  });

  return { ok: true, dados, opcoes };
}
