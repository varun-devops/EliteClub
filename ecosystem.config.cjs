// ════════════════════════════════════════════════════════════════════
//  PM2 process config — Hostinger VPS
//
//  PM2 keeps the Next.js server alive: it restarts the app if it crashes
//  and starts it again after a server reboot.
//
//  Used by scripts/deploy.sh. Manual commands:
//    pm2 start ecosystem.config.cjs     # first time
//    pm2 reload ecosystem.config.cjs    # zero-downtime restart
//    pm2 logs elite-club                # tail the logs
//    pm2 save                           # remember apps across reboots
// ════════════════════════════════════════════════════════════════════

module.exports = {
  apps: [
    {
      name: 'elite-club',

      // `output: 'standalone'` in next.config.ts produces this self-contained
      // server. It reads .env.local from the app root at startup.
      script: '.next/standalone/server.js',
      cwd: __dirname,

      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'production',
        // Nginx proxies public traffic to this port. Not exposed directly.
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
      },

      // Restart if the app leaks memory (small VPS plans are tight).
      max_memory_restart: '512M',

      // Don't thrash if the app is crash-looping on a bad deploy.
      min_uptime: '20s',
      max_restarts: 10,
      restart_delay: 2000,

      merge_logs: true,
      time: true,
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
    },
  ],
}
