import { montarUrlPublica } from "@/lib/app-url";

export { publicOriginFromRequest } from "@/lib/app-url";

export function formatWhatsAppPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** Máscara visual para campo de WhatsApp (Brasil). */
export function formatWhatsappInput(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Garante URL absoluta para WhatsApp reconhecer o link (https://dominio/...). */
export function garantirUrlPublicaAbsoluta(url: string) {
  const limpo = url.trim();
  if (/^https?:\/\//i.test(limpo)) return limpo;
  return montarUrlPublica(limpo);
}

export function orcamentoPublicUrl(token: string) {
  return montarUrlPublica(`/orcamento/${token}`);
}

export function clienteAcompanhamentoPublicUrl(token: string) {
  return montarUrlPublica(`/acompanhamento/${token}`);
}

export function clienteAcompanhamentoOsUrl(token: string, numeroOs: number) {
  const base = clienteAcompanhamentoPublicUrl(token);
  const q = new URLSearchParams({ os: String(numeroOs) });
  return `${base}?${q}`;
}

/** Caminho relativo para uso interno no painel do laboratório. */
export function hrefAcompanhamentoClienteOs(token: string, numeroOs: number) {
  const q = new URLSearchParams({ os: String(numeroOs) });
  return `/acompanhamento/${token}?${q}`;
}

export function mensagemAcompanhamentoCliente(
  nomeCliente: string,
  publicUrl: string
) {
  const saudacao = nomeCliente.trim()
    ? `Olá, ${nomeCliente.trim()}!`
    : "Olá!";
  return `${saudacao}\n\nAcompanhe em tempo real a produção dos seus trabalhos no laboratório pelo link abaixo:\n\n${publicUrl}`;
}

/** Texto com URL isolada em linha própria para o WhatsApp reconhecer como link clicável. */
export function mensagemSolicitarOrcamento(publicUrl: string) {
  return `Olá, solicito o orçamento dos produtos listados abaixo.\n\n${publicUrl}`;
}

export function mensagemReenviarOrcamentoConferencia(
  numeroPedido: number,
  publicUrl: string
) {
  return `Olá! Por favor, confira e atualize o orçamento do pedido #${numeroPedido} no link abaixo:\n\n${publicUrl}`;
}

export function mensagemAprovacaoOrcamento(
  numeroPedido: number,
  fornecedorNome: string,
  totalFormatado: string
) {
  return `Olá! O orçamento do pedido #${numeroPedido} foi APROVADO.\n\nFornecedor: ${fornecedorNome}\nValor total: ${totalFormatado}\n\nObrigado pela cotação!`;
}

function buildWhatsAppSendUrl(phone: string, text: string) {
  const digits = formatWhatsAppPhone(phone);
  if (!digits) return null;
  return `https://api.whatsapp.com/send/?phone=${digits}&text=${encodeURIComponent(text)}&type=phone_number&app_absent=0`;
}

export function buildOrcamentoWhatsAppUrl(phone: string, publicUrl: string) {
  return buildWhatsAppSendUrl(phone, mensagemSolicitarOrcamento(publicUrl));
}

export function buildAprovacaoWhatsAppUrl(
  phone: string,
  numeroPedido: number,
  fornecedorNome: string,
  totalFormatado: string
) {
  return buildWhatsAppSendUrl(
    phone,
    mensagemAprovacaoOrcamento(numeroPedido, fornecedorNome, totalFormatado)
  );
}

export function abrirWhatsAppUrl(url: string | null) {
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

export function abrirWhatsAppOrcamento(phone: string, publicUrl: string) {
  return abrirWhatsAppUrl(buildOrcamentoWhatsAppUrl(phone, publicUrl));
}

export function abrirWhatsAppReenviarConferencia(
  phone: string,
  numeroPedido: number,
  publicUrl: string
) {
  return abrirWhatsAppUrl(
    buildWhatsAppSendUrl(
      phone,
      mensagemReenviarOrcamentoConferencia(numeroPedido, publicUrl)
    )
  );
}

export function abrirWhatsAppAprovacao(
  phone: string,
  numeroPedido: number,
  fornecedorNome: string,
  totalFormatado: string
) {
  return abrirWhatsAppUrl(
    buildAprovacaoWhatsAppUrl(phone, numeroPedido, fornecedorNome, totalFormatado)
  );
}

export function abrirWhatsAppAcompanhamentoCliente(
  phone: string,
  nomeCliente: string,
  publicUrl: string
) {
  return abrirWhatsAppUrl(
    buildWhatsAppSendUrl(phone, mensagemAcompanhamentoCliente(nomeCliente, publicUrl))
  );
}

export function buildFaturaConferenciaWhatsAppUrl(
  phone: string | null | undefined,
  texto: string
) {
  const digits = phone ? formatWhatsAppPhone(phone) : "";
  if (!digits) {
    return `https://api.whatsapp.com/send/?text=${encodeURIComponent(texto)}&type=phone_number&app_absent=0`;
  }
  return buildWhatsAppSendUrl(digits, texto);
}

export function abrirWhatsAppFaturaConferencia(
  phone: string | null | undefined,
  texto: string
) {
  return abrirWhatsAppUrl(buildFaturaConferenciaWhatsAppUrl(phone, texto));
}
