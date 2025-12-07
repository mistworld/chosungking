@echo off
cd /d "%~dp0"
echo === DO Worker 배포 중... ===
npx wrangler deploy --config wrangler-do.toml
echo.
echo === 메인 Worker 배포 중... ===
echo 배포 확인 메시지가 나오면 Y를 입력하세요.
npx wrangler deploy
pause



