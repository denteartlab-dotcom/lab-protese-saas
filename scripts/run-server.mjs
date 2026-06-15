import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

liberarPorta(port);

const outfile = path.join(root, ".next", "dev-server.cjs");
const entrada = path.join(root, "server.ts");

await mkdir(path.dirname(outfile), { recursive: true });

if (await precisaRebuild(outfile, entrada)) {
  const esbuildBin = path.join(root, "node_modules", "esbuild", "bin", "esbuild");
  const build = spawn(
    process.execPath,
    [
      esbuildBin,
      entrada,
      "--bundle",
      "--platform=node",
      "--format=cjs",
      "--packages=external",
      `--outfile=${outfile}`,
    ],
    { cwd: root, stdio: "inherit", env: envComMaisMemoria() }
  );

  await new Promise((resolve, reject) => {
    build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("esbuild failed"))));
  });
} else {
  console.log("> Servidor customizado em cache (.next/dev-server.cjs)");
}

const child = spawn(process.execPath, [outfile], {
  cwd: root,
  stdio: "inherit",
  env: envComMaisMemoria(),
});

child.on("exit", (code) => process.exit(code ?? 0));
