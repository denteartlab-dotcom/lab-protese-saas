/** Em produção, webhooks sem secret/token configurado devem ser rejeitados. */
export function webhookAceitaSemSegredo(): boolean {
  return process.env.NODE_ENV !== "production";
}
