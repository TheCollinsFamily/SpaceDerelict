@echo off
setlocal enabledelayedexpansion

REM Space Derelict - Double-click launcher (graphical version)
REM This is the recommended way to play the game.
REM It tries to match exactly what you run manually in cmd: python -u run_graphical.py

cd /d "%~dp0"

echo.
echo ================================================
echo   SPACE DERELICT
echo   Roguelite franken-ship grafting combat
echo ================================================
echo.

REM Use the same "python" you have in your cmd (the one that works when you type it manually).
REM This avoids mismatches with pythonw from other Python installs in PATH.
REM A console window will be present (useful for seeing any messages or errors).
REM The game window (pygame) will open on top.

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Python was not found in your PATH.
    echo.
    echo Please install Python 3.10+ from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during install.
    echo.
    echo After installing, open a new Command Prompt and run:
    echo     pip install pygame pygame_gui rich
    echo.
    pause
    exit /b 1
)

echo Using this Python (should match what works in your cmd):
python --version
where python
echo.

echo Launching with python -u run_graphical.py ...
echo (This is the exact command that works for you in cmd.)
echo Any output or errors will appear live here (just like your manual run).
echo Internal game logs go to logs\space_derelict.log (and crashes\ for uncaught errors).
echo.

python -u run_graphical.py

set EXITCODE=%ERRORLEVEL%

echo.
echo Game process exited with code %EXITCODE%.

if not %EXITCODE%==0 (
    echo.
    echo There was a non-zero exit (possible crash or error during run).
    echo Common fixes:
    echo   1. pip install --upgrade pygame pygame_gui rich
    echo   2. pip install --upgrade --force-reinstall pygame
    echo   3. Check logs\space_derelict.log and any new files in logs\crashes\
    echo.
    echo For even more details you can also run directly:
    echo     python -u run_graphical.py 2>&1 | more
    echo.
) else (
    echo.
    echo (Normal exit. Check logs\space_derelict.log if you want to review session logs.)
)

echo.
echo Press any key to close this launcher window...
pause >nul

exit /b %EXITCODE%
