/**
 * Verificação JWT (HS256) só com Web Crypto — segura no Edge Runtime.
 * Evita puxar o pacote `jose` (e o warning de CompressionStream) no middleware.
 */
export type JwtPayloadBasico = Record<string, unknown> & {
  exp?: number;
  id?: string;
};

function base64UrlParaBytes(entrada: string): Uint8Array {
  const pad = entrada.length % 4 === 0 ? "" : "=".repeat(4 - (entrada.length % 4));
  const b64 = (entrada + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Valida assinatura HS256 e expiração (`exp`).
 * Retorna o payload ou null se inválido/expirado.
 */
export async function verificarJwtHs256(
  token: string,
  secret: Uint8Array
): Promise<JwtPayloadBasico | null> {
  try {
    const partes = token.split(".");
    if (partes.length !== 3) return null;
    const [headerB64, payloadB64, assinaturaB64] = partes;
    if (!headerB64 || !payloadB64 || !assinaturaB64) return null;

    const headerJson = new TextDecoder().decode(base64UrlParaBytes(headerB64));
    const header = JSON.parse(headerJson) as { alg?: string };
    if (header.alg !== "HS256") return null;

    const dados = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const assinatura = base64UrlParaBytes(assinaturaB64);
    const key = await crypto.subtle.importKey(
      "raw",
      secret,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify("HMAC", key, assinatura, dados);
    if (!ok) return null;

    const payloadJson = new TextDecoder().decode(base64UrlParaBytes(payloadB64));
    const payload = JSON.parse(payloadJson) as JwtPayloadBasico;
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
