import {
  buildWhatsAppWebLembreteCobrancaUrl,
  mensagemLembreteCobrancaFatura,
} from "../src/lib/mensagem-cobranca-fatura";

function assert(condicao: boolean, mensagem: string) {
  if (!condicao) throw new Error(mensagem);
}

const texto = mensagemLembreteCobrancaFatura({
  nomeCliente: "Dr. João Silva",
  numeroFatura: 171,
  vencimento: "15/09/2026",
  saldoFormatado: "1.250,00",
  nomeLaboratorio: "Dente Art Lab",
});

assert(texto.includes("Olá, Dr. João Silva!"), "deve saudar o cliente");
assert(texto.includes("fatura nº 171"), `deve citar o número da nota: ${texto}`);
assert(texto.includes("15/09/2026"), "deve citar o vencimento");
assert(texto.includes("R$ 1.250,00"), `deve citar o saldo com R$: ${texto}`);
assert(texto.includes("em atraso"), "deve indicar atraso");
assert(texto.includes("Dente Art Lab"), "deve assinar com o laboratório");
assert(!texto.includes("- R$"), "saldo não deve ter sinal negativo extra");

const comRsJaFormatado = mensagemLembreteCobrancaFatura({
  nomeCliente: "Maria",
  numeroFatura: 10,
  vencimento: "01/01/2026",
  saldoFormatado: "R$ 50,00",
});
assert(
  (comRsJaFormatado.match(/R\$/g) || []).length === 1,
  `não duplicar R$: ${comRsJaFormatado}`
);

const url = buildWhatsAppWebLembreteCobrancaUrl("31982709866", {
  nomeCliente: "Dr. João Silva",
  numeroFatura: 171,
  vencimento: "15/09/2026",
  saldoFormatado: "1.250,00",
  nomeLaboratorio: "Dente Art Lab",
});
assert(Boolean(url), "deve gerar URL do WhatsApp");
assert(
  url!.startsWith("https://web.whatsapp.com/send?"),
  `deve abrir WhatsApp Web: ${url}`
);
assert(url!.includes("phone=5531982709866") || url!.includes("phone=31982709866"), `deve incluir telefone: ${url}`);
assert(url!.includes("text="), "deve incluir o texto da mensagem");
assert(
  decodeURIComponent(url!).includes("fatura nº 171"),
  "texto da URL deve trazer o lembrete"
);

const urlSemFone = buildWhatsAppWebLembreteCobrancaUrl("", {
  nomeCliente: "Maria",
  numeroFatura: 22,
  vencimento: "02/02/2026",
  saldoFormatado: "10,00",
});
assert(Boolean(urlSemFone), "sem telefone ainda gera link do Web");
assert(
  urlSemFone!.startsWith("https://web.whatsapp.com/send?"),
  `sem telefone deve ir ao WhatsApp Web: ${urlSemFone}`
);
assert(
  decodeURIComponent(urlSemFone!).includes("fatura nº 22"),
  "sem telefone o texto continua no link"
);

console.log("ok mensagem-cobranca-fatura");
