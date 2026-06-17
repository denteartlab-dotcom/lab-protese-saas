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
      max_memory_restart: "1G",
      time: true,
    },
  ],
};
