@echo off
cd /d "%~dp0"
echo ========================================
echo Assets 강제 업로드 시도
echo ========================================
echo.
echo index.html 파일 타임스탬프 강제 변경 중...
powershell -Command "(Get-Item public\index.html).LastWriteTime = Get-Date"
echo.
echo 배포 실행 중...
npx wrangler deploy --config wrangler-NEW.toml
echo.
pause



