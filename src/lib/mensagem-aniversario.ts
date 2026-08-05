import {
  abreviacaoCliente,
  clienteNomeComAbreviacao,
  tipoClienteCadastro,
} from "@/lib/cliente-observacoes";
import { telefoneParaEnvioWhatsapp } from "@/lib/whatsapp-disparos/telefone-br";

export type MensagemAniversarioInput = {
  nomeCliente: string;
  nomeLaboratorio: string;
  /** Abreviação do cadastro (Dr., Dra., Clínica...). */
  abreviacao?: string | null;
  observacoes?: string | null;
  /** Força uma geração nova a cada clique. */
  semente?: string;
};

export type FonteMensagemAniversario = "gemini" | "openai" | "local";

/** Emojis via code point — evita corrupção de encoding (�) no deploy. */
const E = {
  festa: 0x1f389,
  bolo: 0x1f382,
  balao: 0x1f388,
  party: 0x1f973,
  brilho: 0x2728,
  coracao: 0x1f49b,
  presente: 0x1f381,
  estrela: 0x1f31f,
  sorriso: 0x1f604,
  brinde: 0x1f942,
  flores: 0x1f490,
  confete: 0x1f38a,
} as const;

function emoji(...codes: number[]) {
  return codes.map((c) => String.fromCodePoint(c)).join("");
}

function emojiEspacado(...codes: number[]) {
  return codes.map((c) => String.fromCodePoint(c)).join(" ");
}

const EMOJIS_FESTA = [
  E.festa,
  E.bolo,
  E.balao,
  E.party,
  E.brilho,
  E.coracao,
  E.presente,
  E.estrela,
  E.sorriso,
  E.brinde,
  E.flores,
  E.confete,
];

const ESTILOS_CRIATIVOS = [
  "poética e delicada, com metáfora leve sobre sorrisos e novos ciclos",
  "alegre e animada, como um brinde de festa entre parceiros de confiança",
  "elegante e sofisticada, com tom de carta curta de carinho profissional",
  "calorosa e próxima, como um abraço em texto, sem exagerar na intimidade",
  "inspiradora e positiva, destacando gratidão pela parceria ao longo do tempo",
  "criativa e original, com imagem mental de celebração e bons momentos",
  "gentil e memorável, misturando afeto, respeito e desejo de prosperidade",
];

const PROMPT_SISTEMA = [
  "Você é um redator criativo de mensagens de WhatsApp para um laboratório de prótese odontológica no Brasil.",
  "",
  "Regras obrigatórias:",
  "- Escreva em português do Brasil, natural e humano, com acentuação correta.",
  "- Mensagem elaborada e criativa (5 a 8 frases curtas), única a cada pedido.",
  "- Tom caloroso, profissional e afetivo.",
  "- Trate o cliente EXATAMENTE pelo nome completo informado (já com abreviação Dr./Dra./Clínica etc.), sem inventar outro título e sem encurtar o nome.",
  "- Inclua o nome do laboratório de forma orgânica.",
  "- Inclua vários emojis festivos Unicode válidos ao longo da mensagem (entre 6 e 10), por exemplo: party popper, birthday cake, balloon, sparkles, gift.",
  "- NUNCA use ponto de interrogação. Não faça perguntas.",
  "- Não use aspas no início/fim, hashtags, links, promoções nem peça resposta.",
  "- Evite travessões. Prefira ponto, vírgula e exclamação.",
  "- Não use o caractere de substituição nem placeholders no lugar de emoji.",
].join("\n");

