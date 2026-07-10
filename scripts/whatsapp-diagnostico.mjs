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

async function mostrarQr(qr) {
  if (!qr) return;
  try {
    const QRCode = (await import("qrcode")).default;
    const arquivo = path.join(root, "data", "whatsapp-qr.png");
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    await QRCode.toFile(arquivo, qr, { width: 512, margin: 2 });
    console.log("\n   QR salvo em:", arquivo);
    console.log("   (Baixe pelo SFTP ou abra Disparos WhatsApp no sistema)\n");
    const ascii = await QRCode.toString(qr, { type: "terminal", small: true });
    console.log(ascii);
  } catch (err) {
    console.log("   (Não foi possível renderizar QR no terminal:", err instanceof Error ? err.message : err, ")");
  }
}

async function buscarStatus() {
  const res = await fetch(`${base}/status`, { signal: AbortSignal.timeout(4000) });
  return res.json();
}

async function reconectar(opts = {}) {
  const res = await fetch(`${base}/reconnect`, {
    method: "POST",
    headers: headersComToken(token),
    body: JSON.stringify(opts),
    signal: AbortSignal.timeout(55_000),
  });
  const body = await res.json();
  return { res, body };
}

const env = lerEnv();
const token = env.WHATSAPP_HTTP_TOKEN || "";
const appPort = env.PORT || "3000";
const baileysPort = env.WHATSAPP_BAILEYS_PORT || "3100";

function portaDeUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.port) return Number(parsed.port);
    return parsed.protocol === "https:" ? 443 : 80;
  } catch {
    return null;
  }
}

function sanitizarWebhookUrl(url) {
  const candidata = url || `http://127.0.0.1:${appPort}/api/whatsapp/webhook`;
  const porta = portaDeUrl(candidata);
  if (porta === Number(baileysPort)) {
    return {
      url: `http://127.0.0.1:${appPort}/api/whatsapp/webhook`,
      corrigida: true,
      original: candidata,
    };
  }
  return { url: candidata, corrigida: false, original: candidata };
}

const webhookInfo = sanitizarWebhookUrl(env.WHATSAPP_WEBHOOK_URL);
const webhookUrl = webhookInfo.url;

console.log("\n=== Diagnóstico WhatsApp ===\n");

console.log("1. Variáveis .env:");
console.log("   WHATSAPP_CHATBOT_PROVIDER =", env.WHATSAPP_CHATBOT_PROVIDER || "(auto — cloud se token Meta definido)");
console.log("   WHATSAPP_CLOUD_TOKEN =", env.WHATSAPP_CLOUD_TOKEN ? "(definido)" : "(vazio)");
console.log("   WHATSAPP_PHONE_NUMBER_ID =", env.WHATSAPP_PHONE_NUMBER_ID || "(vazio)");
console.log("   WHATSAPP_VERIFY_TOKEN =", env.WHATSAPP_VERIFY_TOKEN ? "(definido)" : "(vazio — necessário para webhook Meta)");
console.log("   WHATSAPP_APP_SECRET =", env.WHATSAPP_APP_SECRET ? "(definido)" : "(vazio — recomendado)");
console.log("   WHATSAPP_EMPRESA_ID =", env.WHATSAPP_EMPRESA_ID || "(vazio — use id do laboratório na VPS)");
console.log("   WHATSAPP_HTTP_URL =", env.WHATSAPP_HTTP_URL || "(não definido — usa porta 3100)");
console.log("   WHATSAPP_HTTP_TOKEN =", token ? "(definido)" : "(vazio — ok)");
console.log("   WHATSAPP_BAILEYS_PORT =", env.WHATSAPP_BAILEYS_PORT || "3100");
console.log("   PORT (lab-protese) =", appPort);
console.log("   WHATSAPP_WEBHOOK_URL =", webhookInfo.original);
if (webhookInfo.corrigida) {
  console.log(
    "   ⚠ WHATSAPP_WEBHOOK_URL aponta para a porta do Baileys — use:",
    webhookInfo.url
  );
  console.log("   → Corrija o .env e rode: pm2 restart lab-protese-whatsapp --update-env");
}

const cloudAtivo =
  env.WHATSAPP_CHATBOT_PROVIDER === "cloud" ||
  (env.WHATSAPP_CLOUD_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_CHATBOT_PROVIDER !== "baileys");

if (cloudAtivo) {
  const webhookPublico = env.NEXT_PUBLIC_APP_URL
    ? `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/whatsapp/webhook`
    : `(seu domínio)/api/whatsapp/webhook`;
  console.log("\n   Cloud API (chatbot oficial):");
  console.log("   Webhook Meta →", webhookPublico);
  console.log("   Verify token → mesmo valor de WHATSAPP_VERIFY_TOKEN no painel Meta");
  console.log("   Campo webhook → messages");
  console.log("   Respostas do chatbot: GRÁTIS (cliente manda primeiro, janela 24h)");
}

