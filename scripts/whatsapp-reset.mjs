#!/usr/bin/env node
/**
 * Reseta sessão WhatsApp Baileys (use quando QR ficar em loop ou sessão corrompida).
 * Uso na VPS: npm run whatsapp:reset
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
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
const token = env.WHATSAPP_HTTP_TOKEN || "";
const authDir =
  env.WHATSAPP_AUTH_DIR || path.join(root, "data", "whatsapp-auth");

const headers = { "Content-Type": "application/json" };
if (token) headers.Authorization = `Bearer ${token}`;

console.log("\n=== Reset WhatsApp Baileys ===\n");
console.log("Se o celular mostra 'não é possível conectar novos dispositivos',");
console.log("NÃO gere QR agora. Rode: npm run whatsapp:pausar\n");

console.log("1. Limpando pasta de sessão:", authDir);

try {
  fs.rmSync(authDir, { recursive: true, force: true });
  fs.mkdirSync(authDir, { recursive: true });
  console.log("   OK ✓");
} catch (e) {
  console.log("   Erro:", e.message);
}

console.log("\n2. Reiniciando processo PM2 (quebra loop de reconexão)…");
try {
  execSync("pm2 restart lab-protese-whatsapp", { stdio: "inherit", cwd: root });
  console.log("   OK ✓");
} catch {
  console.log("   Rode manualmente: pm2 restart lab-protese-whatsapp");
}

await new Promise((r) => setTimeout(r, 3000));

console.log("\n3. Gerando novo QR via API /reconnect…");
try {
  const res = await fetch(`${base}/reconnect`, {
    method: "POST",
    headers,
    body: JSON.stringify({ limparAuth: true }),
    signal: AbortSignal.timeout(55_000),
  });
  const data = await res.json();
  if (data.connected) {
    console.log("   Conectado ✓", data.phone || "");
  } else if (data.qr) {
    console.log("   QR gerado ✓ — escaneie UMA vez no celular e aguarde 30s.");
  } else if (data.pareamentoEmAndamento) {
    console.log("   Pareamento em andamento — aguarde, não gere novo QR.");
  } else {
    console.log("   Sem QR ainda. Rode: pm2 restart lab-protese-whatsapp");
  }
} catch (e) {
  console.log("   Baileys offline — rode: pm2 restart lab-protese-whatsapp");
  console.log("   Depois: npm run whatsapp:reset");
}

console.log("\n=== Fim ===\n");
