const CODIGOS_CONEXAO = new Set(["P1000", "P1001", "P1002", "P1017", "P2024"]);

const PADROES_MSG = [
  /can't reach database server/i,
  /connection terminated/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /ETIMEDOUT/i,
  /Connection pool timeout/i,
  /Server has closed the connection/i,
];

function mensagemErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === "string") return erro;
  if (erro && typeof erro === "object" && "message" in erro) {
    return String((erro as { message?: unknown }).message ?? "");
  }
  return "";
}

function codigoErro(erro: unknown): string {
  if (erro && typeof erro === "object" && "code" in erro) {
    return String((erro as { code?: unknown }).code ?? "");
  }
  return "";
}

/** Erro de indisponibilidade / conexão com PostgreSQL (Prisma P1001 etc.). */
export function isErroConexaoBanco(erro: unknown): boolean {
  const code = codigoErro(erro);
  if (CODIGOS_CONEXAO.has(code)) return true;
  const msg = mensagemErro(erro);
  return PADROES_MSG.some((re) => re.test(msg));
}
