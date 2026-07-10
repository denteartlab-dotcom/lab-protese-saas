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
const appPort = String(env.PORT || "3000").trim();
const appBase = `http://127.0.0.1:${appPort}`;
const webhookUrl =
  env.WHATSAPP_WEBHOOK_URL || `${appBase}/api/whatsapp/webhook`;
const phone = process.argv[2]?.replace(/\D/g, "");
const mensagem = process.argv.slice(3).join(" ").trim() || "oi";

if (!phone || phone.length < 12) {
  console.error('\nUso: npm run whatsapp:test-chatbot -- 5531999999999 "oi"\n');
  process.exit(1);
}

const headers = { "Content-Type": "application/json" };
if (token) headers.Authorization = `Bearer ${token}`;

console.log("\n=== Teste webhook chatbot ===\n");
console.log("PORT (.env):", appPort);
console.log("URL:", webhookUrl);
console.log("Telefone:", phone);
console.log("Mensagem:", mensagem);
console.log("Token:", token ? `configurado (${token.length} caracteres)` : "não enviado");

async function verificarApp() {
  try {
    const health = await fetch(`${appBase}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!health.ok) {
      console.error(`\nApp respondeu HTTP ${health.status} em ${appBase}/api/health`);
      console.error("→ Confira PORT no .env e rode: pm2 logs lab-protese --lines 40\n");
      process.exit(1);
    }
    console.log(`\nApp OK em ${appBase}/api/health ✓`);
  } catch {
    console.error(`\nApp OFFLINE em ${appBase} (fetch failed)`);
    console.error("→ PORT no .env deve ser a mesma porta do PM2 (lab-protese).");
    console.error("→ Rode: pm2 restart lab-protese");
    console.error("→ Se alterou código: npm run build && pm2 restart lab-protese\n");
    process.exit(1);
  }

  try {
    const ping = await fetch(webhookUrl, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    const pingBody = await ping.text();
    console.log(`Webhook GET: HTTP ${ping.status}`, pingBody.slice(0, 120));
    if (ping.status === 401) {
      console.error(
        "\n401 no GET — middleware antigo ainda em produção."
      );
      console.error("→ Rode na VPS:\n   git pull\n   npm run build\n   pm2 restart lab-protese lab-protese-whatsapp\n");
      process.exit(1);
    }
    if (!ping.ok) {
      console.error("\nWebhook GET falhou — verifique deploy/build.\n");
      process.exit(1);
    }
  } catch (err) {
    console.error("\nWebhook GET falhou:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

await verificarApp();

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
  console.log("\nWebhook POST: HTTP", res.status);
  console.log(texto);
  if (res.status === 401) {
    console.error(
      "\n401 no POST — WHATSAPP_HTTP_TOKEN diferente entre .env e PM2."
    );
    console.error(
      "→ Deixe vazio nos dois OU use o mesmo valor. Depois: pm2 restart lab-protese lab-protese-whatsapp\n"
    );
  }
  if (!res.ok) process.exit(1);
  console.log("\nSe ok:true e respostasEnviadas>0, confira o WhatsApp de destino.\n");
} catch (err) {
  console.error("\nERRO no POST:", err instanceof Error ? err.message : err);
  process.exit(1);
}
