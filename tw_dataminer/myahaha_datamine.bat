@echo off
setlocal
set "REPO_ROOT=D:\beher_FFXIV\FFXIV_Market"
set "EXIT_CODE=0"
set "PATH=C:\Program Files\nodejs;C:\Users\Administrator\AppData\Roaming\npm;C:\Users\Administrator\.dotnet;%PATH%"

if not exist "%REPO_ROOT%" (
    echo Repository not found at %REPO_ROOT%
    set "EXIT_CODE=1"
    goto :end_with_pause
)

cd /d "%REPO_ROOT%"

where git >nul 2>nul
if errorlevel 1 (
    echo Git is not installed or not on PATH.
    set "EXIT_CODE=1"
    goto :end_with_pause
)

set "NPM_CMD="
for %%I in (npm.cmd) do set "NPM_CMD=%%~$PATH:I"
if not defined NPM_CMD if exist "C:\Program Files\nodejs\npm.cmd" set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
if not defined NPM_CMD if exist "C:\Program Files (x86)\nodejs\npm.cmd" set "NPM_CMD=C:\Program Files (x86)\nodejs\npm.cmd"
if not defined NPM_CMD (
    echo Node.js/npm is not installed or not discoverable.
    set "EXIT_CODE=1"
    goto :end_with_pause
)

set "GAME_PATH=E:\FINAL FANTASY XIV TC"
set "FFXIV_GAME_PATH=E:\FINAL FANTASY XIV TC"

pushd "%REPO_ROOT%"

echo [1/5] Syncing repository to latest...
git fetch --all --prune
if errorlevel 1 (
    echo Git fetch failed.
    set "EXIT_CODE=1"
    goto :end_with_pause
)

git pull --rebase
if errorlevel 1 (
    echo Git pull with rebase failed, trying regular pull...
    git pull
    if errorlevel 1 (
        echo Git pull failed.
        set "EXIT_CODE=1"
        goto :end_with_pause
    )
)

echo [2/5] Running datamine...
call "%NPM_CMD%" run datamine
if errorlevel 1 (
    echo Datamine failed.
    set "EXIT_CODE=1"
    goto :end_with_pause
)

echo [3/5] Staging changes...
git add -A

for /f "tokens=2 delims==" %%I in ('wmic os get LocalDateTime ^| findstr /r "^[0-9]"') do set "TS=%%I"
set "DATESTAMP=%TS:~0,8%"
set "COMMIT_MSG=myahaha %DATESTAMP% datamine"

echo [4/5] Committing changes...
git commit --allow-empty -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo Commit failed.
    set "EXIT_CODE=1"
    goto :end_with_pause
)

echo [5/5] Pushing changes...
git push
if errorlevel 1 (
    echo Git push failed.
    set "EXIT_CODE=1"
    goto :end_with_pause
)

popd

echo Finished.

goto :end_with_pause

:end_with_pause
if "%EXIT_CODE%"=="0" (
    echo.
    echo Press any key to close...
) else (
    echo.
    echo Press any key to close...
)
pause >nul
exit /b %EXIT_CODE%
