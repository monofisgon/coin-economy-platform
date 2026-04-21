module.exports = {
  apps: [
    {
      name: 'krowdco-api',
      script: 'dist/index.js',
      cwd: './apps/api',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        HOST: '127.0.0.1'
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true
    },
    {
      name: 'krowdco-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: './apps/web',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_API_URL: 'https://www.krowdco.com'
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_file: './logs/web-combined.log',
      time: true
    }
  ]
}