import type { ExtratoMovimentacao } from "@/lib/extrato-bancario";

export type DadosContaOfx = {
  nomeTitular: string;
  codBanco: string;
  agencia: string;
  numeroConta: string;
  saldo: number;
};

export type MovimentacaoOfx = {
  id: string;
  data: string;
  descricao: string;
  forma: string;
  valor: number;
  tipo: "credito" | "debito";
  tipoBadge: "CREDIT" | "DEBIT";
  trntype: string;
  fitid?: string;
  contaBanco?: string;
  contaAgencia?: string;
  contaNumero?: string;
};

export type OfxParseResult = {
  dadosConta: DadosContaOfx;
  movimentacoes: MovimentacaoOfx[];
};

function tagOfx(conteudo: string, nome: string) {
  const re = new RegExp(`<${nome}>([^<\\r\\n]+)`, "i");
  return conteudo.match(re)?.[1]?.trim() ?? "";
}

function parseOfxDate(raw: string) {
  const limpo = raw.trim().slice(0, 8);
  if (limpo.length !== 8) return new Date().toISOString();
  const y = Number(limpo.slice(0, 4));
  const m = Number(limpo.slice(4, 6)) - 1;
  const d = Number(limpo.slice(6, 8));
  return new Date(y, m, d, 12).toISOString();
}

function parseOfxAmountSigned(raw: string) {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function normalizarDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

function inferirForma(memo: string, checknum: string, trntype: string, fitid?: string) {
  const upper = memo.toUpperCase();
  if (upper.includes("PIX")) return "PIX";
  if (checknum.trim()) return checknum.trim();
  if (fitid?.trim()) return fitid.trim();
  if (upper.includes("TED")) return "TED";
  if (upper.includes("DOC")) return "DOC";
  if (upper.includes("BOLETO")) return "Boleto";
  if (trntype === "CREDIT" || trntype === "DEP") return "Crédito";
  if (trntype === "DEBIT" || trntype === "PAYMENT" || trntype === "XFER") return "Débito";
  return trntype || "—";
}

function extrairSaldoOfx(conteudo: string) {
  const ledger = conteudo.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<]+)/i);
  if (ledger?.[1]) return Math.abs(parseOfxAmountSigned(ledger[1]));
  const avail = conteudo.match(/<AVAILBAL>[\s\S]*?<BALAMT>([^<]+)/i);
  if (avail?.[1]) return Math.abs(parseOfxAmountSigned(avail[1]));
  return 0;
}

function extrairDadosContaOfx(conteudo: string): DadosContaOfx {
  const stmtrs = conteudo.match(/<STMTRS>([\s\S]*?)<\/STMTRS>/i)?.[1] ?? conteudo;
  const bankFrom =
    stmtrs.match(/<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i)?.[1] ??
    conteudo.match(/<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i)?.[1] ??
    conteudo;
  const codBanco =
    tagOfx(bankFrom, "BANKID") ||
    tagOfx(stmtrs, "BANKID") ||
    tagOfx(conteudo, "BANKID") ||
    tagOfx(conteudo, "INTU.BID");
  const agencia =
    tagOfx(bankFrom, "BRANCHID") ||
    tagOfx(stmtrs, "BRANCHID") ||
    tagOfx(conteudo, "BRANCHID");
  const numeroConta =
    tagOfx(bankFrom, "ACCTID") ||
    tagOfx(stmtrs, "ACCTID") ||
    tagOfx(conteudo, "ACCTID");
  const nomeTitular =
    tagOfx(stmtrs, "ACCTNAME") ||
    tagOfx(bankFrom, "ACCTNAME") ||
    tagOfx(conteudo, "ORG") ||
    tagOfx(conteudo, "ACCTNAME") ||
    tagOfx(conteudo, "DESC");

  return {
    nomeTitular,
    codBanco,
    agencia,
    numeroConta,
    saldo: extrairSaldoOfx(conteudo),
  };
}

function blocoContaDoStmt(bloco: string) {
  const bankFrom = bloco.match(/<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i)?.[1];
  if (!bankFrom) return {};
  return {
    contaBanco: tagOfx(bankFrom, "BANKID"),
    contaAgencia: tagOfx(bankFrom, "BRANCHID"),
    contaNumero: tagOfx(bankFrom, "ACCTID"),
  };
}

