import {
  abreviacaoCliente,
  clienteNomeComAbreviacao,
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

const EMOJIS_FESTA = ["🎉", "🎂", "🎈", "🥳", "✨", "💛", "🎁", "🌟", "😄", "🥂", "💐", "🎊"];

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

Regras obrigatórias:
- Escreva em português do Brasil, natural e humano, com acentuação correta.
- Mensagem elaborada e criativa (4 a 7 frases curtas), única a cada pedido.
- Tom caloroso, profissional e afetivo.
- Trate o cliente EXATAMENTE pelo nome completo informado (já com abreviação, se houver), sem inventar outro título.
- Inclua o nome do laboratório de forma orgânica.
- Use vários emojis festivos ao longo da mensagem (entre 5 e 8), para deixar a leitura animada: 🎉 🎂 🎈 🥳 ✨ 💛 🎁 🌟 😄 🥂.
- NUNCA use ponto de interrogação (?). Não faça perguntas.
- Não use aspas no início/fim, hashtags, links, promoções nem peça resposta.
- Evite travessões longos. Prefira ponto, vírgula e exclamação.
- Não repita clichês vazios; varie abertura, metáforas e fechamento.`;

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

function emojisAleatorios(semente: string, qtd = 3) {
  const base = hashSimples(semente);
  const escolhidos: string[] = [];
  for (let i = 0; i < qtd; i += 1) {
    escolhidos.push(EMOJIS_FESTA[(base + i * 3) % EMOJIS_FESTA.length]!);
  }
  return escolhidos.join(" ");
}

/** Nome de tratamento com abreviação do cadastro. */
export function nomeClienteParaMensagem(input: MensagemAniversarioInput): string {
  if (input.observacoes != null) {
    return clienteNomeComAbreviacao({
      nome: input.nomeCliente,
      observacoes: input.observacoes,
    });
  }
  const abrev = (input.abreviacao || "").trim();
  const nome = (input.nomeCliente || "").trim();
  if (!nome) return "cliente";
  if (!abrev) return nome;
  if (nome.toLowerCase().startsWith(abrev.toLowerCase())) return nome;
  return `${abrev} ${nome}`;
}

function primeiroTrechoNome(nomeCompleto: string) {
  const limpo = nomeCompleto.trim().replace(/\s+/g, " ");
  if (!limpo) return "cliente";
  const partes = limpo.split(" ");
  if (partes.length >= 2 && /^(dr\.?|dra\.?|cl[ií]nica|sr\.?|sra\.?)$/i.test(partes[0]!)) {
    return `${partes[0]} ${partes[1]}`;
  }
  return partes[0] || limpo;
}

/** Remove interrogações e caracteres que costumam aparecer quebrados no WhatsApp. */
export function limparMensagemWhatsapp(texto: string): string {
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
    .trim();

  const temEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(out);
  if (!temEmoji) {
    out = `${out} 🎉🎂✨`.trim();
  }
  return out;
}

function promptUsuario(input: MensagemAniversarioInput, semente: string) {
  const nome = nomeClienteParaMensagem(input);
  const abrev =
    (input.abreviacao || "").trim() ||
    abreviacaoCliente(input.observacoes) ||
    "";
  const estilo = estiloAleatorio(semente);
  return [
    `Crie AGORA uma mensagem NOVA de feliz aniversário (nunca igual a anteriores).`,
    `Estilo desejado nesta versão: ${estilo}.`,
    `Código único desta geração: ${semente}`,
    `Trate o cliente assim (obrigatório): ${nome}`,
    abrev
      ? `Abreviação do cadastro: ${abrev}`
      : `Sem abreviação extra além do nome informado.`,
    `Nome do laboratório: ${input.nomeLaboratorio || "Laboratório"}`,
    `Inclua vários emojis festivos para animar a mensagem.`,
    `Proibido usar qualquer ponto de interrogação.`,
    `Varie palavras, ritmo e fechamento. Seja criativo e memorável.`,
  ].join("\n");
}

/** Variações locais (fallback sem API) — uma diferente a cada clique. */
export function gerarMensagemAniversarioLocal(input: MensagemAniversarioInput): string {
  const nome = nomeClienteParaMensagem(input);
  const curto = primeiroTrechoNome(nome);
  const lab = (input.nomeLaboratorio || "nosso laboratório").trim();
  const semente = input.semente || novaSemente();
  const festa = emojisAleatorios(semente, 4);
  const modelos = [
    `Olá, ${curto}! ${festa} Hoje o calendário ganhou um brilho especial e a equipe do ${lab} não poderia deixar esse dia passar em branco. Que este novo ciclo traga saúde, conquistas e sorrisos generosos. Obrigado pela confiança que construímos juntos. Feliz aniversário, ${nome}! 🎂🎉`,
    `${curto}, feliz aniversário! 🎂🎈✨ Que a vida te presenteie com leveza, boas notícias e momentos que valem a pena celebrar. Do ${lab}, um abraço cheio de gratidão pela parceria e pelos sorrisos que transformamos juntos. Que o seu dia seja inesquecível, ${nome}! 🥳💛`,
    `Parabéns, ${nome}! 🎈🎉🌟 Em nome do ${lab}, desejamos que este aniversário abra portas, aqueça o coração e inspire novos projetos. Que a sua trajetória continue brilhante e que possamos seguir ao seu lado nessa caminhada. Um dia maravilhoso para você! ✨🎂`,
    `Oi, ${curto}! Hoje é dia de festa ${festa} O ${lab} manda um carinho sincero e votos de muita saúde, paz e sucesso. Que cada mês à frente traga motivos de comemoração e que o seu sorriso continue iluminando a todos ao redor. Feliz aniversário, ${nome}! 🥳🎂`,
    `${nome}, nosso carinho neste dia especial! 💛🎉🎂 Que o novo ano de vida seja feito de encontros bons, realizações concretas e alegrias simples. A equipe do ${lab} celebra você com gratidão e estima. Que venham muitos sorrisos e histórias felizes! ✨🎈`,
    `Feliz aniversário, ${nome}! ${festa} Que o seu dia nasça sereno, floresça em boas surpresas e termine com o coração leve. Do ${lab}, um brinde à sua jornada e à confiança que nos une. Que a vida continue sorrindo para você! 🥂🎂`,
    `${curto}, parabéns pelo seu dia! 🎂🎁🌟 Que saúde, coragem e prosperidade caminhem juntas com você neste novo ciclo. O ${lab} agradece a parceria de sempre e deseja um aniversário memorável, cheio de afeto e conquistas. Um abraço especial, ${nome}! 💛🎉`,
    `${nome}, hoje celebramos a sua história! ✨🎉🎈 Que este aniversário seja um convite à alegria e a novos começos. A equipe do ${lab} envia votos de bem-estar, sucesso e muitos motivos para sorrir. Feliz aniversário de verdade! 🎂🥳💛`,
  ];
  return limparMensagemWhatsapp(modelos[hashSimples(semente) % modelos.length]!);
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
    return texto ? limparMensagemWhatsapp(texto) : null;
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
    return texto ? limparMensagemWhatsapp(texto) : null;
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

  const viaGemini = await gerarMensagemAniversarioGemini(payload, semente);
  if (viaGemini) return { mensagem: viaGemini, fonte: "gemini" };

  const viaOpenAI = await gerarMensagemAniversarioOpenAI(payload, semente);
  if (viaOpenAI) return { mensagem: viaOpenAI, fonte: "openai" };

  return { mensagem: gerarMensagemAniversarioLocal(payload), fonte: "local" };
}

export function linkWhatsappWeb(telefone: string | null | undefined, mensagem: string) {
  const numero = telefoneParaEnvioWhatsapp(telefone);
  if (!numero) return null;
  const texto = limparMensagemWhatsapp(mensagem);
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
