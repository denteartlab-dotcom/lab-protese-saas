/** Webhooks sem secret/token: rejeitar (fail-closed).
 *  Em desenvolvimento, só libera com WEBHOOK_ALLOW_INSECURE=true. */
export function webhookAceitaSemSegredo(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.WEBHOOK_ALLOW_INSECURE === "true"
  );
}
