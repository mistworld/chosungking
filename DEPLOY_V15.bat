@echo off
chcp 65001 >nul
echo ========================================
echo Worker v15 Deploy
echo ========================================
echo.
echo Using wrangler.toml
echo Worker: steep-moon-7816
echo.
echo Deploying...
echo.
npx wrangler deploy --config wrangler.toml
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [SUCCESS] Deploy Complete!
    echo ========================================
    echo.
    echo Test URL: https://steep-moon-7816.sucksuck1114.workers.dev/test-worker
    echo.
    echo Please check the version in the response.
    echo.
) else (
    echo.
    echo ========================================
    echo [ERROR] Deploy Failed!
    echo ========================================
    echo.
    echo Please check the error message above.
    echo.
)
pause
