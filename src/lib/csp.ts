/**
 * Content-Security-Policy com nonce por request (sem unsafe-inline em scripts).
 * style-src mantém unsafe-inline (necessário para Next/CSS-in-JS).
 */

export function gerarNonceCsp(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin);
}

export function montarContentSecurityPolicy(nonce: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const scriptSrc = isProd
    ? `script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com`
    : `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://static.cloudflareinsights.com`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' blob: data:",
    "child-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'self' blob: data:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
