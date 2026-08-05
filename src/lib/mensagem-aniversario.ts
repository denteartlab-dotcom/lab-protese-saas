import { telefoneParaEnvioWhatsapp } from "@/lib/whatsapp-disparos/telefone-br";

export type MensagemAniversarioInput = {
  nomeCliente: string;
  nomeLaboratorio: string;
  /** Força uma geração nova a cada clique. */
  semente?: string;
};

export type FonteMensagemAniversario = "gemini" | "openai" | "local";

const ESTILOS_CRIATIVOS = [
  "poética e delicada, com metáfora leve sobre sorrisos e novos ciclos",
  "alegre e animada, como um brinde de festa entre parceiros de confiança",
  "elegante e sofisticada, com tom de carta curta de carinho profissional",
  "calorosa e próxima, como um abraço em texto, sem exagerar na intimidade",
  "inspiradora e positiva, destacando gratidão pela parceria ao longo do tempo",
  "criativa e original, com imagem mental de celebração e bons momentos",
  "gentil e memorável, misturando afeto, respeito e desejo de prosperidade",
];

const PROMPT_SISTEMA = `Você é um redator criativo de mensagens de WhatsApp para um laboratório de prótese odontológica no Brasil.

Regras:
- Escreva em português do Brasil, natural e humano.
- Mensagem elaborada e criativa (4 a 7 frases curtas), única a cada pedido.
- Tom caloroso, profissional e afetivo — nunca genérico demais.
- Inclua o nome do cliente e o nome do laboratório de forma orgânica.
- Pode usar de 2 a 4 emojis no máximo, bem colocados.
- Sem aspas no início/fim, sem hashtags, sem links, sem promoções, sem pedir resposta.
- Não repita clichês vazios; varie abertura, metáforas e fechamento.`;

function hashSimples(texto: string) {
  let h = 0;
  for (let i = 0; i < texto.length; i += 1) {
    h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return h;
}

function primeiroNome(nome: string) {
  const limpo = nome.trim().replace(/\s+/g, " ");
  if (!limpo) return "cliente";
  return limpo.split(" ")[0] || limpo;
}

function novaSemente() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function estiloAleatorio(semente: string) {
  return ESTILOS_CRIATIVOS[hashSimples(semente) % ESTILOS_CRIATIVOS.length]!;
}

function promptUsuario(input: MensagemAniversarioInput, semente: string) {
  const estilo = estiloAleatorio(semente);
  return [
    `Crie AGORA uma mensagem NOVA de feliz aniversário (nunca igual a anteriores).`,
    `Estilo desejado nesta versão: ${estilo}.`,
    `Código único desta geração: ${semente}`,
    `Nome do cliente: ${input.nomeCliente}`,
    `Nome do laboratório: ${input.nomeLaboratorio || "Laboratório"}`,
    `Varie palavras, ritmo e fechamento. Seja criativo e memorável.`,
  ].join("\n");
}

/** Variações locais (fallback sem API) — uma diferente a cada clique. */
export function gerarMensagemAniversarioLocal(input: MensagemAniversarioInput): string {
  const nome = primeiroNome(input.nomeCliente);
  const lab = (input.nomeLaboratorio || "nosso laboratório").trim();
  const semente = input.semente || novaSemente();
  const modelos = [
    `Olá, ${nome}! 🎉 Hoje o calendário ganhou um brilho especial — e a equipe do ${lab} não poderia deixar esse dia passar em branco. Que este novo ciclo traga saúde, conquistas e sorrisos genuínos. Obrigado pela confiança que construímos juntos. Feliz aniversário! 🎂`,
    `${nome}, feliz aniversário! 🎂 Que a vida te presenteie com leveza, boas notícias e momentos que valem a pena celebrar. Do ${lab}, um abraço cheio de gratidão pela parceria e pelos sorrisos que transformamos juntos. Que o seu dia seja inesquecível! ✨`,
    `Parabéns, ${nome}! 🎈 Em nome do ${lab}, desejamos que este aniversário abra portas, aqueça o coração e inspire novos projetos. Que a sua trajetória continue brilhante — e que possamos seguir ao seu lado nessa caminhada. Um dia maravilhoso para você!`,
    `Oi, ${nome}! Hoje é dia de festa 🥳 O ${lab} manda um carinho sincero e votos de muita saúde, paz e sucesso. Que cada mês à frente traga motivos de comemoração — e que o seu sorriso continue iluminando a todos ao redor. Feliz aniversário!`,
    `${nome}, nosso carinho neste dia especial! 💛 Que o novo ano de vida seja feito de encontros bons, realizações concretas e alegrias simples. A equipe do ${lab} celebra você com gratidão e estima. Que venham muitos sorrisos e histórias felizes!`,
    `Feliz aniversário, ${nome}! 🎉 Que o seu dia nasça sereno, floresça em boas surpresas e termine com o coração leve. Do ${lab}, um brinde à sua jornada e à confiança que nos une. Que a vida continue sorrindo para você! 🥂`,
    `${nome}, parabéns pelo seu dia! 🎂 Que saúde, coragem e prosperidade caminhem juntas com você neste novo ciclo. O ${lab} agradece a parceria de sempre e deseja um aniversário memorável, cheio de afeto e conquistas. Um abraço especial!`,
    `Querido(a) ${nome}, hoje celebramos a sua história! ✨ Que este aniversário seja um convite à alegria e a novos começos. A equipe do ${lab} envia votos de bem-estar, sucesso e muitos motivos para sorrir. Feliz aniversário de verdade! 🎂`,
  ];
  return modelos[hashSimples(semente) % modelos.length]!;
}

/** Google Gemini — camada gratuita (Google AI Studio). */
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
      headers: { "Content-Type": "application/json" },
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
    return texto || null;
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
        "Content-Type": "application/json",
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
    return texto || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function gerarMensagemAniversario(input: MensagemAniversarioInput): Promise<{
  mensagem: string;
  fonte: FonteMensagemAniversario;
}> {
  const semente = input.semente || novaSemente();
  const payload = { ...input, semente };

  // Preferência: Gemini (grátis) → OpenAI (pago) → textos locais
  const viaGemini = await gerarMensagemAniversarioGemini(payload, semente);
  if (viaGemini) return { mensagem: viaGemini, fonte: "gemini" };

  const viaOpenAI = await gerarMensagemAniversarioOpenAI(payload, semente);
  if (viaOpenAI) return { mensagem: viaOpenAI, fonte: "openai" };

  return { mensagem: gerarMensagemAniversarioLocal(payload), fonte: "local" };
}

export function linkWhatsappWeb(telefone: string | null | undefined, mensagem: string) {
  const numero = telefoneParaEnvioWhatsapp(telefone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
