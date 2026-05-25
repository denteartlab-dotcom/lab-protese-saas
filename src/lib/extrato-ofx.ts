import type { ExtratoMovimentacao } from "@/lib/extrato-bancario";

function parseOfxDate(raw: string) {
  const limpo = raw.trim().slice(0, 8);
  if (limpo.length !== 8) return new Date().toISOString();
  const y = Number(limpo.slice(0, 4));
  const m = Number(limpo.slice(4, 6)) - 1;
  const d = Number(limpo.slice(6, 8));
  return new Date(y, m, d, 12).toISOString();
}

function parseOfxAmount(raw: string) {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

/** Parser simplificado de OFX (extrato bancário). */
export function parseOfxExtrato(
  conteudo: string,
  contaId: string
): ExtratoMovimentacao[] {
  const blocos = conteudo.split(/<STMTTRN>/i).slice(1);
  const movs: ExtratoMovimentacao[] = [];

  for (const bloco of blocos) {
    const trntype = bloco.match(/<TRNTYPE>([^<]+)/i)?.[1]?.trim().toUpperCase();
    const dtposted = bloco.match(/<DTPOSTED>([^<]+)/i)?.[1]?.trim();
    const trnamt = bloco.match(/<TRNAMT>([^<]+)/i)?.[1]?.trim();
    const memo =
      bloco.match(/<MEMO>([^<]+)/i)?.[1]?.trim() ||
      bloco.match(/<NAME>([^<]+)/i)?.[1]?.trim() ||
      "Movimentação";

    if (!trnamt) continue;
    const valorNum = parseOfxAmount(trnamt);
    if (valorNum <= 0) continue;

    const credito =
      trntype === "CREDIT" ||
      trntype === "DEP" ||
      Number(trnamt.replace(",", ".")) > 0;

    movs.push({
      id: `ofx-${Date.now()}-${movs.length}`,
      contaId,
      tipo: credito ? "entrada" : "saida",
      valor: valorNum,
      descricao: memo,
      data: parseOfxDate(dtposted || ""),
      origem: "arquivo",
      idExterno: `ofx-${dtposted}-${trnamt}-${memo}`.slice(0, 120),
    });
  }

  return movs;
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
