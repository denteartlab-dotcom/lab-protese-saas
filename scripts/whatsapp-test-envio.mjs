#!/usr/bin/env node
/**
 * Testa envio real pelo Baileys.
 * Uso: npm run whatsapp:test-envio -- 5531999999999 "Mensagem de teste"
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
const token = env.WHATSAPP_HTTP_TOKEN || "";
const phone = process.argv[2]?.replace(/\D/g, "");
const message = process.argv.slice(3).join(" ").trim() || "Teste Lab Prótese — disparo WhatsApp OK.";

if (!phone || phone.length < 12) {
  console.error("\nUso: npm run whatsapp:test-envio -- 5531999999999 \"Sua mensagem\"\n");
  process.exit(1);
}

const headers = { "Content-Type": "application/json" };
if (token) headers.Authorization = `Bearer ${token}`;

console.log("\n=== Teste de envio WhatsApp ===\n");
console.log("Para:", phone);
console.log("Mensagem:", message);

try {
  const statusRes = await fetch(`${base}/status`, { signal: AbortSignal.timeout(5000) });
  const status = await statusRes.json();
  console.log("\nStatus:", status.connected ? "conectado ✓" : "desconectado ✗");
  if (!status.connected) {
    console.log("→ Conecte o WhatsApp antes: npm run whatsapp:diagnostico");
    process.exit(1);
  }
  if (!status.prontoParaEnvio && (status.warmupRestanteSegundos ?? 0) > 0) {
    console.log(`Aguarde ${status.warmupRestanteSegundos}s (aquecimento)…`);
    await new Promise((r) => setTimeout(r, (status.warmupRestanteSegundos + 1) * 1000));
  }

  const verifyRes = await fetch(
    `${base}/verify-phone?phone=${encodeURIComponent(phone)}`,
    { signal: AbortSignal.timeout(20_000) }
  );
  const verify = await verifyRes.json();
  console.log("\nVerificação WhatsApp:", verify.existe ? "número OK ✓" : "número NÃO encontrado ✗");
  if (verify.jids?.length) console.log("JID:", verify.jids.join(", "));
  if (verify.erro) console.log("Detalhe:", verify.erro);
  if (!verify.existe) {
    console.log("→ Corrija o número (DDD + 9 dígitos) antes de enviar.");
    process.exit(1);
  }
} catch (err) {
  console.error("\nBaileys OFFLINE ou erro de status:", err instanceof Error ? err.message : err);
  console.error("Rode: pm2 restart lab-protese-whatsapp\n");
  process.exit(1);
}

try {
  const res = await fetch(`${base}/send`, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone, message }),
    signal: AbortSignal.timeout(75_000),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    console.error("\nFALHOU ✗");
    console.error(data.error || `HTTP ${res.status}`);
    process.exit(1);
  }
  console.log("\nENVIADO ✓");
  console.log("messageId:", data.messageId);
  console.log("jid:", data.jid);
  console.log("ackStatus:", data.ackStatus ?? "—");
  console.log("\nConfira o celular de destino agora.\n");
} catch (err) {
  console.error("\nERRO:", err instanceof Error ? err.message : err);
  process.exit(1);
}
