/**
 * O mapa de cookies do Next guarda um único valor por nome.
 * Host-only e Domain=.denteartlab.com.br precisam de dois Set-Cookie,
 * senão o token antigo continua no navegador e o login volta para /login.
 */

export type OpcoesSetCookie = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
  domain?: string;
};

export function listarValoresCookie(
  cabecalho: string | null | undefined,
  nome: string
): string[] {
  if (!cabecalho) return [];
  const valores: string[] = [];
  for (const parte of cabecalho.split(";")) {
    const pedaco = parte.trim();
    const eq = pedaco.indexOf("=");
    if (eq <= 0) continue;
    if (pedaco.slice(0, eq).trim() !== nome) continue;
    const bruto = pedaco.slice(eq + 1).trim();
    if (!bruto) continue;
    try {
      valores.push(decodeURIComponent(bruto));
    } catch {
      valores.push(bruto);
    }
  }
  return valores;
}

export function serializarSetCookie(
  nome: string,
  valor: string,
  opcoes: OpcoesSetCookie
): string {
  const partes = [`${nome}=${encodeURIComponent(valor)}`, `Path=${opcoes.path || "/"}`];
  if (typeof opcoes.maxAge === "number") partes.push(`Max-Age=${Math.floor(opcoes.maxAge)}`);
  if (opcoes.domain) partes.push(`Domain=${opcoes.domain}`);
  if (opcoes.httpOnly) partes.push("HttpOnly");
  if (opcoes.secure) partes.push("Secure");
  if (opcoes.sameSite) {
    const site = opcoes.sameSite;
    partes.push(`SameSite=${site.charAt(0).toUpperCase()}${site.slice(1)}`);
  }
  return partes.join("; ");
}

function lerSetCookies(headers: Headers): string[] {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const unico = headers.get("set-cookie");
  return unico ? [unico] : [];
}

/** Grava vários Set-Cookie do mesmo nome sem o mapa do Next apagar o anterior. */
export function anexarSetCookiesMesmoNome(
  headers: Headers,
  nome: string,
  linhas: string[]
) {
  const prefixo = `${nome.toLowerCase()}=`;
  const resto = lerSetCookies(headers).filter(
    (linha) => !linha.toLowerCase().startsWith(prefixo)
  );
  headers.delete("set-cookie");
  for (const linha of resto) headers.append("set-cookie", linha);
  for (const linha of linhas) headers.append("set-cookie", linha);
}