/** Leitura completa do OFX — dados da conta e movimentações (créditos/débitos). */
export function parseOfxArquivo(conteudo: string): OfxParseResult {
  const dadosConta = extrairDadosContaOfx(conteudo);
  const movimentacoes: MovimentacaoOfx[] = [];

  const stmtBlocks = conteudo.split(/<STMTRS>/i).slice(1);
  const blocosTransacao =
    stmtBlocks.length > 0
      ? stmtBlocks.flatMap((stmt) => {
          const contaInfo = blocoContaDoStmt(stmt);
          return stmt
            .split(/<STMTTRN>/i)
            .slice(1)
            .map((bloco) => ({ bloco, contaInfo }));
        })
      : conteudo.split(/<STMTTRN>/i).slice(1).map((bloco) => ({ bloco, contaInfo: {} }));

  for (const { bloco, contaInfo } of blocosTransacao) {
    const trntype = bloco.match(/<TRNTYPE>([^<]+)/i)?.[1]?.trim().toUpperCase() ?? "";
    const dtposted = bloco.match(/<DTPOSTED>([^<]+)/i)?.[1]?.trim() ?? "";
    const trnamt = bloco.match(/<TRNAMT>([^<]+)/i)?.[1]?.trim();
    const memo =
      bloco.match(/<MEMO>([^<]+)/i)?.[1]?.trim() ||
      bloco.match(/<NAME>([^<]+)/i)?.[1]?.trim() ||
      "Movimentação";
    const checknum = bloco.match(/<CHECKNUM>([^<]+)/i)?.[1]?.trim() ?? "";
    const fitid = bloco.match(/<FITID>([^<]+)/i)?.[1]?.trim();

    if (!trnamt) continue;
    const valorAssinado = parseOfxAmountSigned(trnamt);
    const valor = Math.abs(valorAssinado);
    if (valor <= 0) continue;

    const credito =
      valorAssinado > 0 ||
      trntype === "CREDIT" ||
      trntype === "DEP" ||
      trntype === "INT";

    movimentacoes.push({
      id: fitid || `ofx-${dtposted}-${trnamt}-${movimentacoes.length}`,
      data: parseOfxDate(dtposted),
      descricao: memo,
      forma: inferirForma(memo, checknum, trntype, fitid),
      valor,
      tipo: credito ? "credito" : "debito",
      tipoBadge: credito ? "CREDIT" : "DEBIT",
      trntype,
      fitid,
      ...contaInfo,
    });
  }

  movimentacoes.sort(
    (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
  );

  return { dadosConta, movimentacoes };
}

export function resumirDescricaoOfx(descricao: string) {
  const limpa = descricao.replace(/\s+/g, " ").trim();
  if (limpa.length <= 48) return limpa;
  return `${limpa.slice(0, 45)}...`;
}

export function movimentacoesOfxParaExtrato(
  movs: MovimentacaoOfx[],
  contaId: string
): ExtratoMovimentacao[] {
  return movs.map((m, i) => ({
    id: `ofx-${contaId}-${i}-${Date.now()}`,
    contaId,
    tipo: m.tipo === "credito" ? "entrada" : "saida",
    valor: m.valor,
    descricao: m.descricao,
    data: m.data,
    origem: "arquivo" as const,
    idExterno: m.fitid || m.id,
  }));
}

/** Parser simplificado de OFX (extrato bancário). */
export function parseOfxExtrato(
  conteudo: string,
  contaId: string
): ExtratoMovimentacao[] {
  return movimentacoesOfxParaExtrato(parseOfxArquivo(conteudo).movimentacoes, contaId);
}

/** CSV: data;descricao;valor (valor negativo = saída). */
export function parseCsvExtrato(
  conteudo: string,
  contaId: string
): ExtratoMovimentacao[] {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) return [];
  const sep = linhas[0].includes(";") ? ";" : ",";
  const movs: ExtratoMovimentacao[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 3) continue;
    const [dataBr, descricao, valorStr] = cols;
    const valorLimpo = valorStr
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const valorNum = Math.abs(Number(valorLimpo));
    if (!Number.isFinite(valorNum) || valorNum <= 0) continue;

    const partes = dataBr.split(/[/-]/);
    let iso = new Date().toISOString();
    if (partes.length === 3) {
      const [d, m, y] = partes.map(Number);
      if (y && m && d) iso = new Date(y, m - 1, d, 12).toISOString();
    }

    const negativo = valorStr.includes("-") || Number(valorLimpo) < 0;
    movs.push({
      id: `csv-${Date.now()}-${i}`,
      contaId,
      tipo: negativo ? "saida" : "entrada",
      valor: valorNum,
      descricao: descricao || "Movimentação",
      data: iso,
      origem: "arquivo",
      idExterno: `csv-${dataBr}-${valorStr}-${descricao}`.slice(0, 120),
    });
  }

  return movs;
}

export function dadosOfxParaFormCadastro(
  dados: DadosContaOfx
): import("@/lib/conta-bancaria").DadosFormContaBancaria {
  return {
    nome: dados.nomeTitular.trim(),
    codBanco: dados.codBanco,
    agencia: dados.agencia,
    numeroConta: dados.numeroConta,
    tipoChavePix: "",
    chavePix: "",
    saldoInicial: dados.saldo.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    modoVinculo: "extrato_arquivo",
    openFinanceItemId: undefined,
  };
}

export function contaOfxCombina(
  conta: { codBanco?: string; agencia?: string; numeroConta?: string; excluida?: boolean },
  dados: DadosContaOfx
) {
  if (conta.excluida) return false;
  const bancoArq = normalizarDigitos(dados.codBanco);
  const agArq = normalizarDigitos(dados.agencia);
  const numArq = normalizarDigitos(dados.numeroConta);
  if (!bancoArq && !agArq && !numArq) return false;

  const bancoConta = normalizarDigitos(conta.codBanco ?? "");
  const agConta = normalizarDigitos(conta.agencia ?? "");
  const numConta = normalizarDigitos(conta.numeroConta ?? "");

  if (!numArq) return false;

  if (numConta && numArq === numConta) {
    const okBanco = !bancoArq || !bancoConta || bancoArq === bancoConta;
    const okAg = !agArq || !agConta || agArq === agConta;
    return okBanco && okAg;
  }

  return false;
}

export function contaOfxCadastrada(
  contas: { codBanco?: string; agencia?: string; numeroConta?: string; excluida?: boolean }[],
  dados: DadosContaOfx
) {
  return contas.find((c) => contaOfxCombina(c, dados)) ?? null;
}
