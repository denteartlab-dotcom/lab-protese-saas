/**
 * Move public/uploads → var/uploads (fora do document root do Next).
 *
 * Uso na VPS:
 *   node scripts/migrar-uploads-privados.mjs
 */
import { existsSync, mkdirSync, renameSync, cpSync, rmSync } from "fs";
import path from "path";

const raiz = process.cwd();
const origem = path.join(raiz, "public", "uploads");
const destino = path.join(raiz, "var", "uploads");

function main() {
  if (!existsSync(origem)) {
    console.log("Nada a migrar: public/uploads não existe.");
    console.log(`Pasta privada esperada: ${destino}`);
    mkdirSync(destino, { recursive: true });
    return;
  }

  mkdirSync(path.join(raiz, "var"), { recursive: true });

  if (existsSync(destino)) {
    console.log(`Destino já existe (${destino}). Copiando conteúdo de public/uploads...`);
    cpSync(origem, destino, { recursive: true, force: false });
    console.log("Cópia concluída. Remova public/uploads manualmente quando validar.");
    return;
  }

  renameSync(origem, destino);
  console.log(`Migrado: ${origem} → ${destino}`);
  console.log("URLs /uploads/... passam a ser reescritas para /api/uploads/disco/...");
}

main();
