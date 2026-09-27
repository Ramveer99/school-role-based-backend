module.exports = {
  apps: [
    {
      name: 'educore-api',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
    },
  ],
};
