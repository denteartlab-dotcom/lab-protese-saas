/**
 * Build de produção com logs claros entre etapas.
 *
 * Na VPS pequena o Next “parece travado” ou morre com heap OOM.
 * Preferir:
 *   SKIP_TYPECHECK=1 npm run build
 *
 * O deploy/deploy-vps-local.sh define NODE_OPTIONS, SWAP e para o PM2 antes do build.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
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
  // Next 15 em monólito grande: <2 GB físico precisa de heap ≥2 GB (com swap).
  if (totalMb < 2048) return 2304;
  if (totalMb < 4096) return 3072;
  if (totalMb < 8192) return 4096;
  return 6144;
}

function limparCacheNextSePreciso(totalMb, heapMb) {
  const forcar =
    process.env.CLEAN_NEXT === "1" || process.env.CLEAN_NEXT === "true";
  const vpsPequena = totalMb < 4096 || heapMb <= 3072;
  if (!forcar && !vpsPequena) return;
  const nextDir = path.join(root, ".next");
  if (!fs.existsSync(nextDir)) return;
  console.log("    Limpando .next antes do build (economiza RAM)...");
  fs.rmSync(nextDir, { recursive: true, force: true });
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

const totalMb = Math.floor(os.totalmem() / (1024 * 1024));
const heapMb = heapMbParaBuild();

console.log("Build produção Lab Prótese");
console.log(`    RAM host ~${totalMb} MB`);
console.log(`    Heap Node (next build): ${heapMb} MB`);
console.log(
  skipTypecheck
    ? "    SKIP_TYPECHECK=1 — TypeScript não bloqueia o build"
    : "    Typecheck ativo (se travar no fim do Next: SKIP_TYPECHECK=1 npm run build)"
);

limparCacheNextSePreciso(totalMb, heapMb);

run("1/3 prisma generate", "npx", ["prisma", "generate"]);
run(
  "2/3 next build",
  "node",
  [
    `--max-old-space-size=${heapMb}`,
    path.join("node_modules", "next", "dist", "bin", "next"),
    "build",
  ],
  {
    ...(skipTypecheck ? { SKIP_TYPECHECK: "1" } : {}),
    NEXT_BUILD_WORKERS: process.env.NEXT_BUILD_WORKERS || "1",
    NEXT_TELEMETRY_DISABLED: "1",
  }
);
run("3/3 bundle-server (esbuild)", "node", ["scripts/bundle-server.mjs"]);

console.log("\nBuild concluído.");