try {
  const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(4000) });
  console.log("\n2. Health:", health.ok ? "OK ✓" : `FALHOU (${health.status})`);
} catch {
  console.log("\n2. Health: OFFLINE ✗");
  console.log("   → Rode: pm2 restart lab-protese-whatsapp");
  process.exit(1);
}

try {
  let data = await buscarStatus();
  console.log("\n3. Status Baileys:");
  console.log("   connected:", data.connected);
  console.log("   qr:", data.qr ? "SIM (disponível)" : "não");
  console.log("   phone:", data.phone || "—");
  console.log("   hasSocket:", data.hasSocket);
  console.log("   iniciando:", data.iniciando);
  console.log("   authDir:", data.authDir);

  if (data.connected) {
    console.log("\n4. WhatsApp conectado ✓ — pode enviar mensagens.");
    console.log("   Teste: npm run whatsapp:test-envio -- 5531XXXXXXXXX \"Teste\"");
  } else if (data.qr) {
    console.log("\n4. AÇÃO NECESSÁRIA — WhatsApp NÃO conectado (mensagens não serão enviadas).");
    console.log("   Escaneie o QR abaixo no celular:");
    console.log("   WhatsApp → Aparelhos conectados → Conectar dispositivo");
    await mostrarQr(data.qr);
    console.log("   Aguarde até 30s após escanear. Rode este diagnóstico de novo para confirmar connected: true");
  } else if (!data.iniciando && !data.hasSocket) {
    console.log("\n4. Gerando QR (reconnect)… aguarde até 55s");
    const { res: recon, body } = await reconectar({ limparAuth: false });
    if (recon.status === 401) {
      console.log("   ERRO 401 — token inválido. WHATSAPP_HTTP_TOKEN deve ser igual no .env.");
    } else if (body.qr) {
      console.log("   QR GERADO ✓ — escaneie no celular:");
      await mostrarQr(body.qr);
    } else if (body.connected) {
      console.log("   Já conectado ✓");
    } else {
      console.log("   Sem QR — limpando sessão antiga…");
      const { body: body2 } = await reconectar({ limparAuth: true });
      if (body2.qr) {
        console.log("   QR GERADO ✓ após limpar sessão:");
        await mostrarQr(body2.qr);
      } else {
        console.log("   Sem QR após 55s ✗");
        console.log("   → pm2 logs lab-protese-whatsapp --lines 40");
        console.log("   → npm run whatsapp:reset");
      }
    }
  } else if (!data.qr) {
    console.log("\n4. Baileys iniciando — aguarde ~30s e rode de novo:");
    console.log("   npm run whatsapp:diagnostico");
  } else {
    console.log("\n4. WhatsApp desconectado — mensagens NÃO serão enviadas até connected: true.");
  }
} catch (e) {
  console.log("\n3. Erro:", e.message);
}

try {
  const healthApp = await fetch(`http://127.0.0.1:${appPort}/api/health`, {
    signal: AbortSignal.timeout(4000),
  });
  console.log("\n5. App lab-protese:", healthApp.ok ? `OK na porta ${appPort} ✓` : `HTTP ${healthApp.status} ✗`);
} catch {
  console.log(`\n5. App lab-protese: OFFLINE na porta ${appPort} ✗`);
  console.log("   → Confira PORT no .env e pm2 restart lab-protese");
}

try {
  const pingWebhook = await fetch(webhookUrl, { signal: AbortSignal.timeout(4000) });
  const corpo = await pingWebhook.text();
  console.log(
    "6. Webhook chatbot GET:",
    pingWebhook.ok ? `OK (${corpo.slice(0, 80)})` : `HTTP ${pingWebhook.status} ✗`
  );
  if (pingWebhook.status === 401) {
    console.log("   → Middleware antigo. Rode: npm run build && pm2 restart lab-protese");
  }
  if (corpo.includes("Rota não encontrada")) {
    console.log(
      "   ⚠ Resposta do Baileys (porta errada) — WHATSAPP_WEBHOOK_URL deve apontar para porta",
      appPort
    );
    console.log("   → Exemplo: http://127.0.0.1:3000/api/whatsapp/webhook");
    console.log("   → pm2 restart lab-protese-whatsapp --update-env");
  }
} catch {
  console.log("6. Webhook chatbot GET: não alcançou", webhookUrl);
}

try {
  const statusBaileys = await buscarStatus();
  if (statusBaileys.webhookUrl) {
    console.log("\n7. Webhook em uso pelo Baileys:", statusBaileys.webhookUrl);
    if (portaDeUrl(statusBaileys.webhookUrl) === Number(baileysPort)) {
      console.log("   ⚠ Baileys ainda usa porta errada — pm2 restart lab-protese-whatsapp --update-env");
    }
  }
} catch {
  /* ignora */
}

console.log("\n=== Fim ===\n");
