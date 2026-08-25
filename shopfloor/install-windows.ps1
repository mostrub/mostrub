# Floorline one-script install for Windows 11.
# Installs Node.js LTS if missing, installs dependencies, and starts the local app.
# Double-click install-windows.cmd, or run:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\install-windows.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machine;$user"
}

function Ensure-Node {
  Refresh-Path
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node) {
    Write-Host "Node.js $($node.Source) already on PATH."
    return
  }

  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw "Node.js is not installed and winget was not found. Install Node.js LTS from https://nodejs.org then re-run this script."
  }

  Write-Host "Installing Node.js LTS with winget..."
  winget install --id OpenJS.NodeJS.LTS --source winget --accept-package-agreements --accept-source-agreements --silent
  Refresh-Path
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    throw "Node.js installed but is not on PATH yet. Close this window, open a new PowerShell, and re-run this script."
  }
}

Ensure-Node
Write-Host "node $(node -v)  npm $(npm -v)"
Write-Host "Installing npm packages in $Root ..."
npm install

$Port = 5173
$Url = "http://127.0.0.1:$Port/"
Write-Host "Starting Floorline at $Url"
Start-Process $Url
npm run dev -- --host 127.0.0.1 --port $Port
