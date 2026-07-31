/**
 * Testa OneDrive Graph: cria pastas do lab + prova de upload.
 *
 *   npx tsx scripts/testar-onedrive-upload.ts
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import {
  caminhoRemotoEmpresaUploads,
  downloadBytesOneDriveGraph,
  garantirEstruturaPastasEmpresaOneDrive,
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

  if (!uploadUsaOneDrive() || !onedriveGraphConfigurado()) {
    console.error("\nERRO: OneDrive Graph não está ativo.");
    process.exit(1);
  }

  const eu = await quemSouOneDriveGraph();
  console.log("\nConta OneDrive autenticada:");
  console.log("  nome =", eu.displayName || "?");
  console.log("  email =", eu.mail || eu.userPrincipalName || "?");
  console.log("  ← tem que ser a mesma conta do OneDrive web que você abre");

  const root = await resolverPastaRaizOneDriveGraph();
  console.log("\nPasta-base =", root);

  console.log("\nCriando estrutura denteart-1 (cliente + módulos)...");
  await garantirEstruturaPastasEmpresaOneDrive("denteart-1");

  console.log(`\nConteúdo de ${root}:`);
  for (const item of await listarPastaOneDriveGraph(root)) {
    console.log(`  - ${item.folder ? "[pasta]" : "[arq]"} ${item.name}`);
  }

  console.log(`\nConteúdo de ${root}/denteart-1/uploads:`);
  for (const item of await listarPastaOneDriveGraph(`${root}/denteart-1/uploads`)) {
    console.log(`  - ${item.folder ? "[pasta]" : "[arq]"} ${item.name}`);
  }

  const remotePath = caminhoRemotoEmpresaUploads(
    "denteart-1",
    "os",
    `prova-${Date.now()}.png`
  );
  // PNG mínimo 1x1 para testar tipo de imagem da OS
  const png1x1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  console.log("\nEnviando PNG de prova:", remotePath);
  const meta = await uploadBytesOneDriveGraph(remotePath, png1x1, "image/png");
  const voltou = await downloadBytesOneDriveGraph(remotePath);
  console.log("Download OK bytes =", voltou.length);

  console.log(`\nConteúdo de ${root}/denteart-1/uploads/os:`);
  for (const item of await listarPastaOneDriveGraph(`${root}/denteart-1/uploads/os`)) {
    console.log(`  - ${item.folder ? "[pasta]" : "[arq]"} ${item.name}`);
  }

  if (meta?.webUrl) {
    console.log("\nAbra este link:");
    console.log(meta.webUrl);
  }
  console.log(
    `\nNo OneDrive web (conta ${eu.mail || eu.userPrincipalName}):\n` +
      `  ${onedriveGraphRootFolder()}/denteart-1/uploads/os/`
  );
}

main().catch((err) => {
  console.error("\nFALHOU:", err instanceof Error ? err.message : err);
  process.exit(1);
});
