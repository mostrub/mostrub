# Floorline one-script install for Windows 11.
# Double-click install-windows.cmd, or:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\install-windows.ps1
# Creates Desktop shortcuts: Floorline (start, full screen) and Stop Floorline.

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

function New-DesktopShortcut {
  param(
    [Parameter(Mandatory = $true)][string] $Name,
    [Parameter(Mandatory = $true)][string] $TargetPath
  )
  $desktop = [Environment]::GetFolderPath("Desktop")
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut((Join-Path $desktop "$Name.lnk"))
  $shortcut.TargetPath = $TargetPath
  $shortcut.WorkingDirectory = $Root
  $shortcut.WindowStyle = 1
  $shortcut.Description = $Name
  $shortcut.Save()
  Write-Host "Desktop shortcut: $Name"
}

Ensure-Node
Write-Host "node $(node -v)  npm $(npm -v)"
Write-Host "Installing npm packages in $Root ..."
npm install

New-DesktopShortcut -Name "Floorline" -TargetPath (Join-Path $Root "start-floorline.cmd")
New-DesktopShortcut -Name "Stop Floorline" -TargetPath (Join-Path $Root "stop-floorline.cmd")

Write-Host ""
Write-Host "Install finished. Daily use:"
Write-Host "  Double-click Floorline on the Desktop (starts the app full screen)."
Write-Host "  Double-click Stop Floorline when the shift is done."
Write-Host "  Other PCs and Macs on the same network can open the Share URLs in the header."
Write-Host ""

& (Join-Path $Root "start-floorline.ps1")
