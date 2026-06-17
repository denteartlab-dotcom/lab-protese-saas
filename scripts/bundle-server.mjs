import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outfile = path.join(root, ".next", "dev-server.cjs");
const entrada = path.join(root, "server.ts");

await mkdir(path.dirname(outfile), { recursive: true });

await esbuild.build({
  entryPoints: [entrada],
  bundle: true,
  platform: "node",
  format: "cjs",
  packages: "external",
  outfile,
});

console.log(`> server.ts empacotado em ${outfile}`);
