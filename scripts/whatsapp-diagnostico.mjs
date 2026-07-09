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

function headersComToken(token) {
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

const env = lerEnv();
const token = env.WHATSAPP_HTTP_TOKEN || "";

console.log("\n=== Diagnóstico WhatsApp Baileys ===\n");

console.log("1. Variáveis .env:");
console.log("   WHATSAPP_HTTP_URL =", env.WHATSAPP_HTTP_URL || "(não definido — usa porta 3100)");
console.log("   WHATSAPP_HTTP_TOKEN =", token ? "(definido)" : "(vazio — ok)");
console.log("   WHATSAPP_BAILEYS_PORT =", env.WHATSAPP_BAILEYS_PORT || "3100");

try {
  const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(4000) });
  console.log("\n2. Health:", health.ok ? "OK ✓" : `FALHOU (${health.status})`);
} catch {
  console.log("\n2. Health: OFFLINE ✗");
  console.log("   → Rode: pm2 restart lab-protese-whatsapp");
  process.exit(1);
}

try {
  const res = await fetch(`${base}/status`, { signal: AbortSignal.timeout(4000) });
  const data = await res.json();
  console.log("\n3. Status Baileys:");
  console.log("   connected:", data.connected);
  console.log("   qr:", data.qr ? "SIM (disponível)" : "não");
  console.log("   phone:", data.phone || "—");
  console.log("   hasSocket:", data.hasSocket);
  console.log("   iniciando:", data.iniciando);
  console.log("   authDir:", data.authDir);

  if (!data.connected && !data.qr && !data.iniciando && !data.hasSocket) {
    console.log("\n4. Gerando QR (reconnect suave)… aguarde até 55s");
    const recon = await fetch(`${base}/reconnect`, {
      method: "POST",
      headers: headersComToken(token),
      body: JSON.stringify({ limparAuth: false }),
      signal: AbortSignal.timeout(55_000),
    });
    const body = await recon.json();
    if (recon.status === 401) {
      console.log("   ERRO 401 — token inválido. WHATSAPP_HTTP_TOKEN deve ser igual no .env.");
    } else if (body.qr) {
      console.log("   QR GERADO ✓ — escaneie no celular (Aparelhos conectados).");
    } else if (body.connected) {
      console.log("   Já conectado ✓");
    } else {
      console.log("   Sem QR — tentando limpar sessão antiga…");
      const recon2 = await fetch(`${base}/reconnect`, {
        method: "POST",
        headers: headersComToken(token),
        body: JSON.stringify({ limparAuth: true }),
        signal: AbortSignal.timeout(55_000),
      });
      const body2 = await recon2.json();
      if (body2.qr) {
        console.log("   QR GERADO ✓ após limpar sessão.");
      } else {
        console.log("   Sem QR após 55s ✗");
        console.log("   → pm2 logs lab-protese-whatsapp --lines 40");
      }
    }
  } else if (!data.connected && !data.qr) {
    console.log("\n4. Baileys iniciando — aguarde ~30s antes de gerar novo QR.");
  } else {
    console.log("\n4. QR/conexão OK — não precisa reconectar.");
  }
} catch (e) {
  console.log("\n3. Erro:", e.message);
}

console.log("\n=== Fim ===\n");
