@echo off
cd /d "%~dp0"
set NODE_ENV=development
"C:\Program Files\nodejs\node.exe" "node_modules\.pnpm\tsx@4.20.6\node_modules\tsx\dist\cli.mjs" "server/_core/index.ts"
