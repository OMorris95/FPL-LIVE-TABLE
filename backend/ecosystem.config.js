module.exports = {
  apps: [{
    name: 'fpl-backend',
    script: './server.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    // Auto-restart on crash
    autorestart: true,
    // Max memory before restart (optional)
    max_memory_restart: '500M',
    // Restart delay
    restart_delay: 4000
  }]
};
