@echo off
cd /d "%~dp0"
echo === chosung-game-v2 배포 시작 ===
echo.
echo Compatibility date가 2024-12-16으로 변경되었습니다.
echo 배포 확인 메시지가 나오면 Y를 입력하세요.
echo.
npx wrangler deploy --config wrangler-NEW.toml
echo.
echo 배포 완료! 브라우저에서 확인하세요:
echo https://chosung-game-v2.sucksuck1114.workers.dev/
pause



