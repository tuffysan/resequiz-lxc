@echo off
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8088
  python -m http.server 8088
) else (
  echo Python hittades inte. Oppnar spelet direkt i webblasaren.
  start "" index.html
  pause
)
