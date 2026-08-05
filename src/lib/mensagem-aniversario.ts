import { telefoneParaEnvioWhatsapp } from "@/lib/whatsapp-disparos/telefone-br";

export type MensagemAniversarioInput = {
  nomeCliente: string;
  nomeLaboratorio: string;
};

export type FonteMensagemAniversario = "gemini" | "openai" | "local";

const PROMPT_SISTEMA =
  "Você escreve mensagens curtas de feliz aniversário para WhatsApp, em português do Brasil. Tom caloroso, profissional e humano, de um laboratório de prótese odontológica. Use 2 a 4 frases, no máximo 2 emojis. Não use aspas no início/fim. Não invente promoções nem links.";

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

function promptUsuario(input: MensagemAniversarioInput) {
  return `Nome do cliente: ${input.nomeCliente}\nNome do laboratório: ${input.nomeLaboratorio || "Laboratório"}`;
}

/** Variações locais (fallback sem API) — tom pessoal e profissional. */
export function gerarMensagemAniversarioLocal(input: MensagemAniversarioInput): string {
  const nome = primeiroNome(input.nomeCliente);
  const lab = (input.nomeLaboratorio || "nosso laboratório").trim();
  const modelos = [
    `Olá, ${nome}! 🎉 A equipe do ${lab} deseja um feliz aniversário, com saúde, alegria e muitos sorrisos. Obrigado pela confiança de sempre!`,
    `${nome}, feliz aniversário! 🎂 Que este novo ciclo traga conquistas e momentos especiais. Contamos com você aqui no ${lab}!`,
    `Parabéns, ${nome}! 🎈 Em nome do ${lab}, desejamos um dia incrível e um ano repleto de realizações. É um prazer fazer parte da sua jornada!`,
    `Oi, ${nome}! Hoje é dia de festa 🥳 O ${lab} manda um abraço especial e votos de muita saúde e sucesso. Feliz aniversário!`,
    `${nome}, nosso carinho neste dia especial! 💛 Feliz aniversário da equipe do ${lab}. Que venham muitos sorrisos e boas histórias!`,
    `Feliz aniversário, ${nome}! 🎉 Que o seu dia seja leve e cheio de boas notícias. Um abraço da equipe do ${lab}!`,
    `${nome}, parabéns pelo seu dia! 🎂 Desejamos saúde, paz e muito sucesso. O ${lab} agradece a parceria de sempre.`,
  ];
  const chave = `${input.nomeCliente}|${new Date().toISOString().slice(0, 10)}|${Date.now() % 7}`;
  return modelos[hashSimples(chave) % modelos.length]!;
}

/** Google Gemini — camada gratuita (Google AI Studio). */
async function gerarMensagemAniversarioGemini(
  input: MensagemAniversarioInput
): Promise<string | null> {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
        contents: [{ role: "user", parts: [{ text: promptUsuario(input) }] }],
        generationConfig: {
          temperature: 0.95,
          maxOutputTokens: 220,
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
  input: MensagemAniversarioInput
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

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
        temperature: 0.95,
        max_tokens: 220,
        messages: [
          { role: "system", content: PROMPT_SISTEMA },
          { role: "user", content: promptUsuario(input) },
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
  // Preferência: Gemini (grátis) → OpenAI (pago) → textos locais
  const viaGemini = await gerarMensagemAniversarioGemini(input);
  if (viaGemini) return { mensagem: viaGemini, fonte: "gemini" };

  const viaOpenAI = await gerarMensagemAniversarioOpenAI(input);
  if (viaOpenAI) return { mensagem: viaOpenAI, fonte: "openai" };

  return { mensagem: gerarMensagemAniversarioLocal(input), fonte: "local" };
}

export function linkWhatsappWeb(telefone: string | null | undefined, mensagem: string) {
  const numero = telefoneParaEnvioWhatsapp(telefone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
