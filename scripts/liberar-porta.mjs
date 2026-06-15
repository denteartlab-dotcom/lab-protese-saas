import { execSync } from "node:child_process";

/**
 * Encerra processos que estejam escutando na porta informada.
 * No Windows usa netstat primeiro (mais rápido que abrir outro PowerShell).
 */
export function liberarPorta(port = 3000) {
  const alvo = Number(port);
  if (!Number.isFinite(alvo) || alvo <= 0) return;

  if (process.platform === "win32") {
    liberarPortaWindows(alvo);
    return;
  }
  liberarPortaUnix(alvo);
}

function coletarPidsWindows(port) {
  const pids = new Set();
  const sufixo = `:${port}`;

  try {
    const saida = execSync("netstat -ano", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    for (const linha of saida.split(/\r?\n/)) {
      if (!/LISTENING/i.test(linha)) continue;
      const partes = linha.trim().split(/\s+/);
      const local = partes[1];
      const pid = partes.at(-1);
      if (!local?.endsWith(sufixo)) continue;
      if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
    }
  } catch {
    /* ignore */
  }

  if (pids.size > 0) return pids;

  try {
    const ps = execSync(
      `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess"`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], timeout: 5000 }
    );
    for (const linha of ps.split(/\r?\n/)) {
      const pid = linha.trim();
      if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
    }
  } catch {
    /* porta livre */
  }

  return pids;
}

function liberarPortaWindows(port) {
  encerrarPids(port, coletarPidsWindows(port));
}

function liberarPortaUnix(port) {
  try {
    const saida = execSync(`lsof -ti tcp:${port}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const pids = new Set(
      saida
        .split(/\s+/)
        .map((s) => s.trim())
        .filter((s) => /^\d+$/.test(s))
    );
    encerrarPids(port, pids, true);
  } catch {
    /* porta livre */
  }
}

function encerrarPids(port, pids, unix = false) {
  const meuPid = String(process.pid);
  for (const pid of pids) {
    if (pid === meuPid) continue;
    try {
      if (unix) {
        process.kill(Number(pid), "SIGKILL");
      } else {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      }
      console.log(`> Porta ${port} liberada (processo ${pid}).`);
    } catch {
      /* processo já encerrado */
    }
  }
}
