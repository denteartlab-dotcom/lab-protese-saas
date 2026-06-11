/** PM2 — tempo real do módulo TV exige tsx server.ts (npm run start), não next start. */
module.exports = {
  apps: [
    {
      name: "lab-protese",
      cwd: "/opt/lab-protese-saas",
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
