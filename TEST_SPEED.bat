@echo off
chcp 65001 >nul
echo ========================================
echo API 속도 테스트
echo ========================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0TEST_SPEED.ps1"
echo.
pause

