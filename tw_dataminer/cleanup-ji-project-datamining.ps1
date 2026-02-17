# Remove datamining folders from parent directory (ji_project) so everything lives in tw_dataminer.
# Run from repo root: .\tw_dataminer\cleanup-ji-project-datamining.ps1
# Only deletes: ../dumpcsv, ../dumpcsv-output, ../ffxiv-datamining-tw (if they exist).

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$ParentDir = Split-Path -Parent $RepoRoot

$toRemove = @(
    (Join-Path $ParentDir 'dumpcsv'),
    (Join-Path $ParentDir 'dumpcsv-output'),
    (Join-Path $ParentDir 'ffxiv-datamining-tw')
)

foreach ($dir in $toRemove) {
    if (Test-Path $dir) {
        Write-Host "Removing: $dir"
        Remove-Item -Path $dir -Recurse -Force
    } else {
        Write-Host "Skip (not found): $dir"
    }
}
Write-Host "Done. All datamining is under tw_dataminer/."
