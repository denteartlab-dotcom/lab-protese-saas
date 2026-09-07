/**
 * Build de produção com logs claros entre etapas.
 *
 * Na VPS pequena o Next “parece travado” quando o heap é grande demais
 * (swap). Use:
 *   SKIP_TYPECHECK=1 npm run build
 *
 * Ou deixe o deploy/deploy-vps-local.sh definir NODE_OPTIONS + SKIP_TYPECHECK.
 */
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipTypecheck =
  process.env.SKIP_TYPECHECK === "1" || process.env.SKIP_TYPECHECK === "true";

function heapMbParaBuild() {
  const fromEnv = process.env.NODE_OPTIONS?.match(
    /--max-old-space-size=(\d+)/
  )?.[1];
  if (fromEnv) return Number(fromEnv);

  const totalMb = Math.floor(os.totalmem() / (1024 * 1024));
  if (totalMb < 2048) return 1280;
  if (totalMb < 4096) return 1536;
  if (totalMb < 8192) return 3072;
  return 4096;
}

function run(label, command, args, envExtra = {}) {
  console.log(`\n==> [${new Date().toISOString()}] ${label}`);
  console.log(`    $ ${command} ${args.join(" ")}`);
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...envExtra },
    shell: process.platform === "win32",
  });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (result.error) {
    console.error(`ERRO ao iniciar (${label}):`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\nFALHOU: ${label} (exit ${result.status}) em ${secs}s`);
    process.exit(result.status || 1);
  }
  console.log(`OK: ${label} em ${secs}s`);
}

const heapMb = heapMbParaBuild();

console.log("Build produção Lab Prótese");
console.log(`    RAM host ~${Math.floor(os.totalmem() / (1024 * 1024))} MB`);
console.log(`    Heap Node (next build): ${heapMb} MB`);
console.log(
  skipTypecheck
    ? "    SKIP_TYPECHECK=1 — TypeScript não bloqueia o build"
    : "    Typecheck ativo (se travar no fim do Next: SKIP_TYPECHECK=1 npm run build)"
);

run("1/3 prisma generate", "npx", ["prisma", "generate"]);
run(
  "2/3 next build",
  "node",
  [
    `--max-old-space-size=${heapMb}`,
    path.join("node_modules", "next", "dist", "bin", "next"),
    "build",
  ],
  skipTypecheck ? { SKIP_TYPECHECK: "1" } : {}
);
run("3/3 bundle-server (esbuild)", "node", ["scripts/bundle-server.mjs"]);

console.log("\nBuild concluído.");
