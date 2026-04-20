module.exports = {
  apps: [
    {
      name: 'coin-economy-api',
      script: 'apps/api/dist/index.js',
      cwd: '/var/www/coin-economy',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/coin-economy-api-error.log',
      out_file: '/var/log/pm2/coin-economy-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'coin-economy-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/var/www/coin-economy/apps/web',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/coin-economy-web-error.log',
      out_file: '/var/log/pm2/coin-economy-web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
