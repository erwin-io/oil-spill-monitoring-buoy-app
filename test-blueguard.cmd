@echo off
setlocal
REM From either BlueGuard repository, run: test-blueguard.cmd
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0test-blueguard.ps1" %*
exit /b %errorlevel%
