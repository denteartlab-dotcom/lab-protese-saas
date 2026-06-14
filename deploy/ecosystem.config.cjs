/** PM2 — tempo real do módulo TV exige npm run start (server.ts + Socket.IO), não next start. */
const appDir = process.env.APP_DIR || "/opt/lab-protese-saas";

module.exports = {
  apps: [
    {
      name: "lab-protese",
      cwd: appDir,
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
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
