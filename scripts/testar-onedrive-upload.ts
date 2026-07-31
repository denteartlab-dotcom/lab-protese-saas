/**
 * Testa OneDrive Graph: mostra a conta, lista pastas e grava prova na pasta VISÍVEL.
 *
 *   npx tsx scripts/testar-onedrive-upload.ts
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import {
  caminhoRemotoEmpresaUploads,
  downloadBytesOneDriveGraph,
  listarPastaOneDriveGraph,
  listarRaizOneDriveGraph,
  onedriveGraphConfigurado,
  onedriveGraphRootFolder,
  quemSouOneDriveGraph,
  resolverPastaRaizOneDriveGraph,
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
  console.log("tenant =", process.env.ONEDRIVE_GRAPH_TENANT_ID || "consumers");

  if (!uploadUsaOneDrive() || !onedriveGraphConfigurado()) {
    console.error(
      "\nERRO: OneDrive Graph não está ativo.\n" +
        "- Confirme ONEDRIVE_GRAPH_CLIENT_ID / SECRET / REFRESH_TOKEN\n" +
        "- Na VPS: bash scripts/corrigir-env-onedrive-vps.sh"
    );
    process.exit(1);
  }

  const eu = await quemSouOneDriveGraph();
  console.log("\nConta OneDrive autenticada:");
  console.log("  nome =", eu.displayName || "?");
  console.log("  email =", eu.mail || eu.userPrincipalName || "?");

  console.log("\nPastas na RAIZ do drive:");
  const raiz = await listarRaizOneDriveGraph();
  for (const item of raiz) {
    console.log(`  - ${item.folder ? "[pasta]" : "[arq]"} ${item.name}`);
  }

  const root = await resolverPastaRaizOneDriveGraph();
  console.log("\nPasta-base resolvida =", root);
  console.log("onedriveGraphRootFolder() =", onedriveGraphRootFolder());

  console.log(`\nConteúdo de ${root}:`);
  const filhos = await listarPastaOneDriveGraph(root);
  if (!filhos.length) {
    console.log("  (vazia ou ainda sem subpastas)");
  } else {
    for (const item of filhos) {
      console.log(`  - ${item.folder ? "[pasta]" : "[arq]"} ${item.name}`);
    }
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

  console.log(`\nConteúdo de ${root} DEPOIS do upload:`);
  const depois = await listarPastaOneDriveGraph(root);
  for (const item of depois) {
    console.log(`  - ${item.folder ? "[pasta]" : "[arq]"} ${item.name}`);
  }

  if (meta?.webUrl) {
    console.log("\nAbra este link no navegador:");
    console.log(meta.webUrl);
  }
  console.log(`\nNo OneDrive web procure:\n  Meus arquivos > Documents > Lab_Protese_Backups > denteart-1 > uploads > os`);
  console.log(`  (ou ${root}/denteart-1/uploads/os/)`);
}

main().catch((err) => {
  console.error("\nFALHOU:", err instanceof Error ? err.message : err);
  process.exit(1);
});
