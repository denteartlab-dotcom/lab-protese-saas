import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webpackCache = path.join(root, ".next", "cache", "webpack");

try {
  const info = await stat(webpackCache);
  if (!info.isDirectory()) process.exit(0);
  await rm(webpackCache, { recursive: true, force: true });
  console.log("> Cache webpack antigo removido (Turbopack não usa — evita lentidão no Windows).");
} catch {
  /* pasta não existe */
}
