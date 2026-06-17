import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { liberarPorta } from "./liberar-porta.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = parseInt(process.env.PORT || "3000", 10);

function envComMaisMemoria() {
  const atual = process.env.NODE_OPTIONS?.trim() || "";
  const extra = "--max-old-space-size=8192";
  const base =
    atual.includes("max-old-space-size")
      ? process.env
      : {
          ...process.env,
          NODE_OPTIONS: atual ? `${atual} ${extra}` : extra,
        };
  if (process.platform === "win32") {
    return {
      ...base,
      WATCHPACK_POLLING: "true",
      CHOKIDAR_USEPOLLING: "1",
    };
  }
  return base;
}

async function precisaRebuild(outfile, entrada) {
  try {
    const [out, inp] = await Promise.all([stat(outfile), stat(entrada)]);
    return inp.mtimeMs > out.mtimeMs;
  } catch {
    return true;
  }
}

async function empacotarServidor(outfile, entrada) {
  await mkdir(path.dirname(outfile), { recursive: true });
  await esbuild.build({
    entryPoints: [entrada],
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    outfile,
  });
}

liberarPorta(port);

const outfile = path.join(root, ".next", "dev-server.cjs");
const entrada = path.join(root, "server.ts");

if (await precisaRebuild(outfile, entrada)) {
  await empacotarServidor(outfile, entrada);
  console.log("> Servidor customizado gerado (.next/dev-server.cjs)");
} else {
  console.log("> Servidor customizado em cache (.next/dev-server.cjs)");
}

const child = spawn(process.execPath, [outfile], {
  cwd: root,
  stdio: "inherit",
  env: envComMaisMemoria(),
});

child.on("exit", (code) => process.exit(code ?? 0));
