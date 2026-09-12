// PM2 process manager config for the self-hosted EnvironIQ app.
// Usage on the server:  pm2 start ecosystem.config.cjs
//
// Parses .env itself rather than relying on PM2's env_file option, which
// has proven unreliable across PM2 versions (a mismatched CLI/daemon
// version silently drops it, leaving the app unable to see its own
// SUPABASE_* config). This is a plain KEY=VALUE parser -- no dependency,
// no PM2-version guesswork.
const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const fileEnv = loadEnvFile(path.join(__dirname, ".env"));

module.exports = {
  apps: [
    {
      name: "environiq",
      script: ".output/server/index.mjs",
      // Pinned to a private nvm-managed Node 22 install -- required for
      // native WebSocket support (@supabase/realtime-js needs Node 22+),
      // and kept separate from the VPS's system-wide /usr/bin/node (v20)
      // so other apps on this box are never affected.
      interpreter: "/root/.nvm/versions/node/v22.23.2/bin/node",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        ...fileEnv,
      },
      max_memory_restart: "512M",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s",
      restart_delay: 5000,
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
