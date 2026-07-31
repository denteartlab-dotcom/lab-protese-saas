/**
 * Gera um novo refresh_token do OneDrive Graph para a conta CORRETA.
 *
 * Uso (no Windows, PowerShell ou na VPS):
 *   npx tsx scripts/obter-refresh-token-onedrive.ts
 *
 * IMPORTANTE: no navegador, entre com denteartlab@outlook.com
 * (não denteartlabb@outlook.com).
 */
import { createInterface } from "readline";
import { readFileSync, existsSync } from "fs";
import path from "path";

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

async function main() {
  carregarDotEnv();

  const clientId = process.env.ONEDRIVE_GRAPH_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.ONEDRIVE_GRAPH_CLIENT_SECRET?.trim() || "";
  const tenant = process.env.ONEDRIVE_GRAPH_TENANT_ID?.trim() || "consumers";
  const redirectUri = "http://localhost";

  if (!clientId || !clientSecret) {
    console.error(
      "Faltam ONEDRIVE_GRAPH_CLIENT_ID / ONEDRIVE_GRAPH_CLIENT_SECRET no .env"
    );
    process.exit(1);
  }

  const scope = [
    "offline_access",
    "Files.ReadWrite",
    "Files.ReadWrite.All",
    "User.Read",
  ].join(" ");

  const authUrl =
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_mode=query` +
    `&scope=${encodeURIComponent(scope)}` +
    `&prompt=login`;

  console.log(`
============================================================
  REAUTORIZAR ONEDRIVE — conta correta
============================================================
1) Abra o navegador em ABA ANÔNIMA (Ctrl+Shift+N)
2) Cole esta URL:

${authUrl}

3) Entre com:  denteartlab@outlook.com
   (NÃO use denteartlabb@outlook.com)
4) Aceite as permissões
5) A página vai falhar em localhost — tudo bem.
   Copie da barra de endereço o valor de code=........
   (só o código, até antes de &session_state se houver)
============================================================
`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = await perguntar(rl, "Cole o code aqui: ");
  rl.close();

  if (!code) {
    console.error("Code vazio.");
    process.exit(1);
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope,
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.refresh_token) {
    console.error("\nFALHOU:", json.error_description || json.error || res.status);
    process.exit(1);
  }

  // Confirma a conta do token
  const meRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  const me = (await meRes.json()) as {
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  };
  const email = me.mail || me.userPrincipalName || "?";

  console.log(`
============================================================
Conta do token: ${me.displayName || "?"} <${email}>
============================================================
`);

  if (!/denteartlab@outlook\.com/i.test(email) || /denteartlabb@/i.test(email)) {
    console.warn(
      "ATENÇÃO: o e-mail NÃO é denteartlab@outlook.com.\n" +
        "Refaça o login na aba anônima com a conta correta.\n"
    );
  } else {
    console.log("OK — conta correta.\n");
  }

  console.log("Cole isto no .env da VPS (substitua a linha antiga):\n");
  console.log(`ONEDRIVE_GRAPH_REFRESH_TOKEN=${json.refresh_token}`);
  console.log(`ONEDRIVE_GRAPH_TENANT_ID=${tenant}`);
  console.log(`ONEDRIVE_GRAPH_ROOT_FOLDER=Documents/Lab_Protese_Backups`);
  console.log(`
Depois na VPS:
  nano /opt/lab-protese-saas/.env
  pm2 startOrReload deploy/ecosystem.config.cjs --update-env
  pm2 save
  npm run uploads:testar-onedrive
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
