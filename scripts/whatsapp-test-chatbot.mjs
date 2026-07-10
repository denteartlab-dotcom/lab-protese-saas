#!/usr/bin/env node
/**
 * Testa o webhook do chatbot (sem depender de mensagem real no WhatsApp).
 * Uso: npm run whatsapp:test-chatbot -- 5531999999999 "oi"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function lerEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return {};
  const vars = {};
  for (const linha of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = linha.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    vars[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return vars;
}

const env = { ...lerEnv(), ...process.env };
const token = String(env.WHATSAPP_HTTP_TOKEN || "").trim();
const appPort = env.PORT || "3000";
const webhookUrl =
  env.WHATSAPP_WEBHOOK_URL || `http://127.0.0.1:${appPort}/api/whatsapp/webhook`;
const phone = process.argv[2]?.replace(/\D/g, "");
const mensagem = process.argv.slice(3).join(" ").trim() || "oi";

if (!phone || phone.length < 12) {
  console.error('\nUso: npm run whatsapp:test-chatbot -- 5531999999999 "oi"\n');
  process.exit(1);
}

const headers = { "Content-Type": "application/json" };
if (token) headers.Authorization = `Bearer ${token}`;

console.log("\n=== Teste webhook chatbot ===\n");
console.log("URL:", webhookUrl);
console.log("Telefone:", phone);
console.log("Mensagem:", mensagem);
console.log("Token:", token ? `configurado (${token.length} caracteres)` : "não enviado");

try {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      telefone: phone,
      mensagem,
      messageId: `test-${Date.now()}`,
      numeroConectado: env.WHATSAPP_PAIRING_PHONE || null,
    }),
    signal: AbortSignal.timeout(35_000),
  });
  const texto = await res.text();
  console.log("\nHTTP", res.status);
  console.log(texto);
  if (res.status === 401) {
    console.error(
      "\n401 — Se a mensagem for só \"Não autorizado\", atualize o código (middleware) e reinicie: pm2 restart lab-protese"
    );
    console.error(
      "Se mencionar token, confira WHATSAPP_HTTP_TOKEN igual no .env e no PM2.\n"
    );
  }
  if (!res.ok) process.exit(1);
  console.log("\nSe ok:true e respostasEnviadas>0, confira o WhatsApp de destino.\n");
} catch (err) {
  console.error("\nERRO:", err instanceof Error ? err.message : err);
  console.error("→ O app Next precisa estar rodando (pm2 restart lab-protese ou npm run dev:server)\n");
  process.exit(1);
}
