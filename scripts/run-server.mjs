import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { liberarPorta } from "./liberar-porta.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = parseInt(process.env.PORT || "3000", 10);

liberarPorta(port);
await new Promise((resolve) => setTimeout(resolve, 400));
const outfile = path.join(root, ".next", "dev-server.cjs");

await mkdir(path.dirname(outfile), { recursive: true });

const esbuildBin = path.join(root, "node_modules", "esbuild", "bin", "esbuild");

const build = spawn(
  process.execPath,
  [
    esbuildBin,
    path.join(root, "server.ts"),
    "--bundle",
    "--platform=node",
    "--format=cjs",
    "--packages=external",
    `--outfile=${outfile}`,
  ],
  { cwd: root, stdio: "inherit" }
);

await new Promise((resolve, reject) => {
  build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("esbuild failed"))));
});

liberarPorta(port);
await new Promise((resolve) => setTimeout(resolve, 500));

const child = spawn(process.execPath, [outfile], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
