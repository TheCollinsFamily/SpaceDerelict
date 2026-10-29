@echo off
REM Broodfall - double-click launcher. Opens the game in its own full-screen window
REM (desktop/main.cjs) and closes this one. The desktop shortcut Broodfall.lnk does the
REM same with no window at all. F11 or Alt+Enter: full screen on/off. Alt+F4: quit.
REM For the browser version on the dev server, run "npm start" in this folder.

cd /d "%~dp0"

if not exist node_modules\electron\dist\electron.exe (
    where npm >nul 2>nul
    if errorlevel 1 (
        echo ERROR: Node.js/npm not found in PATH. Install Node 20+ from https://nodejs.org
        pause
        exit /b 1
    )
    echo First run: installing dependencies...
    call npm install
    if errorlevel 1 (
        echo npm install failed. See output above.
        pause
        exit /b 1
    )
)

start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
