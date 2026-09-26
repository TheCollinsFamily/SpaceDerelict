@echo off
REM Broodfall - double-click launcher. Starts the dev server and opens the game
REM in your default browser. Keep this window open while playing.

cd /d "%~dp0"

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js/npm not found in PATH. Install Node 20+ from https://nodejs.org
    pause
    exit /b 1
)

if not exist node_modules (
    echo First run: installing dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo npm install failed. See output above.
        pause
        exit /b 1
    )
)

echo Starting Broodfall... the game will open in your browser.
echo Close this window (or Ctrl+C) to stop the game server.
call npm start

pause
