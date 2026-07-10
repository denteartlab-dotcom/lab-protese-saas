export type ChatbotConfigDados = {
  ativo: boolean;
  intro: string;
  rodapeMenu: string;
  opcao1Ativa: boolean;
  opcao1Texto: string;
  opcao2Ativa: boolean;
  opcao2Texto: string;
  opcao3Ativa: boolean;
  opcao3Texto: string;
  opcao4Ativa: boolean;
  opcao4Texto: string;
  msgAtendente: string;
  msgAguardandoOs: string;
  msgNaoEntendi: string;
};

export const CHATBOT_CONFIG_PADRAO: ChatbotConfigDados = {
  ativo: true,
  intro: "Olá! Sou o assistente do {laboratorio}.",
  rodapeMenu: "A qualquer momento digite *menu* para voltar.",
  opcao1Ativa: true,
  opcao1Texto: "Ver minhas OS em andamento",
  opcao2Ativa: true,
  opcao2Texto: "Consultar uma OS (informe o número)",
  opcao3Ativa: true,
  opcao3Texto: "Link de acompanhamento online",
  opcao4Ativa: true,
  opcao4Texto: "Falar com atendente",
  msgAtendente:
    "Certo! Um atendente do laboratório vai responder em breve.\n\nEnquanto isso, digite *menu* para voltar ao assistente automático.",
  msgAguardandoOs: "Qual o número da OS? (ex.: 1234)",
  msgNaoEntendi: "Não entendi.",
};

export function substituirLaboratorioNoTexto(texto: string, nomeLab: string) {
  const lab = nomeLab?.trim() || "laboratório";
  return texto.replace(/\{laboratorio\}/gi, lab);
}

export function montarTextoMenuChat(config: ChatbotConfigDados, nomeLab?: string) {
  const intro = substituirLaboratorioNoTexto(config.intro, nomeLab || "laboratório");
  const opcoes: string[] = [];
  if (config.opcao1Ativa) opcoes.push(`*1* — ${config.opcao1Texto}`);
  if (config.opcao2Ativa) opcoes.push(`*2* — ${config.opcao2Texto}`);
  if (config.opcao3Ativa) opcoes.push(`*3* — ${config.opcao3Texto}`);
  if (config.opcao4Ativa) opcoes.push(`*4* — ${config.opcao4Texto}`);

  if (opcoes.length === 0) {
    return `${intro}\n\n${config.rodapeMenu}`;
  }

  return (
    `${intro}\n\n` +
    `Digite o número da opção:\n` +
    `${opcoes.join("\n")}\n\n` +
    config.rodapeMenu
  );
}
