Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$python = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    throw 'Missing .venv\Scripts\python.exe'
}

& $python -m PyInstaller --noconfirm --clean 'KartaPostaciInteraktywna.spec'
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller failed with exit code: $LASTEXITCODE"
}

Copy-Item 'karta_postaci.xlsx' 'dist\karta_postaci.xlsx' -Force
Copy-Item 'README.txt' 'dist\README.txt' -Force

$zipPath = Join-Path $root 'dist\KartaPostaciInteraktywna.zip'
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path 'dist\KartaPostaciInteraktywna.exe', 'dist\karta_postaci.xlsx', 'dist\README.txt' -DestinationPath $zipPath

Write-Host 'Build completed. Output: dist\KartaPostaciInteraktywna.exe'