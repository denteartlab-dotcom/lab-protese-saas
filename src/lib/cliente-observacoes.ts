import { configValueFromObservacoes } from "@/lib/cliente-financeiro";

export const PREFIXOS_CONFIG_CLIENTE = [
  "Tipo de Cliente:",
  "Abreviação:",
  "Contato:",
  "Telefone Contato:",
  "WhatsApp Contato:",
  "Representante:",
  "Tabela de Preço:",
  "Desconto Geral:",
  "Desconto Geral Tipo:",
  "Limite Saldo Devedor:",
  "Dia da Cobrança:",
  "Data de Nascimento:",
  "RG:",
  "Entregador:",
  "Tipo Entregador:",
  "Custo de Entrega:",
] as const;

const PREFIXO_TABELA_PRECO = "Tabela de Preço:";

/** Remove linhas de configuração estruturada — evita duplicar ao salvar o cadastro. */
export function observacoesTextoLivreCliente(observacoes: string | null | undefined) {
  return (observacoes || "")
    .split("\n")
    .map((linha) => linha.trim())
    .filter(
      (linha) =>
        linha &&
        !PREFIXOS_CONFIG_CLIENTE.some((prefixo) =>
          linha.toLowerCase().startsWith(prefixo.toLowerCase())
        )
    )
    .join("\n");
}

export function descontoGeralClienteObservacoes(observacoes: string | null | undefined) {
  return configValueFromObservacoes(observacoes, "Desconto Geral:");
}

export function descontoGeralTipoClienteObservacoes(observacoes: string | null | undefined) {
  const tipo = configValueFromObservacoes(observacoes, "Desconto Geral Tipo:");
  return tipo === "valor" ? "valor" : "percentual";
}

export function definirTabelaPrecoClienteObservacoes(
  observacoes: string | null | undefined,
  tabela: string
) {
  const tabelaLimpa = tabela.trim();
  const linhas = (observacoes || "")
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .filter((linha) => !linha.toLowerCase().startsWith(PREFIXO_TABELA_PRECO.toLowerCase()));

  if (tabelaLimpa) {
    linhas.push(`${PREFIXO_TABELA_PRECO} ${tabelaLimpa}`);
  }

  return linhas.join("\n");
}

export function abreviacaoCliente(observacoes: string | null | undefined): string {
  return configValueFromObservacoes(observacoes, "Abreviação:");
}

export function tipoClienteCadastro(observacoes: string | null | undefined): string {
  return configValueFromObservacoes(observacoes, "Tipo de Cliente:");
}

/** Nome do cliente com Dr., Dra., Clínica etc. conforme cadastro. */
export function clienteNomeComAbreviacao(cliente: {
  nome: string;
  observacoes?: string | null;
}): string {
  const nome = (cliente.nome || "").trim();
  if (!nome) return "";

  let prefixo = abreviacaoCliente(cliente.observacoes);
  if (!prefixo) {
    const tipo = tipoClienteCadastro(cliente.observacoes);
    if (tipo === "Clínica") prefixo = "Clínica";
  }

  if (!prefixo) return nome;
  if (nome.toLowerCase().startsWith(prefixo.toLowerCase())) return nome;
  return `${prefixo} ${nome}`;
}

/** WhatsApp do cliente na impressão (não lista telefone comercial). */
export function telefoneWhatsappCliente(cliente: {
  celular?: string | null;
  telefone?: string | null;
  observacoes?: string | null;
}): string {
  const waContato = configValueFromObservacoes(
    cliente.observacoes,
    "WhatsApp Contato:"
  );
  if (waContato) return waContato;
  return (cliente.celular || "").trim();
}

const PREFIXO_NASCIMENTO = "Data de Nascimento:";

/** dd/mm ou dd/mm/aaaa */
export function parseDataNascimentoBr(texto: string): {
  day: number;
  month: number;
  year?: number;
} | null {
  const limpo = texto.trim();
  const match = limpo.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return null;
  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  let year: number | undefined;
  if (match[3]) {
    const y = Number.parseInt(match[3], 10);
    year = y < 100 ? 2000 + y : y;
  }
  return { day, month, year };
}

export function dataNascimentoCliente(observacoes: string | null | undefined): string {
  return configValueFromObservacoes(observacoes, PREFIXO_NASCIMENTO);
}

export function clienteAniversarioNoMes(
  observacoes: string | null | undefined,
  mes: number
): boolean {
  const parsed = parseDataNascimentoBr(dataNascimentoCliente(observacoes));
  if (!parsed) return false;
  return parsed.month === mes + 1;
}

export function linhaObservacaoDataNascimento(data: string): string {
  const limpo = data.trim();
  if (!limpo) return "";
  return `${PREFIXO_NASCIMENTO} ${limpo}`;
}

export function mesclarObservacoesComDataNascimento(
  observacoes: string | null | undefined,
  dataNascimento: string
) {
  const linhas = (observacoes || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) => l && !l.toLowerCase().startsWith(PREFIXO_NASCIMENTO.toLowerCase())
    );
  const nova = linhaObservacaoDataNascimento(dataNascimento);
  if (nova) linhas.push(nova);
  return linhas.join("\n");
}
