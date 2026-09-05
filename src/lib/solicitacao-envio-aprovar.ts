import { prisma } from "@/lib/db";
import { anexosParaLinhasInstrucoes } from "@/lib/cabecalho-os-form";
import { linhaPrioridadeOs, type PrioridadeOsForm } from "@/lib/prioridade-os";
import { proximoNumeroOsDisponivel, registrarNumeroOsUtilizado } from "@/lib/os-sequencia";
import {
  parseJsonArraySeguro,
  rotuloTipoTransporte,
  type AnexoSolicitacaoEnvio,
  type ObservacaoEnvioLinha,
} from "@/lib/solicitacao-envio-types";
import { obterSolicitacaoEnvioPorId } from "@/lib/solicitacao-envio-servidor";

function prioridadeForm(valor: string): PrioridadeOsForm {
  if (valor === "alta" || valor === "baixa") return valor;
  return "media";
}

function montarInstrucoesSolicitacao(params: {
  tipoProtese: string;
  dentes: string;
  cor: string;
  materialEnviado: string;
  caixa: string;
  dentista: string;
  prioridade: string;
  casoClinico: string;
  urgente: boolean;
  repeticao: boolean;
  observacaoServico: string;
  tipoTransporte: string;
  observacoesEnvio: ObservacaoEnvioLinha[];
  anexos: AnexoSolicitacaoEnvio[];
}) {
  const linhasItem = [
    `Item adicionado: ${params.tipoProtese}`,
    `dentes ${params.dentes || "-"}`,
    `cor ${params.cor || "-"}`,
    `qtd 1`,
    `valor 0,00`,
    `situação pedido`,
  ].join(" - ");

  const linhasObsEnvio = params.observacoesEnvio
    .map((l) => l.texto.trim())
    .filter(Boolean)
    .map((texto, i) => `Obs. envio ${i + 1}: ${texto}`);

  const anexos = anexosParaLinhasInstrucoes(
    params.anexos.map((a) => ({ name: a.nome, type: a.mimeType, url: a.url }))
  );

  return [
    linhasItem,
    params.observacaoServico ? `Obs. serviço: ${params.observacaoServico}` : "",
    params.materialEnviado ? `Material enviado: ${params.materialEnviado}` : "",
    params.caixa ? `Caixa: ${params.caixa}` : "",
    params.dentista ? `Dentista: ${params.dentista}` : "",
    linhaPrioridadeOs(prioridadeForm(params.prioridade)),
    params.casoClinico ? `Caso odontológico: ${params.casoClinico}` : "",
    params.urgente ? "Urgente: sim" : "",
    params.repeticao ? "Repetição: sim" : "",
    `Transporte: ${rotuloTipoTransporte(params.tipoTransporte)}`,
    ...linhasObsEnvio,
    anexos,
  ]
    .filter(Boolean)
    .join("\n");
}

async function garantirPacienteCliente(params: {
  clienteId: string;
  pacienteNome: string;
}) {
  const nome = params.pacienteNome.trim();
  const existente = await prisma.paciente.findFirst({
    where: {
      clienteId: params.clienteId,
      nome: { equals: nome, mode: "insensitive" },
    },
  });
  if (existente) return existente;
  return prisma.paciente.create({
    data: {
      clienteId: params.clienteId,
      nome,
    },
  });
}

