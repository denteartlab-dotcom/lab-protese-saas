#!/usr/bin/env node
/**
 * Pausa tentativas de pareamento WhatsApp (use quando aparecer
 * "não é possível conectar novos dispositivos no momento").
 * Uso: npm run whatsapp:pausar [horas]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const horas = Math.max(1, Number(process.argv[2] || 24));
const dataDir = path.join(root, "data");
const cooldownFile = path.join(dataDir, "whatsapp-pairing-cooldown.json");

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
const port = env.WHATSAPP_BAILEYS_PORT || "3100";
const token = env.WHATSAPP_HTTP_TOKEN || "";
const headers = { "Content-Type": "application/json" };
if (token) headers.Authorization = `Bearer ${token}`;

const until = new Date(Date.now() + horas * 60 * 60 * 1000).toISOString();
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(
  cooldownFile,
  JSON.stringify(
    {
      until,
      reason: "bloqueio-whatsapp-manual",
      at: new Date().toISOString(),
      horas,
    },
    null,
    2
  )
);

console.log("\n=== Pareamento WhatsApp PAUSADO ===\n");
console.log(`Cooldown: ${horas}h (até ${new Date(until).toLocaleString("pt-BR")})`);
console.log("\nO serviço NÃO vai gerar QR até o prazo acabar.");
console.log("No celular: WhatsApp → Aparelhos conectados → remova sessões antigas.");
console.log("Aguarde o prazo antes de tentar de novo.\n");

try {
  await fetch(`http://127.0.0.1:${port}/pause-pairing`, {
    method: "POST",
    headers,
    body: JSON.stringify({ horas }),
    signal: AbortSignal.timeout(5000),
  });
  console.log("Baileys notificado ✓");
} catch {
  console.log("Reinicie o Baileys: pm2 restart lab-protese-whatsapp");
}

console.log("\nPara liberar antes do prazo: npm run whatsapp:liberar\n");
