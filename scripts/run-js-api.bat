@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-js-api.ps1" %*
