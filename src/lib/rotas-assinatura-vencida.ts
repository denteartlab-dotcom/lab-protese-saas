export const ROTAS_LIBERADAS_ASSINATURA_VENCIDA = [
  "/assinatura-vencida",
  "/pagamento",
  "/suporte",
  "/logout",
] as const;

export const APIS_LIBERADAS_ASSINATURA_VENCIDA = [
  "/api/assinatura/pix",
  "/api/assinatura/status",
  "/api/jobs",
  "/api/auth/logout",
] as const;

export function rotaLiberadaAssinaturaVencida(pathname: string): boolean {
  return ROTAS_LIBERADAS_ASSINATURA_VENCIDA.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`)
  );
}

export function apiLiberadaAssinaturaVencida(pathname: string): boolean {
  return APIS_LIBERADAS_ASSINATURA_VENCIDA.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`)
  );
}
