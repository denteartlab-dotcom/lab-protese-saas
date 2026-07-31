/**
 * Testa se o OneDrive Graph está acessível e grava um arquivo de prova.
 *
 *   npx tsx scripts/testar-onedrive-upload.ts
 */
import {
  caminhoRemotoEmpresaUploads,
  onedriveGraphConfigurado,
  onedriveGraphRootFolder,
  uploadBytesOneDriveGraph,
  downloadBytesOneDriveGraph,
} from "../src/lib/onedrive-graph";
import { uploadUsaOneDrive } from "../src/lib/upload-onedrive-storage";

async function main() {
  console.log("UPLOAD_STORAGE =", process.env.UPLOAD_STORAGE || "(vazio)");
  console.log("uploadUsaOneDrive() =", uploadUsaOneDrive());
  console.log("graphConfigurado =", onedriveGraphConfigurado());
  console.log("rootFolder =", onedriveGraphRootFolder());
  console.log("tenant =", process.env.ONEDRIVE_GRAPH_TENANT_ID || "consumers");
  console.log("clientId =", process.env.ONEDRIVE_GRAPH_CLIENT_ID ? "ok" : "FALTA");
  console.log("secret =", process.env.ONEDRIVE_GRAPH_CLIENT_SECRET ? "ok" : "FALTA");
  console.log("refresh =", process.env.ONEDRIVE_GRAPH_REFRESH_TOKEN ? "ok" : "FALTA");

  if (!uploadUsaOneDrive()) {
    console.error("\nERRO: UPLOAD_STORAGE não é onedrive. Ajuste o .env e reinicie o PM2 pelo ecosystem.");
    process.exit(1);
  }
  if (!onedriveGraphConfigurado()) {
    console.error("\nERRO: faltam variáveis ONEDRIVE_GRAPH_*");
    process.exit(1);
  }

  const remotePath = caminhoRemotoEmpresaUploads(
    "teste-lab",
    "os",
    `prova-${Date.now()}.txt`
  );
  const conteudo = Buffer.from(`prova onedrive ${new Date().toISOString()}\n`, "utf8");
  console.log("\nEnviando:", remotePath);
  await uploadBytesOneDriveGraph(remotePath, conteudo, "text/plain");
  const voltou = await downloadBytesOneDriveGraph(remotePath);
  console.log("Download OK:", voltou.toString("utf8").trim());
  console.log("\nSUCESSO. Abra o OneDrive e procure a pasta Lab_Protese/teste-lab/uploads/os/");
}

main().catch((err) => {
  console.error("\nFALHOU:", err instanceof Error ? err.message : err);
  process.exit(1);
});
