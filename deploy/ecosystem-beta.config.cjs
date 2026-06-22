/** PM2 — ambiente beta (porta 3001). Usa server empacotado no build (sem esbuild no start). */
const appDir = process.env.APP_DIR || "/opt/lab-protese-beta";

module.exports = {
  apps: [
    {
      name: "lab-protese-beta",
      cwd: appDir,
      script: ".next/dev-server.cjs",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        HOSTNAME: "0.0.0.0",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      wait_ready: true,
      listen_timeout: 120_000,
      kill_timeout: 10_000,
      min_uptime: 10_000,
      restart_delay: 3_000,
      max_restarts: 20,
      exp_backoff_restart_delay: 200,
      max_memory_restart: "1800M",
      time: true,
    },
  ],
};
