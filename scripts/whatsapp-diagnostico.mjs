#!/usr/bin/env node
/**
 * Diagnóstico rápido do WhatsApp Baileys na VPS.
 * Uso: node scripts/whatsapp-diagnostico.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const port = process.env.WHATSAPP_BAILEYS_PORT || "3100";
const base = `http://127.0.0.1:${port}`;

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

const env = lerEnv();
console.log("\n=== Diagnóstico WhatsApp Baileys ===\n");

console.log("1. Variáveis .env:");
console.log("   WHATSAPP_HTTP_URL =", env.WHATSAPP_HTTP_URL || "(não definido — usa porta 3100)");
console.log("   WHATSAPP_HTTP_TOKEN =", env.WHATSAPP_HTTP_TOKEN ? "(definido)" : "(vazio — ok)");
console.log("   WHATSAPP_BAILEYS_PORT =", env.WHATSAPP_BAILEYS_PORT || "3100");

try {
  const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(4000) });
  console.log("\n2. Health:", health.ok ? "OK ✓" : `FALHOU (${health.status})`);
} catch (e) {
  console.log("\n2. Health: OFFLINE ✗");
  console.log("   → Rode: pm2 restart lab-protese-whatsapp");
  console.log("   → Ou: npm run whatsapp:baileys");
  process.exit(1);
}

try {
  const res = await fetch(`${base}/status`, { signal: AbortSignal.timeout(4000) });
  const data = await res.json();
  console.log("\n3. Status Baileys:");
  console.log("   connected:", data.connected);
  console.log("   qr:", data.qr ? "SIM (disponível)" : "não");
  console.log("   phone:", data.phone || "—");
  console.log("   authDir:", data.authDir);
  if (!data.connected && !data.qr) {
    console.log("\n   Para gerar QR: curl -X POST", `${base}/reconnect -H "Content-Type: application/json" -d "{\\"limparAuth\\":true}"`);
  }
} catch (e) {
  console.log("\n3. Status: erro ao consultar", e.message);
}

console.log("\n4. PM2 esperado:");
console.log("   lab-protese (app)");
console.log("   lab-protese-whatsapp (Baileys)");
console.log("\n=== Fim ===\n");
