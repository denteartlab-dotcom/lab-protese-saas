/**
 * Gera refresh_token do Google Drive (OAuth — conta Google pessoal/Workspace).
 *
 *   npm run uploads:gdrive-token
 *
 * Pré-requisitos no Google Cloud Console:
 *   1) Ativar Google Drive API
 *   2) Tela de consentimento OAuth (externo / teste)
 *   3) Credenciais → ID do cliente OAuth → tipo "Aplicativo para computador" (Desktop)
 *   4) Colocar GOOGLE_DRIVE_CLIENT_ID e GOOGLE_DRIVE_CLIENT_SECRET no .env
 *
 * Entre no navegador com a conta Google que TEM ESPAÇO no Drive
 * (a mesma que será dona da pasta GOOGLE_DRIVE_FOLDER_ID).
 */
import { createInterface } from "readline";
import { readFileSync, existsSync, writeFileSync } from "fs";
import path from "path";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const REDIRECT_URI = "http://localhost";

function carregarDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const linha of readFileSync(envPath, "utf8").split("\n")) {
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
    if (chave && process.env[chave] === undefined) process.env[chave] = valor;
  }
}

function perguntar(rl: ReturnType<typeof createInterface>, q: string) {
  return new Promise<string>((resolve) => rl.question(q, (a) => resolve(a.trim())));
}

function extrairCode(entrada: string): string {
  let s = entrada.trim().replace(/^["']|["']$/g, "");
  try {
    if (s.includes("code=")) {
      const u = new URL(s.startsWith("http") ? s : `http://localhost/?${s.replace(/^\?/, "")}`);
      const code = u.searchParams.get("code");
      if (code) return code;
    }
  } catch {
    /* segue */
  }
  const m = s.match(/(?:^|[?&])code=([^&\s#]+)/i);
  if (m?.[1]) return decodeURIComponent(m[1]);
  return decodeURIComponent(s.split("&")[0] || s);
}

async function main() {
  carregarDotEnv();

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim() || "";

  if (!clientId || !clientSecret) {
    console.error(
      "Defina GOOGLE_DRIVE_CLIENT_ID e GOOGLE_DRIVE_CLIENT_SECRET no .env\n" +
        "(Credenciais OAuth tipo Desktop no Google Cloud Console)."
    );
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("\n=== Google Drive OAuth ===\n");
  console.log("1) Abra este link no navegador (conta Google com espaço no Drive):\n");
  console.log(authUrl);
  console.log(
    "\n2) Autorize o app. O navegador vai para http://localhost/?code=...\n" +
      "   (a página pode falhar ao carregar — isso é normal).\n" +
      "3) Copie a URL inteira da barra de endereço OU só o valor de code=.\n"
  );

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const entrada = await perguntar(rl, "Cole a URL ou o code: ");
  rl.close();

  const code = extrairCode(entrada);
  if (!code) {
    console.error("Code vazio.");
    process.exit(1);
  }

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      "Google não devolveu refresh_token.\n" +
        "Revogue o acesso do app em https://myaccount.google.com/permissions e rode de novo\n" +
        "(o script já usa prompt=consent)."
    );
    process.exit(1);
  }

  const arquivoToken = path.join(process.cwd(), ".gdrive-refresh-token");
  writeFileSync(arquivoToken, `${tokens.refresh_token}\n`, { encoding: "utf8", mode: 0o600 });

  console.log("\nOK — refresh_token salvo em .gdrive-refresh-token");
  console.log("\nAdicione também no .env (opcional se o arquivo existir na VPS):\n");
  console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log("\nLembrete:");
  console.log("  UPLOAD_STORAGE=gdrive");
  console.log("  GOOGLE_DRIVE_FOLDER_ID=<id da pasta no Meu Drive desta mesma conta>");
  console.log("  GOOGLE_DRIVE_CLIENT_ID=...");
  console.log("  GOOGLE_DRIVE_CLIENT_SECRET=...");
  console.log("\nReinicie o PM2 depois de copiar o token para a VPS.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
