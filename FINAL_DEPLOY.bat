@echo off
cd /d "%~dp0"
echo ========================================
echo 최종 배포 시도
echo ========================================
echo.
echo 1. DO Worker 배포 중...
npx wrangler deploy --config wrangler-do.toml
echo.
echo 2. 메인 Worker 배포 중...
echo 확인 메시지가 나오면 Y 입력!
npx wrangler deploy --config wrangler-NEW.toml
echo.
echo ========================================
echo 배포 완료!
echo 확인 주소: https://chosung-game-v2.sucksuck1114.workers.dev/
echo ========================================
pause



