#!/usr/bin/env node
/** Remove cooldown de pareamento (só use após aguardar o bloqueio do WhatsApp). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cooldownFile = path.join(root, "data", "whatsapp-pairing-cooldown.json");

try {
  fs.unlinkSync(cooldownFile);
  console.log("\nCooldown removido ✓ — pode tentar parear novamente.");
  console.log("Rode: pm2 restart lab-protese-whatsapp");
  console.log("Depois: clique Gerar QR Code UMA vez no site.\n");
} catch {
  console.log("\nNenhum cooldown ativo.\n");
}
