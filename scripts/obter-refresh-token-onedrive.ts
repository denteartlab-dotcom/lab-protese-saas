/**
 * Gera refresh_token do OneDrive Graph para a conta correta.
 *
 *   npm run uploads:onedrive-token
 *
 * Entre no navegador com: denteartlab@outlook.com
 * (NÃO denteartlabb@outlook.com)
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

/** Aceita code puro ou URL inteira do localhost. */
function extrairCode(entrada: string): string {
  let s = entrada.trim();
  // remove aspas que o PowerShell às vezes cola
  s = s.replace(/^["']|["']$/g, "");
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
  // só o code, sem &...
  return decodeURIComponent(s.split("&")[0] || s);
}

async function trocarCodePorToken(opts: {
  tenant: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  scope: string;
}) {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    code: opts.code,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
    scope: opts.scope,
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(opts.tenant)}/oauth2/v2.0/token`,
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

  return { ok: res.ok && Boolean(json.refresh_token), status: res.status, json };
}

async function main() {
  carregarDotEnv();

  const clientId = process.env.ONEDRIVE_GRAPH_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.ONEDRIVE_GRAPH_CLIENT_SECRET?.trim() || "";
  const redirectUri = "http://localhost";
  const scope = [
    "offline_access",
    "Files.ReadWrite",
    "Files.ReadWrite.All",
    "User.Read",
  ].join(" ");

  if (!clientId || !clientSecret) {
    console.error(
      "Faltam ONEDRIVE_GRAPH_CLIENT_ID / ONEDRIVE_GRAPH_CLIENT_SECRET no .env"
    );
    process.exit(1);
  }

  // Contas @outlook.com: preferir consumers; se der tenant mismatch, tenta common.
  const tenantsParaTentar = ["consumers", "common"];

  console.log(`
============================================================
  REAUTORIZAR ONEDRIVE — conta correta
============================================================
1) Abra o navegador em ABA ANÔNIMA (Ctrl+Shift+N)
2) Cole ESTA URL (tenant = consumers):

https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${encodeURIComponent(scope)}&prompt=login

3) Entre com:  denteartlab@outlook.com
   (NÃO use denteartlabb@outlook.com)
4) Aceite as permissões
5) A página localhost vai falhar — normal.
   Copie a URL INTEIRA da barra (começa com http://localhost/?code=...)
   ou só o valor de code=
============================================================
`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const bruto = await perguntar(rl, "Cole o code ou a URL inteira aqui: ");
  rl.close();

  const code = extrairCode(bruto);
  if (!code || code.length < 20) {
    console.error("Code inválido / vazio. Cole a URL inteira do localhost.");
    process.exit(1);
  }
  console.log(`\nCode recebido (${code.length} chars): ${code.slice(0, 12)}...`);

  let escolhido: { tenant: string; json: { access_token?: string; refresh_token?: string } } | null =
    null;
  let ultimoErro = "";

  // O code só pode ser usado UMA vez. Tentamos consumers primeiro (mesma URL do passo 2).
  for (const tenant of tenantsParaTentar) {
    console.log(`\nTrocando code no tenant "${tenant}"...`);
    const r = await trocarCodePorToken({
      tenant,
      clientId,
      clientSecret,
      code,
      redirectUri,
      scope,
    });
    if (r.ok && r.json.refresh_token) {
      escolhido = { tenant, json: r.json };
      break;
    }
    ultimoErro = r.json.error_description || r.json.error || `HTTP ${r.status}`;
    console.warn(`  falhou: ${ultimoErro.slice(0, 200)}`);
    // Code já foi consumido no 1º attempt se Microsoft aceitou parcialmente —
    // se for "different tenant", o code ainda pode valer no outro endpoint.
    if (!/different tenant|AADSTS700012/i.test(ultimoErro) && tenantsParaTentar.indexOf(tenant) === 0) {
      // outros erros (code expirado/usado) — não adianta tentar common com o mesmo code
      if (/invalid_grant|AADSTS70000|expired|already redeemed/i.test(ultimoErro)) {
        break;
      }
    }
  }

  if (!escolhido?.json.refresh_token) {
    console.error(`
FALHOU: ${ultimoErro}

O que fazer:
1) Gere um CODE NOVO (aba anônima de novo) com a URL consumers acima
2) Cole a URL INTEIRA do localhost neste script
3) Se ainda falhar com "different tenant", no portal Azure:
   App → Autenticação → tipos de conta = "Contas pessoais da Microsoft"
   e use sempre /consumers/ na URL
`);
    process.exit(1);
  }

  const access = escolhido.json.access_token!;
  const refresh = escolhido.json.refresh_token!;
  const tenant = escolhido.tenant;

  const meRes = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName",
    { headers: { Authorization: `Bearer ${access}` } }
  );
  const me = (await meRes.json()) as {
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  };
  const email = me.mail || me.userPrincipalName || "?";

  console.log(`
============================================================
Tenant usado: ${tenant}
Conta do token: ${me.displayName || "?"} <${email}>
============================================================
`);

  if (!/^denteartlab@outlook\.com$/i.test(email.replace(/#.*/, ""))) {
    console.warn(
      "ATENÇÃO: e-mail NÃO é denteartlab@outlook.com.\n" +
        "Refaça em aba anônima com a conta correta.\n"
    );
  } else {
    console.log("OK — conta correta (denteartlab@outlook.com).\n");
  }

  console.log("Cole no .env da VPS (substitua as linhas antigas):\n");
  console.log(`ONEDRIVE_GRAPH_REFRESH_TOKEN=${refresh}`);
  console.log(`ONEDRIVE_GRAPH_TENANT_ID=${tenant}`);
  console.log(`ONEDRIVE_GRAPH_ROOT_FOLDER=Documents/Lab_Protese_Backups`);
  console.log(`
Na VPS:
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
