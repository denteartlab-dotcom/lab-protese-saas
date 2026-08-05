import { telefoneParaEnvioWhatsapp } from "@/lib/whatsapp-disparos/telefone-br";

export type MensagemAniversarioInput = {
  nomeCliente: string;
  nomeLaboratorio: string;
};

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
  ];
  const chave = `${input.nomeCliente}|${new Date().toISOString().slice(0, 10)}`;
  return modelos[hashSimples(chave) % modelos.length]!;
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
          {
            role: "system",
            content:
              "Você escreve mensagens curtas de feliz aniversário para WhatsApp, em português do Brasil. Tom caloroso, profissional e humano, de um laboratório de prótese odontológica. Use 2 a 4 frases, no máximo 2 emojis. Não use aspas no início/fim. Não invente promoções nem links.",
          },
          {
            role: "user",
            content: `Nome do cliente: ${input.nomeCliente}\nNome do laboratório: ${input.nomeLaboratorio || "Laboratório"}`,
          },
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
  fonte: "openai" | "local";
}> {
  const viaIa = await gerarMensagemAniversarioOpenAI(input);
  if (viaIa) return { mensagem: viaIa, fonte: "openai" };
  return { mensagem: gerarMensagemAniversarioLocal(input), fonte: "local" };
}

export function linkWhatsappWeb(telefone: string | null | undefined, mensagem: string) {
  const numero = telefoneParaEnvioWhatsapp(telefone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
