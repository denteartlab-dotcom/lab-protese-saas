export type ChatbotAnexoConfig = {
  uploadId: string | null;
  nome: string;
  mimeType: string;
  tipo: "imagem" | "pdf" | "documento";
  url?: string;
};

export type ChatbotAcaoSistema =
  | "listar_os"
  | "consultar_os"
  | "link_acompanhamento"
  | "atendente";

export type ChatbotTipoOpcao = "sistema" | "mensagem" | "sim_nao";

export type ChatbotOpcaoMenu = {
  id: string;
  ativa: boolean;
  texto: string;
  tipo: ChatbotTipoOpcao;
  acao?: ChatbotAcaoSistema;
  mensagem?: string;
  pergunta?: string;
  respostaSimTexto?: string;
  respostaNaoTexto?: string;
  respostaSimAnexo?: ChatbotAnexoConfig | null;
  respostaNaoAnexo?: ChatbotAnexoConfig | null;
};

export type ChatbotConfigDados = {
  ativo: boolean;
  intro: string;
  rodapeMenu: string;
  opcoes: ChatbotOpcaoMenu[];
  msgAtendente: string;
  msgAguardandoOs: string;
  msgNaoEntendi: string;
};

export type RespostaChatMidia = {
  texto?: string;
  uploadId: string;
  mimeType: string;
  fileName: string;
  tipo: "imagem" | "pdf" | "documento";
};

export function criarIdOpcaoChatbot() {
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function opcoesPadraoMenu(): ChatbotOpcaoMenu[] {
  return [
    {
      id: "padrao-1",
      ativa: true,
      texto: "Ver minhas OS em andamento",
      tipo: "sistema",
      acao: "listar_os",
    },
    {
      id: "padrao-2",
      ativa: true,
      texto: "Consultar uma OS (informe o número)",
      tipo: "sistema",
      acao: "consultar_os",
    },
    {
      id: "padrao-3",
      ativa: true,
      texto: "Link de acompanhamento online",
      tipo: "sistema",
      acao: "link_acompanhamento",
    },
    {
      id: "padrao-4",
      ativa: true,
      texto: "Falar com atendente",
      tipo: "sistema",
      acao: "atendente",
    },
  ];
}

export const CHATBOT_CONFIG_PADRAO: ChatbotConfigDados = {
  ativo: true,
  intro: "Olá! Sou o assistente do {laboratorio}.",
  rodapeMenu: "A qualquer momento digite *menu* para voltar.",
  opcoes: opcoesPadraoMenu(),
  msgAtendente:
    "Certo! Um atendente do laboratório vai responder em breve.\n\nEnquanto isso, digite *menu* para voltar ao assistente automático.",
  msgAguardandoOs: "Qual o número da OS? (ex.: 1234)",
  msgNaoEntendi: "Não entendi.",
};

export const CHATBOT_MAX_OPCOES = 12;

export function substituirLaboratorioNoTexto(texto: string, nomeLab: string) {
  const lab = nomeLab?.trim() || "laboratório";
  return texto.replace(/\{laboratorio\}/gi, lab);
}

export function opcoesAtivasMenu(config: ChatbotConfigDados) {
  return config.opcoes.filter((op) => op.ativa && op.texto.trim());
}

export function montarTextoMenuChat(config: ChatbotConfigDados, nomeLab?: string) {
  const intro = substituirLaboratorioNoTexto(config.intro, nomeLab || "laboratório");
  const ativas = opcoesAtivasMenu(config);
  const linhas = ativas.map((op, idx) => `*${idx + 1}* — ${op.texto.trim()}`);

  if (linhas.length === 0) {
    return `${intro}\n\n${config.rodapeMenu}`;
  }

  return (
    `${intro}\n\n` +
    `Digite o número da opção:\n` +
    `${linhas.join("\n")}\n\n` +
    config.rodapeMenu
  );
}

export function opcaoPorNumeroMenu(config: ChatbotConfigDados, numero: number) {
  const ativas = opcoesAtivasMenu(config);
  return ativas[numero - 1] || null;
}

export function normalizarAnexoChatbot(
  anexo?: ChatbotAnexoConfig | null
): ChatbotAnexoConfig | null {
  if (!anexo?.uploadId?.trim()) return null;
  return {
    uploadId: anexo.uploadId.trim(),
    nome: anexo.nome?.trim() || "arquivo",
    mimeType: anexo.mimeType?.trim() || "application/octet-stream",
    tipo: anexo.tipo === "imagem" || anexo.tipo === "pdf" ? anexo.tipo : "documento",
    url: anexo.url,
  };
}

export function migrarConfigLegada(row: {
  opcao1Ativa?: boolean;
  opcao1Texto?: string;
  opcao2Ativa?: boolean;
  opcao2Texto?: string;
  opcao3Ativa?: boolean;
  opcao3Texto?: string;
  opcao4Ativa?: boolean;
  opcao4Texto?: string;
}): ChatbotOpcaoMenu[] {
  const opcoes: ChatbotOpcaoMenu[] = [];
  const mapa: Array<{ ativa?: boolean; texto?: string; acao: ChatbotAcaoSistema; id: string }> = [
    { id: "leg-1", ativa: row.opcao1Ativa, texto: row.opcao1Texto, acao: "listar_os" },
    { id: "leg-2", ativa: row.opcao2Ativa, texto: row.opcao2Texto, acao: "consultar_os" },
    { id: "leg-3", ativa: row.opcao3Ativa, texto: row.opcao3Texto, acao: "link_acompanhamento" },
    { id: "leg-4", ativa: row.opcao4Ativa, texto: row.opcao4Texto, acao: "atendente" },
  ];
  for (const item of mapa) {
    if (!item.ativa) continue;
    opcoes.push({
      id: item.id,
      ativa: true,
      texto: item.texto?.trim() || "",
      tipo: "sistema",
      acao: item.acao,
    });
  }
  return opcoes.length ? opcoes : opcoesPadraoMenu();
}

export function sanitizarOpcoesChatbot(opcoes: ChatbotOpcaoMenu[]): ChatbotOpcaoMenu[] {
  const lista = (opcoes || []).slice(0, CHATBOT_MAX_OPCOES).map((op) => ({
    id: op.id?.trim() || criarIdOpcaoChatbot(),
    ativa: Boolean(op.ativa),
    texto: String(op.texto || "").trim().slice(0, 120),
    tipo: (["sistema", "mensagem", "sim_nao"].includes(op.tipo) ? op.tipo : "mensagem") as ChatbotTipoOpcao,
    acao:
      op.tipo === "sistema" && op.acao
        ? op.acao
        : undefined,
    mensagem: op.tipo === "mensagem" ? String(op.mensagem || "").trim().slice(0, 2000) : undefined,
    pergunta: op.tipo === "sim_nao" ? String(op.pergunta || "").trim().slice(0, 500) : undefined,
    respostaSimTexto:
      op.tipo === "sim_nao" ? String(op.respostaSimTexto || "").trim().slice(0, 2000) : undefined,
    respostaNaoTexto:
      op.tipo === "sim_nao" ? String(op.respostaNaoTexto || "").trim().slice(0, 2000) : undefined,
    respostaSimAnexo: op.tipo === "sim_nao" ? normalizarAnexoChatbot(op.respostaSimAnexo) : null,
    respostaNaoAnexo: op.tipo === "sim_nao" ? normalizarAnexoChatbot(op.respostaNaoAnexo) : null,
  }));

  return lista.length ? lista : opcoesPadraoMenu();
}
