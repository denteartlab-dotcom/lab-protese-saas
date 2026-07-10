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
import {
  CHATBOT_CONFIG_PADRAO,
  montarTextoMenuChat,
  type ChatbotConfigDados,
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

function extrairNumeroOs(texto: string) {
  const match = texto.match(/\b(\d{1,6})\b/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function nomeLaboratorio(empresaId: string) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { nome: true },
  });
  return empresa?.nome?.trim() || "Laboratório";
}

async function listarOsEmAndamento(
  empresaId: string,
  clientes: ClienteChatResumo[]
) {
  if (clientes.length === 0) {
    return (
      "Não encontramos seu cadastro com este WhatsApp.\n\n" +
      "Peça ao laboratório para conferir o número no cadastro do cliente ou digite *4* para falar com atendente."
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
    return "Cadastro não encontrado para este WhatsApp. Digite *4* para atendimento.";
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
    return "Não encontramos seu cadastro. Digite *4* para falar com o laboratório.";
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
  proximaEtapa: EtapaChatWhatsapp;
  atendimentoHumano: boolean;
  clienteId: string | null;
};

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
    return {
      respostas: [],
      proximaEtapa: "atendente",
      atendimentoHumano: true,
      clienteId,
    };
  }

  if (pedeMenu(texto)) {
    const nomeLab = await nomeLaboratorio(empresaId);
    return {
      respostas: [textoMenuChat(nomeLab, config)],
      proximaEtapa: "menu",
      atendimentoHumano: false,
      clienteId,
    };
  }

  if (conversa.etapa === "aguardando_os") {
    const numero = extrairNumeroOs(texto);
    if (!numero) {
      return {
        respostas: ["Informe o número da OS (ex.: 1234) ou digite *menu*."],
        proximaEtapa: "aguardando_os",
        atendimentoHumano: false,
        clienteId,
      };
    }
    const detalhe = await detalharOs(empresaId, clientes, numero);
    return {
      respostas: [detalhe],
      proximaEtapa: "menu",
      atendimentoHumano: false,
      clienteId,
    };
  }

  const opcao = normalizarEntrada(texto).replace(/\s/g, "");

  if (opcao === "1" && config.opcao1Ativa) {
    const lista = await listarOsEmAndamento(empresaId, clientes);
    return {
      respostas: [lista],
      proximaEtapa: "menu",
      atendimentoHumano: false,
      clienteId,
    };
  }

  if (opcao === "2" && config.opcao2Ativa) {
    const numeroDireto = extrairNumeroOs(texto);
    if (numeroDireto) {
      const detalhe = await detalharOs(empresaId, clientes, numeroDireto);
      return {
        respostas: [detalhe],
        proximaEtapa: "menu",
        atendimentoHumano: false,
        clienteId,
      };
    }
    return {
      respostas: [config.msgAguardandoOs],
      proximaEtapa: "aguardando_os",
      atendimentoHumano: false,
      clienteId,
    };
  }

  if (opcao === "3" && config.opcao3Ativa) {
    const msg = await linkAcompanhamento(clientes);
    return {
      respostas: [msg],
      proximaEtapa: "menu",
      atendimentoHumano: false,
      clienteId,
    };
  }

  if (opcao === "4" && config.opcao4Ativa) {
    return {
      respostas: [config.msgAtendente],
      proximaEtapa: "atendente",
      atendimentoHumano: true,
      clienteId,
    };
  }

  const numeroDireto = extrairNumeroOs(texto);
  if (numeroDireto) {
    const detalhe = await detalharOs(empresaId, clientes, numeroDireto);
    return {
      respostas: [detalhe],
      proximaEtapa: "menu",
      atendimentoHumano: false,
      clienteId,
    };
  }

  const nomeLab = await nomeLaboratorio(empresaId);
  return {
    respostas: [
      `${config.msgNaoEntendi} ${textoMenuChat(nomeLab, config)}`,
    ],
    proximaEtapa: "menu",
    atendimentoHumano: false,
    clienteId,
  };
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
