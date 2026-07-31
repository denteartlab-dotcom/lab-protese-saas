/**
 * Testa OneDrive Graph: mostra a conta, lista a raiz e grava um arquivo de prova.
 *
 *   npx tsx scripts/testar-onedrive-upload.ts
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import {
  caminhoRemotoEmpresaUploads,
  downloadBytesOneDriveGraph,
  listarRaizOneDriveGraph,
  onedriveGraphConfigurado,
  onedriveGraphRootFolder,
  quemSouOneDriveGraph,
  uploadBytesOneDriveGraph,
} from "../src/lib/onedrive-graph";
import { uploadUsaOneDrive } from "../src/lib/upload-onedrive-storage";

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
    if (chave) process.env[chave] = valor;
  }
}

async function main() {
  carregarDotEnv();

  console.log("UPLOAD_STORAGE =", process.env.UPLOAD_STORAGE || "(vazio)");
  console.log("uploadUsaOneDrive() =", uploadUsaOneDrive());
  console.log("graphConfigurado =", onedriveGraphConfigurado());
  console.log("rootFolder =", onedriveGraphRootFolder());
  console.log("tenant =", process.env.ONEDRIVE_GRAPH_TENANT_ID || "consumers");

  if (!uploadUsaOneDrive() || !onedriveGraphConfigurado()) {
    console.error(
      "\nERRO: UPLOAD_STORAGE não é onedrive. Deixe só UPLOAD_STORAGE=onedrive no .env e rode:\npm2 startOrReload deploy/ecosystem.config.cjs --update-env"
    );
    process.exit(1);
  }
  if (!onedriveGraphConfigurado()) {
    console.error("\nERRO: faltam variáveis ONEDRIVE_GRAPH_*");
    process.exit(1);
  }

  const eu = await quemSouOneDriveGraph();
  console.log("\nConta OneDrive autenticada:");
  console.log("  nome =", eu.displayName || "?");
  console.log("  email =", eu.mail || eu.userPrincipalName || "?");

  console.log("\nPastas na raiz deste OneDrive:");
  const raiz = await listarRaizOneDriveGraph();
  for (const item of raiz) {
    console.log(`  - ${item.folder ? "[pasta]" : "[arq]"} ${item.name}`);
  }

  const remotePath = caminhoRemotoEmpresaUploads(
    "denteart-1",
    "os",
    `prova-${Date.now()}.txt`
  );
  const conteudo = Buffer.from(`prova onedrive ${new Date().toISOString()}\n`, "utf8");
  console.log("\nEnviando:", remotePath);
  const meta = await uploadBytesOneDriveGraph(remotePath, conteudo, "text/plain");
  const voltou = await downloadBytesOneDriveGraph(remotePath);
  console.log("Download OK:", voltou.toString("utf8").trim());
  if (meta?.webUrl) {
    console.log("\nAbra este link no navegador:");
    console.log(meta.webUrl);
  }
  console.log(
    `\nProcure em: ${onedriveGraphRootFolder()}/denteart-1/uploads/os/`
  );
}

main().catch((err) => {
  console.error("\nFALHOU:", err instanceof Error ? err.message : err);
  process.exit(1);
});
