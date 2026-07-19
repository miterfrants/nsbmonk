// PM2 設定檔。啟動:pm2 start ecosystem.config.cjs
// 注意:檔名用 .cjs,因為本專案 package.json 是 "type": "module",
// 而 PM2 設定檔需用 CommonJS 格式。
module.exports = {
  apps: [
    {
      name: 'voice-ledger',
      script: 'src/server.js',
      cwd: __dirname, // 固定工作目錄,確保讀得到 .env 與 service-account.json
      instances: 1,
      autorestart: true,
      watch: false, // 正式環境關閉檔案監看
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        // PORT 等設定由 .env 載入,這裡不重複
      },
    },
  ],
};
