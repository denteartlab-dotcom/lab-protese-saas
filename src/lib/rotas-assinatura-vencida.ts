export const ROTAS_LIBERADAS_ASSINATURA_VENCIDA = [
  "/assinatura-vencida",
  "/pagamento",
  "/suporte",
] as const;

export function rotaLiberadaAssinaturaVencida(pathname: string): boolean {
  return ROTAS_LIBERADAS_ASSINATURA_VENCIDA.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`)
  );
}
