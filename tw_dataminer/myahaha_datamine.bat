@echo off
setlocal
set "REPO_ROOT=D:\beher_FFXIV\FFXIV_Market"

if not exist "%REPO_ROOT%" (
    echo Repository not found at %REPO_ROOT%
    exit /b 1
)

cd /d "%REPO_ROOT%"

where git >nul 2>nul
if errorlevel 1 (
    echo Git is not installed or not on PATH.
    exit /b 1
)

set "NPM_CMD="
for %%I in (npm.cmd) do set "NPM_CMD=%%~$PATH:I"
if not defined NPM_CMD if exist "C:\Program Files\nodejs\npm.cmd" set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
if not defined NPM_CMD if exist "C:\Program Files (x86)\nodejs\npm.cmd" set "NPM_CMD=C:\Program Files (x86)\nodejs\npm.cmd"
if not defined NPM_CMD (
    echo Node.js/npm is not installed or not discoverable.
    exit /b 1
)

set "GAME_PATH=E:\FINAL FANTASY XIV TC"
set "FFXIV_GAME_PATH=E:\FINAL FANTASY XIV TC"

pushd "%REPO_ROOT%"

echo [1/5] Syncing repository to latest...
git fetch --all --prune
if errorlevel 1 (
    echo Git fetch failed.
    exit /b 1
)

git pull --rebase
if errorlevel 1 (
    echo Git pull failed.
    exit /b 1
)

echo [2/5] Running datamine...
call "%NPM_CMD%" run datamine
if errorlevel 1 (
    echo Datamine failed.
    exit /b 1
)

echo [3/5] Staging changes...
git add -A

for /f "tokens=2 delims==" %%I in ('wmic os get LocalDateTime ^| findstr /r "^[0-9]"') do set "TS=%%I"
set "DATESTAMP=%TS:~0,8%"
set "COMMIT_MSG=myahaha %DATESTAMP% datemine"

echo [4/5] Committing changes...
git commit --allow-empty -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo Commit failed.
    exit /b 1
)

echo [5/5] Pushing changes...
git push
if errorlevel 1 (
    echo Git push failed.
    exit /b 1
)

popd

echo Finished.
pause
