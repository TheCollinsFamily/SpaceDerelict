@echo off
setlocal enabledelayedexpansion

REM Space Derelict - Terminal / rich prototype launcher
REM Use this for the full interactive city + console version (or --demo).

cd /d "%~dp0"

echo.
echo ================================================
echo   SPACE DERELICT (Terminal Prototype)
echo   Full persistent city, contracts, branching map
echo ================================================
echo.
echo Tip: For the graphical pygame version, use "Space Derelict.bat"
echo.

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Python was not found in your PATH.
    echo Install Python 3.10+ and check "Add to PATH".
    pause
    exit /b 1
)

echo Using this Python (should match what works in your cmd):
python --version
where python
echo.

echo Launching terminal version...
echo.

REM Run live/interactively — do NOT redirect, because this is the rich console UI
REM that needs real stdin/stdout for menus and input().
python main.py %*

set EXITCODE=%ERRORLEVEL%

if not %EXITCODE%==0 (
    echo.
    echo Game exited with code %EXITCODE%.
    echo Check logs\space_derelict.log for details (if it got far enough to log).
)

echo.
echo (Game ended. Press any key to close this window...)
pause >nul

exit /b %EXITCODE%