function hashSimples(texto: string) {
  let h = 0;
  for (let i = 0; i < texto.length; i += 1) {
    h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return h;
}

function novaSemente() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function estiloAleatorio(semente: string) {
  return ESTILOS_CRIATIVOS[hashSimples(semente) % ESTILOS_CRIATIVOS.length]!;
}

function emojisAleatorios(semente: string, qtd = 4) {
  const base = hashSimples(semente);
  const codes: number[] = [];
  for (let i = 0; i < qtd; i += 1) {
    codes.push(EMOJIS_FESTA[(base + i * 3) % EMOJIS_FESTA.length]!);
  }
  return emojiEspacado(...codes);
}

function resolverAbreviacao(input: MensagemAniversarioInput): string {
  const direta = (input.abreviacao || "").trim();
  if (direta) return direta;
  const deObs = abreviacaoCliente(input.observacoes).trim();
  if (deObs) return deObs;
  const tipo = tipoClienteCadastro(input.observacoes).trim();
  if (tipo === "Clínica" || tipo.toLowerCase() === "clinica") return "Clínica";
  return "";
}

/** Nome de tratamento com abreviação do cadastro (nunca só a primeira palavra). */
export function nomeClienteParaMensagem(input: MensagemAniversarioInput): string {
  const nomeBruto = (input.nomeCliente || "").trim();
  if (!nomeBruto) return "cliente";

  if (input.observacoes != null && input.observacoes !== undefined) {
    return clienteNomeComAbreviacao({
      nome: nomeBruto,
      observacoes: input.observacoes,
    });
  }

  const abrev = resolverAbreviacao(input);
  if (!abrev) return nomeBruto;
  if (nomeBruto.toLowerCase().startsWith(abrev.toLowerCase())) return nomeBruto;
  return `${abrev} ${nomeBruto}`;
}

function contemEmojiValido(texto: string) {
  for (let i = 0; i < texto.length; ) {
    const cp = texto.codePointAt(i);
    if (cp == null) break;
    if (
      (cp >= 0x1f300 && cp <= 0x1faff) ||
      (cp >= 0x2600 && cp <= 0x27bf) ||
      cp === 0x2728
    ) {
      return true;
    }
    i += cp > 0xffff ? 2 : 1;
  }
  return false;
}

/** Remove interrogações e caracteres quebrados; garante emojis válidos. */
export function limparMensagemWhatsapp(texto: string, semente = novaSemente()): string {
  let out = String(texto || "")
    .replace(/\uFFFD/g, "")
    .replace(/[—–―]/g, "-")
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00A0/g, " ")
    .replace(/\?+/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ !/g, "!")
    .trim();

  if (!contemEmojiValido(out)) {
    out = `${out} ${emojisAleatorios(semente, 5)}`.trim();
  }
  return out;
}

function promptUsuario(input: MensagemAniversarioInput, semente: string) {
  const nome = nomeClienteParaMensagem(input);
  const abrev = resolverAbreviacao(input);
  const estilo = estiloAleatorio(semente);
  return [
    `Crie AGORA uma mensagem NOVA de feliz aniversário (nunca igual a anteriores).`,
    `Estilo desejado nesta versão: ${estilo}.`,
    `Código único desta geração: ${semente}`,
    `Trate o cliente assim (obrigatório, nome completo): ${nome}`,
    abrev
      ? `Abreviação cadastrada no cliente: ${abrev} (já deve aparecer no nome acima).`
      : `Use exatamente o nome informado, sem inventar abreviação.`,
    `Nome do laboratório: ${input.nomeLaboratorio || "Laboratório"}`,
    `Inclua vários emojis festivos Unicode reais para animar a mensagem.`,
    `Proibido usar qualquer ponto de interrogação.`,
    `Não encurte o nome do cliente para uma sílaba ou iniciais.`,
  ].join("\n");
}

