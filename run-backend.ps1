$ErrorActionPreference = "Stop"
$backendLibs = "$PSScriptRoot\backend\libs"
$msvcBin = "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.42.34433\bin\Hostx64\x64"

$env:PATH = "$backendLibs;$msvcBin;$env:USERPROFILE\.cargo\bin;$env:PATH"
$env:LIB = "$backendLibs;C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.42.34433\lib\x64;C:\Program Files (x86)\Microsoft SDKs\Windows\v7.0A\Lib\x64"
$env:LIBSQLITE3_SYS_USE_PKG_CONFIG = "1"
$env:SQLITE3_LIB_DIR = "$backendLibs"
$env:SQLITE3_INCLUDE_DIR = "$backendLibs"
$env:DATABASE_URL = "sqlite:lyrics.db"

$binary = "$PSScriptRoot\backend\target\debug\kinetic-lyrics-backend.exe"
if (Test-Path $binary) {
    Write-Host "Starting Kinetic Lyrics backend..." -ForegroundColor Cyan
    & $binary
} else {
    Write-Host "Building and starting Kinetic Lyrics backend..." -ForegroundColor Cyan
    cargo run --manifest-path "$PSScriptRoot\backend\Cargo.toml"
}
