/** PM2 — tempo real do módulo TV. Usa server empacotado no build (sem esbuild no start). */
const fs = require("fs");
const path = require("path");

const appDir = process.env.APP_DIR || "/opt/lab-protese-saas";

/** Carrega .env do projeto para o processo PM2 (RESEND_API_KEY, JWT_SECRET, etc.). */
function carregarEnvArquivo(envPath) {
  const vars = {};
  if (!fs.existsSync(envPath)) return vars;

  const conteudo = fs.readFileSync(envPath, "utf8");
  for (const linha of conteudo.split("\n")) {
    const trimmed = linha.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const igual = trimmed.indexOf("=");
    if (igual === -1) continue;

    const chave = trimmed.slice(0, igual).trim();
    let valor = trimmed.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (chave) vars[chave] = valor;
  }
  return vars;
}

const envArquivo = carregarEnvArquivo(path.join(appDir, ".env"));

module.exports = {
  apps: [
    {
      name: "lab-protese",
      cwd: appDir,
      script: ".next/dev-server.cjs",
      interpreter: "node",
      env: {
        ...envArquivo,
        NODE_ENV: "production",
        NODE_OPTIONS:
          envArquivo.NODE_OPTIONS || "--max-old-space-size=4096",
        PORT: envArquivo.PORT || "3000",
        HOSTNAME: envArquivo.HOSTNAME || "0.0.0.0",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      wait_ready: true,
      listen_timeout: 120_000,
      kill_timeout: 10_000,
      min_uptime: 10_000,
      restart_delay: 3_000,
      max_restarts: 20,
      exp_backoff_restart_delay: 200,
      max_memory_restart: "3600M",
      time: true,
    },
    {
      name: "lab-protese-whatsapp",
      cwd: appDir,
      script: "scripts/whatsapp-baileys-server.mjs",
      interpreter: "node",
      env: {
        ...envArquivo,
        NODE_ENV: "production",
        WHATSAPP_BAILEYS_PORT: envArquivo.WHATSAPP_BAILEYS_PORT || "3100",
        WHATSAPP_HTTP_TOKEN: envArquivo.WHATSAPP_HTTP_TOKEN || "",
        WHATSAPP_AUTH_DIR:
          envArquivo.WHATSAPP_AUTH_DIR ||
          path.join(appDir, "data", "whatsapp-auth"),
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      min_uptime: 10_000,
      restart_delay: 5_000,
      max_restarts: 30,
      exp_backoff_restart_delay: 500,
      max_memory_restart: "512M",
      time: true,
    },
  ],
};