/** Variações locais (fallback sem API) — uma diferente a cada clique. */
export function gerarMensagemAniversarioLocal(input: MensagemAniversarioInput): string {
  const nome = nomeClienteParaMensagem(input);
  const lab = (input.nomeLaboratorio || "nosso laboratório").trim();
  const semente = input.semente || novaSemente();
  const festa = emojisAleatorios(semente, 5);
  const bolo = emoji(E.bolo);
  const festa2 = emoji(E.festa);
  const brilho = emoji(E.brilho);
  const balao = emoji(E.balao);
  const party = emoji(E.party);
  const coracao = emoji(E.coracao);
  const presente = emoji(E.presente);
  const estrela = emoji(E.estrela);
  const brinde = emoji(E.brinde);

  const modelos = [
    `Olá, ${nome}! ${festa} Hoje o calendário ganhou um brilho especial e a equipe do ${lab} não poderia deixar esse dia passar em branco. Que este novo ciclo traga saúde, conquistas e sorrisos generosos. Obrigado pela confiança que construímos juntos. Feliz aniversário! ${bolo}${festa2}`,
    `${nome}, feliz aniversário! ${bolo} ${balao} ${brilho} Que a vida te presenteie com leveza, boas notícias e momentos que valem a pena celebrar. Do ${lab}, um abraço cheio de gratidão pela parceria e pelos sorrisos que transformamos juntos. Que o seu dia seja inesquecível! ${party}${coracao}`,
    `Parabéns, ${nome}! ${balao}${festa2}${estrela} Em nome do ${lab}, desejamos que este aniversário abra portas, aqueça o coração e inspire novos projetos. Que a sua trajetória continue brilhante e que possamos seguir ao seu lado nessa caminhada. Um dia maravilhoso para você! ${brilho}${bolo}`,
    `Oi, ${nome}! Hoje é dia de festa ${festa}. O ${lab} manda um carinho sincero e votos de muita saúde, paz e sucesso. Que cada mês à frente traga motivos de comemoração e que o seu sorriso continue iluminando a todos ao redor. Feliz aniversário! ${party}${bolo}`,
    `${nome}, nosso carinho neste dia especial! ${coracao}${festa2}${bolo} Que o novo ano de vida seja feito de encontros bons, realizações concretas e alegrias simples. A equipe do ${lab} celebra você com gratidão e estima. Que venham muitos sorrisos e histórias felizes! ${brilho}${balao}`,
    `Feliz aniversário, ${nome}! ${festa} Que o seu dia nasça sereno, floresça em boas surpresas e termine com o coração leve. Do ${lab}, um brinde à sua jornada e à confiança que nos une. Que a vida continue sorrindo para você! ${brinde}${bolo}`,
    `${nome}, parabéns pelo seu dia! ${bolo}${presente}${estrela} Que saúde, coragem e prosperidade caminhem juntas com você neste novo ciclo. O ${lab} agradece a parceria de sempre e deseja um aniversário memorável, cheio de afeto e conquistas. Um abraço especial! ${coracao}${festa2}`,
    `${nome}, hoje celebramos a sua história! ${brilho}${festa2}${balao} Que este aniversário seja um convite à alegria e a novos começos. A equipe do ${lab} envia votos de bem-estar, sucesso e muitos motivos para sorrir. Feliz aniversário de verdade! ${bolo}${party}${coracao}`,
  ];
  return limparMensagemWhatsapp(modelos[hashSimples(semente) % modelos.length]!, semente);
}

function mensagemIaPareceQuebrada(texto: string) {
  if (!texto.trim()) return true;
  if ((texto.match(/\uFFFD/g) || []).length >= 1) return true;
  // Se a IA devolveu "?" no lugar de emoji/acento
  if (/\s\?\s|\?\?/.test(texto)) return true;
  return false;
}

async function gerarMensagemAniversarioGemini(
  input: MensagemAniversarioInput,
  semente: string
): Promise<string | null> {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
        contents: [{ role: "user", parts: [{ text: promptUsuario(input, semente) }] }],
        generationConfig: {
          temperature: 1.15,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 450,
        },
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const texto = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim();
    if (!texto || mensagemIaPareceQuebrada(texto)) return null;
    return limparMensagemWhatsapp(texto, semente);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function gerarMensagemAniversarioOpenAI(
  input: MensagemAniversarioInput,
  semente: string
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        model,
        temperature: 1.15,
        presence_penalty: 0.6,
        frequency_penalty: 0.5,
        max_tokens: 420,
        messages: [
          { role: "system", content: PROMPT_SISTEMA },
          { role: "user", content: promptUsuario(input, semente) },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const texto = data.choices?.[0]?.message?.content?.trim();
    if (!texto || mensagemIaPareceQuebrada(texto)) return null;
    return limparMensagemWhatsapp(texto, semente);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function gerarMensagemAniversario(input: MensagemAniversarioInput): Promise<{
  mensagem: string;
  fonte: FonteMensagemAniversario;
  nomeUsado: string;
}> {
  const semente = input.semente || novaSemente();
  const payload = { ...input, semente };
  const nomeUsado = nomeClienteParaMensagem(payload);

  const viaGemini = await gerarMensagemAniversarioGemini(payload, semente);
  if (viaGemini) return { mensagem: viaGemini, fonte: "gemini", nomeUsado };

  const viaOpenAI = await gerarMensagemAniversarioOpenAI(payload, semente);
  if (viaOpenAI) return { mensagem: viaOpenAI, fonte: "openai", nomeUsado };

  return {
    mensagem: gerarMensagemAniversarioLocal(payload),
    fonte: "local",
    nomeUsado,
  };
}

export function linkWhatsappWeb(telefone: string | null | undefined, mensagem: string) {
  const numero = telefoneParaEnvioWhatsapp(telefone);
  if (!numero) return null;
  const texto = limparMensagemWhatsapp(mensagem);
  // api.whatsapp.com preserva melhor Unicode no preview do navegador
  return `https://api.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(texto)}`;
}
