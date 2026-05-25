import { formatDate, STATUS_TRABALHO } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  grupoOsIdOf,
  segmentoEfetivoTrabalho,
  type SegmentoFaturamento,
} from "@/lib/trabalho-os-segmento";
import { telefoneWhatsappCliente } from "@/lib/cliente-observacoes";
import { instrucoesTextoLivre, parseEtapasInstrucoes } from "@/lib/etapas-os";
import {
  extrairDataPrazoBr,
  extrairItensImpressaoOs,
  linhaPrazoImpressaoOs,
} from "@/lib/os-itens-impressao";
import { PdfOsViewer } from "./pdf-os-viewer";

type Trabalho = {
  id: string;
  numeroOs: number;
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
  const formatted = formatDate(value instanceof Date ? value.toISOString() : value);
  return formatted;
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
      <div className="mx-auto mt-10 max-w-xl rounded border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <p className="font-semibold">Sessão expirada.</p>
        <p className="mt-2 text-sm">Faça login novamente para imprimir a OS.</p>
      </div>
    );
  }

  const { id } = await params;
  const sp = await searchParams;
  const somenteItem = searchFlag(sp.somenteItem);
  const duasVias = sp.vias === "2" || searchFlag(sp.duasVias);
  const formato = String(Array.isArray(sp.formato) ? sp.formato[0] : sp.formato || "a4");
  const modeloRaw = String(Array.isArray(sp.modelo) ? sp.modelo[0] : sp.modelo || "");
  const modelo =
    formato === "termica"
      ? modeloRaw === "modelo3"
        ? "modelo3"
        : "modelo4"
      : modeloRaw === "modelo2" ||
          modeloRaw === "modelo3" ||
          modeloRaw === "comprovante"
        ? "modelo2"
        : "modelo1";
  const segmentoParam = String(Array.isArray(sp.segmento) ? sp.segmento[0] : sp.segmento || "");
  const t = (await prisma.trabalho.findFirst({
    where: { id },
    include: { cliente: true, paciente: true },
  })) as Trabalho | null;

  if (!t) {
    return (
      <div className="mx-auto mt-10 max-w-xl rounded border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <p className="font-semibold">OS não encontrada ou removida.</p>
        <p className="mt-2 text-sm">Volte para o Controle de Produção e abra uma OS existente.</p>
      </div>
    );
  }

  const grupo = await prisma.trabalho.findMany({
    where: {
      grupoOsId: grupoOsIdOf(t),
    },
    orderBy: { segmentoFaturamento: "asc" },
  });

  const instrucoesGrupo = somenteItem
    ? [t.instrucoes]
    : grupo.length > 0
      ? grupo.map((row) => row.instrucoes)
      : [t.instrucoes];
  const valorGrupo = somenteItem
    ? t.valor
    : grupo.length > 0
      ? grupo.reduce((sum, row) => sum + row.valor, 0)
      : t.valor;
  const trabalhoServico = grupo.find((row) => (row.segmentoFaturamento || "servico") === "servico") || t;

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
  const etapasOs = parseEtapasInstrucoes(textoInstrucoesGrupo);
  const etapaCorrente =
    etapasOs.filter((etapa) => etapa.nome.trim()).at(-1) ?? etapasOs.at(-1);
  const statusServico = trabalhoServico.status;
  const ctxPrazos = {
    status: statusServico,
    statusLabel: STATUS_TRABALHO[statusServico]?.label || statusServico,
    etapaAtual: etapaCorrente?.nome.trim() || undefined,
    etapaPrazo: extrairDataPrazoBr(etapaCorrente?.prazo),
    dataPrevista: dateOrEmpty(trabalhoServico.dataPrevista),
    dataEntrega: dateOrEmpty(trabalhoServico.dataEntrega),
    dataEntrada: dateOrEmpty(trabalhoServico.dataEntrada),
    prazoLaboratorio,
    prazoDentista,
    textoInstrucoes: textoInstrucoesGrupo,
  };
  const prazoLinhaServico =
    segmentoSomenteItem && segmentoSomenteItem !== "servico"
      ? ""
      : linhaPrazoImpressaoOs(ctxPrazos) || "";
  const itens = extrairItensImpressaoOs(
    instrucoesGrupo,
    {
      tipoProtese: t.tipoProtese,
      dentes: t.dentes,
      cor: t.cor,
      valor: t.valor,
    },
    ctxPrazos,
    segmentoSomenteItem
  ).map((item) =>
    item.tipo === "servico" && prazoLinhaServico
      ? { ...item, notasAbaixo: [prazoLinhaServico] }
      : item
  );
  const materiais = lineValue(linhas, "Material enviado:") || empty(t.material);
  const caixa = lineValue(linhas, "Caixa:");
  const dentistaNome =
    lineValue(linhas, "Dentista:") || lineValue(linhas, "Dentista convidado:");
  const observacoesUsuario = somenteItem
    ? [empty(t.observacoes), instrucoesTextoLivre(t.instrucoes)].filter(Boolean).join("\n")
    : [empty(trabalhoServico.observacoes), instrucoesTextoLivre(trabalhoServico.instrucoes)]
        .filter(Boolean)
        .join("\n");
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

  return (
    <PdfOsViewer
      formato={formato}
      modelo={modelo}
      duasVias={duasVias}
      data={{
        numeroOs: t.numeroOs,
        dataEntrada: dateOrEmpty(t.dataEntrada),
        status: STATUS_TRABALHO[t.status]?.label || "",
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
        itens,
      }}
    />
  );
}
