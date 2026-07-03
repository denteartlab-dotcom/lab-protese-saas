/**
 * Dev Next.js multiplataforma.
 * No Windows evita --turbopack (watchpack varre C:\ e gera EINVAL em arquivos de sistema).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "3000";
const isWin = process.platform === "win32";

const env = {
  ...process.env,
  NEXT_PUBLIC_DEV_BOOT: String(Date.now()),
};

if (isWin) {
  env.WATCHPACK_POLLING = "true";
  env.CHOKIDAR_USEPOLLING = "1";
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const args = ["dev", "-p", port];
if (!isWin) {
  args.push("--turbopack");
}

console.log(
  isWin
    ? "> next dev (webpack + polling — estável no Windows)"
    : "> next dev --turbopack"
);

const child = spawn(process.execPath, [nextBin, ...args], {
  cwd: root,
  stdio: "inherit",
  env,
});

child.on("exit", (code) => process.exit(code ?? 0));
