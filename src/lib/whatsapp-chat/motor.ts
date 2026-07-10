import { garantirTokenAcompanhamentoCliente } from "@/lib/cliente-acompanhamento";
import { prisma } from "@/lib/db";
import { runWithTenantContext } from "@/lib/prisma-tenant";
import { labelStatusOs } from "@/lib/status-os";
import { formatDate } from "@/lib/utils";
import {
  clienteAcompanhamentoPublicUrl,
  mensagemAcompanhamentoCliente,
} from "@/lib/whatsapp";
import {
  buscarClientesPorTelefoneChat,
  type ClienteChatResumo,
} from "@/lib/whatsapp-chat/buscar-cliente";
import { carregarAnexoChatbot } from "@/lib/whatsapp-chat/chatbot-anexo";
import {
  CHATBOT_CONFIG_PADRAO,
  montarTextoMenuChat,
  opcaoPorNumeroMenu,
  type ChatbotConfigDados,
  type ChatbotOpcaoMenu,
  type RespostaChatMidia,
} from "@/lib/whatsapp-chat/chatbot-config-types";
import { obterChatbotConfig } from "@/lib/whatsapp-chat/chatbot-config-servidor";
import {
  atualizarConversaChat,
  type ConversaChatWhatsapp,
  type EtapaChatWhatsapp,
} from "@/lib/whatsapp-chat/conversa-store";

const STATUS_EM_ANDAMENTO = new Set([
  "pendente",
  "pedido",
  "producao",
  "prova",
  "saiu_entrega",
]);

export function textoMenuChat(nomeLab?: string, config?: ChatbotConfigDados) {
  return montarTextoMenuChat(config || CHATBOT_CONFIG_PADRAO, nomeLab);
}

function normalizarEntrada(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function pedeMenu(texto: string) {
  const t = normalizarEntrada(texto);
  return (
    t === "menu" ||
    t === "0" ||
    t === "oi" ||
    t === "ola" ||
    t === "olá" ||
    t === "bom dia" ||
    t === "boa tarde" ||
    t === "boa noite" ||
    t === "ajuda" ||
    t === "inicio" ||
    t === "início"
  );
}

function ehSim(texto: string) {
  const t = normalizarEntrada(texto);
  return t === "sim" || t === "s" || t === "1" || t === "yes";
}

function ehNao(texto: string) {
  const t = normalizarEntrada(texto);
  return t === "nao" || t === "não" || t === "n" || t === "2" || t === "no";
}

function extrairNumeroOs(texto: string) {
  const match = texto.match(/\b(\d{1,6})\b/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function etapaAguardandoSimNao(etapa: string) {
  const match = etapa.match(/^aguardando_sim_nao:(.+)$/);
  return match?.[1] || null;
}

function etapaAguardandoSimNaoId(opcaoId: string): EtapaChatWhatsapp {
  return `aguardando_sim_nao:${opcaoId}`;
}

async function nomeLaboratorio(empresaId: string) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { nome: true },
  });
  return empresa?.nome?.trim() || "Laboratório";
}

async function listarOsEmAndamento(empresaId: string, clientes: ClienteChatResumo[]) {
  if (clientes.length === 0) {
    return (
      "Não encontramos seu cadastro com este WhatsApp.\n\n" +
      "Peça ao laboratório para conferir o número no cadastro do cliente ou digite *menu*."
    );
  }

  const ids = clientes.map((c) => c.id);
  const trabalhos = await runWithTenantContext(empresaId, () =>
    prisma.trabalho.findMany({
      where: { empresaId, clienteId: { in: ids } },
      orderBy: [{ numeroOs: "desc" }, { updatedAt: "desc" }],
      take: 30,
      select: {
        numeroOs: true,
        tipoProtese: true,
        status: true,
        dataPrevista: true,
        paciente: { select: { nome: true } },
      },
    })
  );

  const mapaOs = new Map<
    number,
    {
      numeroOs: number;
      tipoProtese: string;
      status: string;
      dataPrevista: Date | null;
      paciente: string;
    }
  >();

  for (const t of trabalhos) {
    const chave = t.numeroOs;
    const statusKey = (t.status || "").toLowerCase();
    if (!STATUS_EM_ANDAMENTO.has(statusKey)) continue;
    if (!mapaOs.has(chave)) {
      mapaOs.set(chave, {
        numeroOs: t.numeroOs,
        tipoProtese: t.tipoProtese,
        status: t.status,
        dataPrevista: t.dataPrevista,
        paciente: t.paciente?.nome || "",
      });
    }
  }

  const lista = [...mapaOs.values()].slice(0, 8);
  if (lista.length === 0) {
    return "Não há OS em andamento vinculadas a este WhatsApp no momento.";
  }

  const linhas = lista.map((os) => {
    const prev = os.dataPrevista ? formatDate(os.dataPrevista) : "—";
    const pac = os.paciente ? ` — ${os.paciente}` : "";
    return `• OS *${os.numeroOs}*${pac}\n  ${os.tipoProtese}\n  Situação: ${labelStatusOs(os.status)}\n  Previsão: ${prev}`;
  });

  return `*OS em andamento:*\n\n${linhas.join("\n\n")}\n\nDigite o número da OS para mais detalhes ou *menu*.`;
}

