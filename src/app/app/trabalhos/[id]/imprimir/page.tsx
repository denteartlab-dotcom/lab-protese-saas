import { formatDate, STATUS_TRABALHO } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  grupoOsIdOf,
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
} from "@/lib/etapas-os";
import {
  anexarPrazosServicoPorTrabalho,
  extrairDataPrazoBr,
  extrairItensImpressaoOs,
  flagsUrgenteRepeticaoInstrucoes,
} from "@/lib/os-itens-impressao";
import { nomeUsuarioDocumentosLaboratorio } from "@/lib/configuracoes-lab";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { PdfOsViewer } from "./pdf-os-viewer";

type Trabalho = {
  id: string;
  numeroOs: number;
  segmentoFaturamento?: string | null;
  grupoOsId?: string | null;
  tipoProtese: string;
  dentes?: string | null;
  cor?: string | null;
  material?: string | null;
  escala?: string | null;
  status: string;
  valor: number;
  dataEntrada: Date | string;
  dataPrevista?: Date | string | null;
  dataEntrega?: Date | string | null;
  observacoes?: string | null;
  instrucoes?: string | null;
  cliente?: {
    nome: string;
    cro?: string | null;
    telefone?: string | null;
    celular?: string | null;
    email?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    observacoes?: string | null;
  };
  paciente?: { nome: string };
};

export const dynamic = "force-dynamic";

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

function clienteNomeComAbreviacao(cliente: Trabalho["cliente"]) {
  const nome = empty(cliente?.nome);
  const abreviacao = (cliente?.observacoes || "")
    .split("\n")
    .find((line) => line.startsWith("Abreviação:"))
    ?.replace("Abreviação:", "")
    .trim();

  if (!abreviacao || nome.startsWith(`${abreviacao} `)) return nome;
  return `${abreviacao} ${nome}`;
}

function searchFlag(value: string | string[] | undefined) {
  const texto = Array.isArray(value) ? value[0] : value;
  return texto === "1" || texto === "sim" || texto === "true";
}

function ErroImpressao({
  titulo,
  detalhe,
}: {
  titulo: string;
  detalhe: string;
}) {
  return (
    <div className="mx-auto mt-10 max-w-xl rounded border border-red-200 bg-red-50 p-6 text-center text-red-700">
      <p className="font-semibold">{titulo}</p>
      <p className="mt-2 text-sm">{detalhe}</p>
    </div>
  );
}

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

function valorMonetarioSeguro(valor: number) {
  return Number.isFinite(valor) ? valor : 0;
}

function codigoErroPrisma(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: string }).code);
  }
  return "";
}

function mensagemErroImpressao(err: unknown) {
  const prismaCode = codigoErroPrisma(err);
  if (prismaCode === "P2022") {
    return "O banco Neon está desatualizado em relação ao sistema. No servidor, na pasta do projeto, execute: npx prisma db push (com DATABASE_URL do Neon no .env).";
  }
  if (prismaCode === "P1001" || prismaCode === "P1017") {
    return "Não foi possível conectar ao banco de dados (Neon). Verifique DATABASE_URL no servidor e tente novamente.";
  }
  if (process.env.NODE_ENV === "development" && err instanceof Error) {
    return err.message;
  }
  return "Não foi possível gerar a requisição. Verifique a conexão com o banco (Neon) e faça um novo deploy no servidor.";
}

function sanitizarItensImpressao(itens: ReturnType<typeof extrairItensImpressaoOs>) {
  return itens.map((item) => ({
    ...item,
    unitario: valorMonetarioSeguro(item.unitario),
  }));
}

async function ImprimirOSConteudo({
  id,
  sp,
  empresaId,
}: {
  id: string;
  sp: Record<string, string | string[] | undefined>;
  empresaId: string;
}) {
  const somenteItem = searchFlag(sp.somenteItem);
  const duasVias = sp.vias === "2" || searchFlag(sp.duasVias);
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

  /** Só campos usados no PDF — evita falha se o Neon estiver sem colunas novas do schema. */
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
    return (
      <ErroImpressao
        titulo="OS não encontrada ou removida."
        detalhe="Volte para o Controle de Produção e abra uma OS existente."
      />
    );
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
    console.error("imprimir: grupo OS", { id, empresaId, grupoOsId: grupoOsIdOf(t), err });
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

  const configLab = await carregarConfigLaboratorioServidor(t.empresaId);
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
  const usuarioCriou = nomeUsuarioDocumentosLaboratorio(configLab, empresaNome);

  const etapasPorServico = somenteItem
    ? segmentoEfetivoTrabalho(t) === "servico"
      ? etapasPorServicoImpressao([t], segmentoEfetivoTrabalho)
      : []
    : etapasPorServicoImpressao(grupo, segmentoEfetivoTrabalho);

  return (
    <PdfOsViewer
      formato={formato}
      modelo={modelo}
      duasVias={duasVias}
      data={{
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
        valor: valorGrupo,
        prazo: dateOrEmpty(trabalhoServico.dataPrevista),
        prazoLaboratorio,
        prazoDentista,
        materiais,
        observacoes: observacoesUsuario,
        prazoLinhaServico,
        osExterna,
        chavePed,
        finalizado: dateOrEmpty(trabalhoServico.dataEntrega),
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
      }}
    />
  );
}

export default async function ImprimirOSPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) {
    return (
      <ErroImpressao
        titulo="Sessão expirada."
        detalhe="Faça login novamente para imprimir a OS."
      />
    );
  }

  const { id } = await params;
  const sp = await searchParams;
  const empresaId = session.empresaId?.trim();

  if (!empresaId) {
    return (
      <ErroImpressao
        titulo="Sessão incompleta."
        detalhe="Faça logout e login novamente para imprimir a OS."
      />
    );
  }

  try {
    return await ImprimirOSConteudo({
      id,
      sp,
      empresaId,
    });
  } catch (err) {
    console.error("imprimir OS", { id, empresaId, err });
    return (
      <ErroImpressao
        titulo="Erro ao abrir a impressão."
        detalhe={mensagemErroImpressao(err)}
      />
    );
  }
}
