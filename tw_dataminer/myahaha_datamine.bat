@echo off
setlocal EnableExtensions DisableDelayedExpansion
title FFXIV TW Dataminer

rem These defaults match myahaha's PC. The script will ask only if they are not found.
set "REPO_ROOT=D:\beher_FFXIV\FFXIV_Market"
set "GAME_PATH=E:\FINAL FANTASY XIV TC"
set "EXIT_CODE=1"
set "ATTEMPT=0"
set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%USERPROFILE%\.dotnet;%PATH%"

echo ============================================================
echo   FFXIV TW Dataminer - automatic sync, mine, and upload
echo ============================================================
echo.

if not exist "%REPO_ROOT%\.git" (
    echo Repository not found at:
    echo   %REPO_ROOT%
    echo.
    set /p "REPO_ROOT=Paste the FFXIV_Market repository folder and press Enter: "
)
if not exist "%REPO_ROOT%\.git" (
    echo ERROR: That folder is not the FFXIV_Market Git repository.
    goto :end
)

if not exist "%GAME_PATH%\game\sqpack" call :find_game
if not exist "%GAME_PATH%\game\sqpack" (
    echo Game was not found in the usual locations.
    echo Example: E:\FINAL FANTASY XIV TC
    echo.
    set /p "GAME_PATH=Paste the FFXIV Taiwan install folder and press Enter: "
)
if not exist "%GAME_PATH%\game\sqpack" (
    echo ERROR: "%GAME_PATH%\game\sqpack" does not exist.
    goto :end
)

where git.exe >nul 2>nul
if errorlevel 1 (
    echo ERROR: Git is not installed or is not available on PATH.
    goto :end
)

set "NPM_CMD="
for %%I in (npm.cmd) do set "NPM_CMD=%%~$PATH:I"
if not defined NPM_CMD if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD (
    echo ERROR: Node.js/npm is not installed or is not available on PATH.
    goto :end
)

cd /d "%REPO_ROOT%"

echo [1/6] Downloading the latest origin/main...
git fetch --prune origin "+refs/heads/main:refs/remotes/origin/main"
if errorlevel 1 (
    echo ERROR: Could not download origin/main.
    goto :end
)

echo [2/6] Replacing all local repository changes with origin/main...
git reset --hard origin/main
if errorlevel 1 goto :sync_failed
git clean -fd
if errorlevel 1 goto :sync_failed
for /f %%I in ('git rev-parse origin/main') do set "BASE_SHA=%%I"

:run_datamine
set /a ATTEMPT+=1
echo [3/6] Mining game data from "%GAME_PATH%"...
set "GAME_PATH=%GAME_PATH%"
set "FFXIV_GAME_PATH=%GAME_PATH%"
call "%NPM_CMD%" run datamine
if errorlevel 1 goto :datamine_failed

echo [4/6] Checking that the new data is complete...
node tw_dataminer\validate-datamine.js
if errorlevel 1 goto :datamine_failed

echo [5/6] Checking for changes and preparing the commit...
git add -A -- tw_dataminer/dumpcsv-output tw_dataminer/library tw_dataminer/output .tw-json public/data
if errorlevel 1 goto :datamine_failed
git diff --cached --quiet
if not errorlevel 1 (
    echo.
    echo No new game data was found. Nothing needs to be uploaded.
    set "EXIT_CODE=0"
    goto :end
)

rem A remote update during mining must never be overwritten. Re-sync and retry once.
git fetch --prune origin "+refs/heads/main:refs/remotes/origin/main"
if errorlevel 1 goto :datamine_failed
for /f %%I in ('git rev-parse origin/main') do set "LATEST_SHA=%%I"
if /i not "%BASE_SHA%"=="%LATEST_SHA%" (
    if %ATTEMPT% GEQ 2 (
        echo ERROR: origin/main changed twice while mining. Please run this file again.
        goto :datamine_failed
    )
    echo origin/main changed while mining. Re-syncing and automatically trying once more...
    git reset --hard origin/main
    if errorlevel 1 goto :sync_failed
    git clean -fd
    if errorlevel 1 goto :sync_failed
    set "BASE_SHA=%LATEST_SHA%"
    goto :run_datamine
)

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set "DATESTAMP=%%I"
git commit -m "myahaha %DATESTAMP% datamine"
if errorlevel 1 goto :datamine_failed

echo [6/6] Uploading the new data to origin/main...
git push origin HEAD:main
if errorlevel 1 (
    echo ERROR: Upload failed. Run this file again; it will safely recreate the update.
    goto :end
)

echo.
echo SUCCESS: New TW game data was mined, checked, committed, and uploaded.
set "EXIT_CODE=0"
goto :end

:find_game
for %%D in (C D E F G) do (
    if exist "%%D:\FINAL FANTASY XIV TC\game\sqpack" set "GAME_PATH=%%D:\FINAL FANTASY XIV TC"
)
exit /b 0

:sync_failed
echo ERROR: Could not replace the local checkout with origin/main.
goto :end

:datamine_failed
echo.
echo The datamine failed or produced suspicious/incomplete data.
echo Restoring the clean origin/main checkout so bad data cannot be uploaded...
git reset --hard origin/main
git clean -fd
goto :end

:end
echo.
if "%EXIT_CODE%"=="0" (
    echo Finished. Press any key to close.
) else (
    echo FAILED. Read the error above, then press any key to close.
)
pause >nul
exit /b %EXIT_CODE%