async function detalharOs(
  empresaId: string,
  clientes: ClienteChatResumo[],
  numeroOs: number
) {
  if (clientes.length === 0) {
    return "Cadastro não encontrado para este WhatsApp. Digite *menu*.";
  }

  const ids = clientes.map((c) => c.id);
  const linhas = await runWithTenantContext(empresaId, () =>
    prisma.trabalho.findMany({
      where: { empresaId, clienteId: { in: ids }, numeroOs },
      orderBy: { updatedAt: "desc" },
      select: {
        tipoProtese: true,
        status: true,
        dataPrevista: true,
        dataEntrega: true,
        paciente: { select: { nome: true } },
      },
    })
  );

  if (linhas.length === 0) {
    return `Não encontramos a OS *${numeroOs}* para este WhatsApp.\n\nConfira o número ou digite *menu*.`;
  }

  const blocos = linhas.map((t) => {
    const prev = t.dataPrevista ? formatDate(t.dataPrevista) : "—";
    const ent = t.dataEntrega ? formatDate(t.dataEntrega) : "—";
    const pac = t.paciente?.nome ? `\nPaciente: ${t.paciente.nome}` : "";
    return (
      `*OS ${numeroOs}* — ${t.tipoProtese}${pac}\n` +
      `Situação: ${labelStatusOs(t.status)}\n` +
      `Previsão: ${prev}\n` +
      `Entrega: ${ent}`
    );
  });

  return `${blocos.join("\n\n")}\n\nDigite *menu* para outras opções.`;
}

async function linkAcompanhamento(clientes: ClienteChatResumo[]) {
  if (clientes.length === 0) {
    return "Não encontramos seu cadastro. Digite *menu* para falar com o laboratório.";
  }

  const principal = clientes[0];
  const token = await garantirTokenAcompanhamentoCliente(
    principal.id,
    principal.tokenAcompanhamento
  );
  const url = clienteAcompanhamentoPublicUrl(token);
  return mensagemAcompanhamentoCliente(principal.nome, url);
}

export type ResultadoMotorChat = {
  respostas: string[];
  midias: RespostaChatMidia[];
  proximaEtapa: EtapaChatWhatsapp;
  atendimentoHumano: boolean;
  clienteId: string | null;
};

function resultadoVazio(parcial: Partial<ResultadoMotorChat> = {}): ResultadoMotorChat {
  return {
    respostas: [],
    midias: [],
    proximaEtapa: "menu",
    atendimentoHumano: false,
    clienteId: null,
    ...parcial,
  };
}

async function montarRespostaSimNao(
  empresaId: string,
  opcao: ChatbotOpcaoMenu,
  positivo: boolean
): Promise<Pick<ResultadoMotorChat, "respostas" | "midias">> {
  const texto = positivo ? opcao.respostaSimTexto?.trim() : opcao.respostaNaoTexto?.trim();
  const anexoCfg = positivo ? opcao.respostaSimAnexo : opcao.respostaNaoAnexo;
  const anexo = await carregarAnexoChatbot(anexoCfg?.uploadId, empresaId);

  if (anexo) {
    return {
      respostas: [],
      midias: [{ ...anexo, texto: texto || undefined }],
    };
  }

  if (texto) {
    return { respostas: [texto], midias: [] };
  }

  return {
    respostas: [positivo ? "Certo!" : "Tudo bem!"],
    midias: [],
  };
}

async function executarAcaoSistema(
  empresaId: string,
  config: ChatbotConfigDados,
  clientes: ClienteChatResumo[],
  clienteId: string | null,
  acao: ChatbotOpcaoMenu["acao"],
  textoEntrada: string
): Promise<ResultadoMotorChat> {
  if (acao === "listar_os") {
    const lista = await listarOsEmAndamento(empresaId, clientes);
    return resultadoVazio({ respostas: [lista], clienteId });
  }

  if (acao === "consultar_os") {
    const numeroDireto = extrairNumeroOs(textoEntrada);
    if (numeroDireto) {
      const detalhe = await detalharOs(empresaId, clientes, numeroDireto);
      return resultadoVazio({ respostas: [detalhe], clienteId });
    }
    return resultadoVazio({
      respostas: [config.msgAguardandoOs],
      proximaEtapa: "aguardando_os",
      clienteId,
    });
  }

  if (acao === "link_acompanhamento") {
    const msg = await linkAcompanhamento(clientes);
    return resultadoVazio({ respostas: [msg], clienteId });
  }

  if (acao === "atendente") {
    return resultadoVazio({
      respostas: [config.msgAtendente],
      proximaEtapa: "atendente",
      atendimentoHumano: true,
      clienteId,
    });
  }

  return resultadoVazio({ clienteId });
}

