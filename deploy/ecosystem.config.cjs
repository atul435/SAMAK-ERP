// PM2 process manager config for the self-hosted EnvironIQ app.
// Usage on the server:  pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "environiq",
      script: ".output/server/index.mjs",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      env_file: ".env",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000,
      },
      max_memory_restart: "512M",
      autorestart: true,
    },
  ],
};
