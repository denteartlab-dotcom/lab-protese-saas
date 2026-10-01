import {
  abrirWhatsAppFaturaConferencia,
  buildFaturaConferenciaWhatsAppUrl,
  formatWhatsAppPhone,
} from "@/lib/whatsapp";

export type LembreteCobrancaFaturaInput = {
  nomeCliente: string;
  numeroFatura: number | string;
  vencimento: string;
  saldoFormatado: string;
  nomeLaboratorio?: string;
};

function saldoComMoeda(saldoFormatado: string) {
  const limpo = saldoFormatado.trim();
  if (!limpo) return "R$ 0,00";
  if (/^r\$/i.test(limpo)) return limpo;
  return `R$ ${limpo}`;
}

/** Mensagem pronta de lembrete de cobrança para fatura vencida. */
export function mensagemLembreteCobrancaFatura(input: LembreteCobrancaFaturaInput) {
  const nome = input.nomeCliente.trim() || "cliente";
  const lab = (input.nomeLaboratorio || "").trim();
  const linhas = [
    `Olá, ${nome}!`,
    "",
    `Passamos para lembrar que a fatura nº ${input.numeroFatura}, com vencimento em ${input.vencimento}, encontra-se em atraso.`,
    "",
    `Valor em aberto: ${saldoComMoeda(input.saldoFormatado)}`,
    "",
    "Pedimos a gentileza de regularizar o pagamento. Qualquer dúvida, estamos à disposição.",
  ];
  if (lab) {
    linhas.push("", "Atenciosamente,", lab);
  } else {
    linhas.push("", "Atenciosamente.");
  }
  return linhas.join("\n");
}

export function buildWhatsAppWebLembreteCobrancaUrl(
  telefone: string | null | undefined,
  input: LembreteCobrancaFaturaInput
) {
  return buildFaturaConferenciaWhatsAppUrl(
    telefone,
    mensagemLembreteCobrancaFatura(input),
    { preferirWhatsAppWeb: true }
  );
}

/**
 * Abre o WhatsApp Web com o lembrete de cobrança preenchido.
 * Sem telefone válido, ainda abre o Web para escolher o contato.
 */
export function abrirWhatsAppWebLembreteCobrancaFatura(
  opts: LembreteCobrancaFaturaInput & {
    telefone?: string | null;
    alertaSemTelefone?: string;
  }
) {
  const { telefone, alertaSemTelefone, ...input } = opts;
  const texto = mensagemLembreteCobrancaFatura(input);
  const digits = telefone ? formatWhatsAppPhone(telefone) : "";
  if (!digits && typeof window !== "undefined") {
    window.alert(
      alertaSemTelefone ||
        "Cliente sem WhatsApp cadastrado. O WhatsApp Web será aberto para você escolher o contato."
    );
  }
  return abrirWhatsAppFaturaConferencia(telefone, texto, undefined, {
    preferirWhatsAppWeb: true,
  });
}