export async function aprovarSolicitacaoEnvioCliente(params: {
  empresaId: string;
  solicitacaoId: string;
  userId?: string | null;
}) {
  const solicitacao = await obterSolicitacaoEnvioPorId(
    params.empresaId,
    params.solicitacaoId
  );
  if (!solicitacao) {
    return { ok: false as const, code: "nao_encontrada", message: "Solicitação não encontrada." };
  }
  if (solicitacao.status !== "pendente") {
    return {
      ok: false as const,
      code: "status_invalido",
      message: "Somente solicitações pendentes podem ser aprovadas.",
    };
  }

  const anexos = parseJsonArraySeguro<AnexoSolicitacaoEnvio>(solicitacao.anexosJson);
  const observacoesEnvio = parseJsonArraySeguro<ObservacaoEnvioLinha>(
    solicitacao.observacoesEnvioJson
  );

  const paciente = await garantirPacienteCliente({
    clienteId: solicitacao.clienteId,
    pacienteNome: solicitacao.pacienteNome,
  });

  const numeroOs = await proximoNumeroOsDisponivel(params.empresaId);
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);

  const instrucoes = montarInstrucoesSolicitacao({
    tipoProtese: solicitacao.tipoProtese,
    dentes: solicitacao.dentes,
    cor: solicitacao.cor,
    materialEnviado: solicitacao.materialEnviado,
    caixa: solicitacao.caixa,
    dentista: solicitacao.dentista,
    prioridade: solicitacao.prioridade,
    casoClinico: solicitacao.casoClinico,
    urgente: solicitacao.urgente,
    repeticao: solicitacao.repeticao,
    observacaoServico: solicitacao.observacaoServico,
    tipoTransporte: solicitacao.tipoTransporte,
    observacoesEnvio,
    anexos,
  });

  const observacoes = [
    solicitacao.observacaoInterna.trim()
      ? `Obs. interna (cliente): ${solicitacao.observacaoInterna.trim()}`
      : "",
    `Solicitação de envio #${solicitacao.id.slice(-6)} aprovada pelo laboratório.`,
  ]
    .filter(Boolean)
    .join("\n");

  const trabalho = await prisma.trabalho.create({
    data: {
      empresaId: params.empresaId,
      numeroOs,
      segmentoFaturamento: "servico",
      clienteId: solicitacao.clienteId,
      pacienteId: paciente.id,
      tipoProtese: solicitacao.tipoProtese.trim(),
      dentes: solicitacao.dentes || null,
      cor: solicitacao.cor || null,
      material: solicitacao.materialEnviado || null,
      escala: solicitacao.escala || null,
      dataEntrada: hoje,
      dataPrevista: solicitacao.dataDesejada,
      valor: solicitacao.valorEstimado || 0,
      status: "pedido",
      observacoes: observacoes || null,
      instrucoes: instrucoes || null,
    },
  });

  await prisma.trabalho.update({
    where: { id: trabalho.id },
    data: { grupoOsId: trabalho.id },
  });

  await registrarNumeroOsUtilizado(params.empresaId, numeroOs);

  const atualizada = await prisma.solicitacaoEnvioCliente.update({
    where: { id: solicitacao.id },
    data: {
      status: "aprovada",
      trabalhoId: trabalho.id,
      respondidoEm: new Date(),
      respondidoPorUserId: params.userId || null,
      motivoRecusa: null,
    },
    include: { cliente: { select: { id: true, nome: true } } },
  });

  return {
    ok: true as const,
    solicitacao: atualizada,
    trabalho: {
      id: trabalho.id,
      numeroOs: trabalho.numeroOs,
    },
  };
}

export async function recusarSolicitacaoEnvioCliente(params: {
  empresaId: string;
  solicitacaoId: string;
  userId?: string | null;
  motivo?: string;
}) {
  const solicitacao = await obterSolicitacaoEnvioPorId(
    params.empresaId,
    params.solicitacaoId
  );
  if (!solicitacao) {
    return { ok: false as const, code: "nao_encontrada", message: "Solicitação não encontrada." };
  }
  if (solicitacao.status !== "pendente") {
    return {
      ok: false as const,
      code: "status_invalido",
      message: "Somente solicitações pendentes podem ser recusadas.",
    };
  }

  const atualizada = await prisma.solicitacaoEnvioCliente.update({
    where: { id: solicitacao.id },
    data: {
      status: "recusada",
      respondidoEm: new Date(),
      respondidoPorUserId: params.userId || null,
      motivoRecusa: (params.motivo || "").trim().slice(0, 500) || null,
    },
    include: { cliente: { select: { id: true, nome: true } } },
  });

  return { ok: true as const, solicitacao: atualizada };
}
