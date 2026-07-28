# Setup DumpCSV with SaintCoinach dependency.
# Run from repo root: .\tw_dataminer\setup-dumpcsv.ps1
#
# Requires: .NET 8 SDK only. All projects (SaintCoinach, SaintCoinach.Cmd, DumpCSV) use net8.0.
#
# 1. Clones xivapi/SaintCoinach into tw_dataminer/SaintCoinach (if missing)
# 2. Builds only SaintCoinach + SaintCoinach.Cmd (net8.0) — not Godbert/Graphics.Viewer
# 3. Copies SaintCoinach.Cmd build output to dumpcsv/SaintCoinach.Cmd
# 4. Builds dumpcsv (net8.0)
# 5. Copies SaintCoinach runtime into dumpcsv output for "dotnet DumpCsv.dll"

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TwDataminer = $ScriptDir
$SaintDir = Join-Path $TwDataminer "SaintCoinach"
$DumpcsvDir = Join-Path $TwDataminer "dumpcsv"
$SaintCmdOut = Join-Path $DumpcsvDir "SaintCoinach.Cmd"
$DumpcsvBin = Join-Path $DumpcsvDir "bin\Release\net8.0"

# Clone SaintCoinach if missing
if (-not (Test-Path (Join-Path $SaintDir "SaintCoinach.sln"))) {
    Write-Host "[1/6] Cloning xivapi/SaintCoinach into $SaintDir ..."
    git clone --depth 1 https://github.com/xivapi/SaintCoinach.git $SaintDir
} else {
    Write-Host "[1/6] SaintCoinach already present at $SaintDir"
}

# Ensure NuGet source (needed if system has no package sources)
$nugetConfigSrc = Join-Path $TwDataminer "SaintCoinach-nuget.config"
$nugetConfigDst = Join-Path $SaintDir "nuget.config"
if (Test-Path $nugetConfigSrc) {
    Copy-Item -Path $nugetConfigSrc -Destination $nugetConfigDst -Force
}

# Patch SaintCoinach to net8.0 and package versions (so .NET 8 SDK only is needed)
Write-Host "[2/6] Ensuring SaintCoinach targets net8.0 ..."
$dotSquishCsproj = Join-Path $SaintDir "DotSquish\DotSquish.csproj"
$saintCsproj = Join-Path $SaintDir "SaintCoinach\SaintCoinach.csproj"
$cmdCsproj = Join-Path $SaintDir "SaintCoinach.Cmd\SaintCoinach.Cmd.csproj"
foreach ($f in @($dotSquishCsproj, $saintCsproj, $cmdCsproj)) {
    if (-not (Test-Path $f)) { continue }
    $c = Get-Content $f -Raw -Encoding UTF8
    $c = $c -replace '<TargetFramework>net7\.0</TargetFramework>', '<TargetFramework>net8.0</TargetFramework>'
    if ($f -eq $dotSquishCsproj) { $c = $c -replace 'System.Drawing.Common" Version="7.0.0"', 'System.Drawing.Common" Version="8.0.0"' }
    if ($f -eq $saintCsproj) {
        $c = $c -replace 'BCnEncoder.Net" Version="2.2.0"', 'BCnEncoder.Net" Version="2.2.1"'
        $c = $c -replace 'System.Drawing.Common" Version="7.0.0"', 'System.Drawing.Common" Version="8.0.0"'
        $c = $c -replace 'System.Text.Encoding.CodePages" Version="7.0.0"', 'System.Text.Encoding.CodePages" Version="8.0.0"'
    }
    Set-Content -Path $f -Value $c -Encoding UTF8 -NoNewline
}

# Build only SaintCoinach and SaintCoinach.Cmd (net8.0) — avoids Godbert/Graphics.Viewer
Write-Host "[3/6] Building SaintCoinach and SaintCoinach.Cmd (Release, net8.0) ..."
$saintProj = Join-Path $SaintDir "SaintCoinach\SaintCoinach.csproj"
$cmdProj = Join-Path $SaintDir "SaintCoinach.Cmd\SaintCoinach.Cmd.csproj"
if (-not (Test-Path $saintProj)) { throw "SaintCoinach project not found: $saintProj" }
if (-not (Test-Path $cmdProj)) { throw "SaintCoinach.Cmd project not found: $cmdProj" }
Push-Location $SaintDir
try {
    dotnet build $saintProj -c Release
    if ($LASTEXITCODE -ne 0) { throw "SaintCoinach build failed" }
    dotnet build $cmdProj -c Release
    if ($LASTEXITCODE -ne 0) { throw "SaintCoinach.Cmd build failed" }
} finally {
    Pop-Location
}

# SaintCoinach.Cmd output is net8.0
$cmdOutDir = Join-Path $SaintDir "SaintCoinach.Cmd\bin\Release\net8.0"
if (-not (Test-Path $cmdOutDir)) {
    throw "SaintCoinach.Cmd build output not found at $cmdOutDir"
}

Write-Host "[4/6] Copying SaintCoinach.Cmd output to dumpcsv/SaintCoinach.Cmd ..."
if (-not (Test-Path $SaintCmdOut)) { New-Item -ItemType Directory -Path $SaintCmdOut -Force | Out-Null }
Copy-Item -Path "$cmdOutDir\*" -Destination $SaintCmdOut -Recurse -Force

# Build dumpcsv
Write-Host "[5/6] Building DumpCSV (Release) ..."
Push-Location $DumpcsvDir
try {
    dotnet build DumpCsv.csproj -c Release
    if ($LASTEXITCODE -ne 0) { throw "DumpCSV build failed" }
} finally {
    Pop-Location
}

# Copy SaintCoinach runtime files into DumpCSV output so "dotnet DumpCsv.dll" has all deps
Write-Host "[6/6] Copying SaintCoinach runtime into DumpCSV output ..."
Copy-Item -Path "$SaintCmdOut\*" -Destination $DumpcsvBin -Recurse -Force

Write-Host ""
Write-Host "Done. You can run: node tw_dataminer/run-pipeline.js --extract"
Write-Host "(Set GAME_PATH to your FFXIV TW install if needed.)"