async function executarOpcaoMenu(
  empresaId: string,
  config: ChatbotConfigDados,
  clientes: ClienteChatResumo[],
  clienteId: string | null,
  opcao: ChatbotOpcaoMenu,
  textoEntrada: string
): Promise<ResultadoMotorChat> {
  if (opcao.tipo === "sistema") {
    return executarAcaoSistema(empresaId, config, clientes, clienteId, opcao.acao, textoEntrada);
  }

  if (opcao.tipo === "mensagem") {
    const msg = opcao.mensagem?.trim() || "Opção indisponível no momento.";
    return resultadoVazio({ respostas: [msg], clienteId });
  }

  if (opcao.tipo === "sim_nao") {
    const pergunta =
      opcao.pergunta?.trim() ||
      "Responda *sim* ou *não*:";
    return resultadoVazio({
      respostas: [`${pergunta}\n\nResponda *sim* ou *não*.`],
      proximaEtapa: etapaAguardandoSimNaoId(opcao.id),
      clienteId,
    });
  }

  return resultadoVazio({ clienteId });
}

export async function processarTextoChatbot(
  empresaId: string,
  conversa: ConversaChatWhatsapp,
  textoEntrada: string
): Promise<ResultadoMotorChat> {
  const texto = textoEntrada.trim();
  const config = await obterChatbotConfig(empresaId);
  const clientes = await buscarClientesPorTelefoneChat(empresaId, conversa.telefone);
  const clienteId = clientes[0]?.id ?? conversa.clienteId ?? null;

  if (conversa.atendimentoHumano && !pedeMenu(texto)) {
    return resultadoVazio({
      proximaEtapa: "atendente",
      atendimentoHumano: true,
      clienteId,
    });
  }

  if (pedeMenu(texto)) {
    const nomeLab = await nomeLaboratorio(empresaId);
    return resultadoVazio({
      respostas: [textoMenuChat(nomeLab, config)],
      clienteId,
    });
  }

  const opcaoSimNaoId = etapaAguardandoSimNao(conversa.etapa);
  if (opcaoSimNaoId) {
    const opcao = config.opcoes.find((item) => item.id === opcaoSimNaoId);
    if (!opcao || opcao.tipo !== "sim_nao") {
      const nomeLab = await nomeLaboratorio(empresaId);
      return resultadoVazio({
        respostas: [textoMenuChat(nomeLab, config)],
        clienteId,
      });
    }

    if (ehSim(texto)) {
      const parcial = await montarRespostaSimNao(empresaId, opcao, true);
      return resultadoVazio({ ...parcial, clienteId });
    }

    if (ehNao(texto)) {
      const parcial = await montarRespostaSimNao(empresaId, opcao, false);
      return resultadoVazio({ ...parcial, clienteId });
    }

    return resultadoVazio({
      respostas: ["Responda *sim* ou *não*, ou digite *menu* para voltar."],
      proximaEtapa: conversa.etapa,
      clienteId,
    });
  }

  if (conversa.etapa === "aguardando_os") {
    const numero = extrairNumeroOs(texto);
    if (!numero) {
      return resultadoVazio({
        respostas: ["Informe o número da OS (ex.: 1234) ou digite *menu*."],
        proximaEtapa: "aguardando_os",
        clienteId,
      });
    }
    const detalhe = await detalharOs(empresaId, clientes, numero);
    return resultadoVazio({ respostas: [detalhe], clienteId });
  }

  const numeroOpcao = Number(normalizarEntrada(texto).replace(/\s/g, ""));
  if (Number.isFinite(numeroOpcao) && numeroOpcao > 0) {
    const opcao = opcaoPorNumeroMenu(config, numeroOpcao);
    if (opcao) {
      return executarOpcaoMenu(empresaId, config, clientes, clienteId, opcao, texto);
    }
  }

  const numeroDireto = extrairNumeroOs(texto);
  if (numeroDireto) {
    const detalhe = await detalharOs(empresaId, clientes, numeroDireto);
    return resultadoVazio({ respostas: [detalhe], clienteId });
  }

  const nomeLab = await nomeLaboratorio(empresaId);
  return resultadoVazio({
    respostas: [`${config.msgNaoEntendi} ${textoMenuChat(nomeLab, config)}`],
    clienteId,
  });
}

export async function aplicarEstadoConversaAposResposta(
  conversa: ConversaChatWhatsapp,
  resultado: ResultadoMotorChat
) {
  await atualizarConversaChat(conversa.id, conversa.empresaId, {
    etapa: resultado.proximaEtapa,
    atendimentoHumano: resultado.atendimentoHumano,
    clienteId: resultado.clienteId,
  });
}
