# Floorline one-script install for Windows 11.
# Double-click install-windows.cmd.
# Creates Desktop icons: Floorline (start, full screen) and Stop Floorline.

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

function Get-StartIcon {
  $candidates = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:SystemRoot\System32\shell32.dll,137"
  )
  foreach ($path in $candidates) {
    $file = ($path -split ",")[0]
    if (Test-Path $file) {
      return $path
    }
  }
  return "$env:SystemRoot\System32\shell32.dll,0"
}

function New-FloorlineShortcut {
  param(
    [Parameter(Mandatory = $true)][string] $Path,
    [Parameter(Mandatory = $true)][string] $TargetPath,
    [Parameter(Mandatory = $true)][string] $Description,
    [string] $IconLocation
  )
  $folder = Split-Path -Parent $Path
  if (-not (Test-Path $folder)) {
    New-Item -ItemType Directory -Path $folder | Out-Null
  }
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($Path)
  $shortcut.TargetPath = $TargetPath
  $shortcut.WorkingDirectory = $Root
  $shortcut.WindowStyle = 7
  $shortcut.Description = $Description
  if ($IconLocation) {
    $shortcut.IconLocation = $IconLocation
  }
  $shortcut.Save()
}

function Install-DesktopShortcuts {
  $desktop = [Environment]::GetFolderPath("Desktop")
  $pack = Join-Path $desktop "Floorline"
  $startVbs = Join-Path $Root "start-floorline.vbs"
  $stopVbs = Join-Path $Root "stop-floorline.vbs"
  $startIcon = Get-StartIcon
  $stopIcon = "$env:SystemRoot\System32\shell32.dll,27"

  New-FloorlineShortcut -Path (Join-Path $desktop "Floorline.lnk") -TargetPath $startVbs -Description "Start Floorline full screen" -IconLocation $startIcon
  New-FloorlineShortcut -Path (Join-Path $desktop "Stop Floorline.lnk") -TargetPath $stopVbs -Description "Stop Floorline" -IconLocation $stopIcon
  New-FloorlineShortcut -Path (Join-Path $pack "Start Floorline.lnk") -TargetPath $startVbs -Description "Start Floorline full screen" -IconLocation $startIcon
  New-FloorlineShortcut -Path (Join-Path $pack "Stop Floorline.lnk") -TargetPath $stopVbs -Description "Stop Floorline" -IconLocation $stopIcon
  Copy-Item -Path (Join-Path $Root "HOW-TO-USE.txt") -Destination (Join-Path $pack "How to use Floorline.txt") -Force
  Copy-Item -Path (Join-Path $Root "HOW-TO-USE.txt") -Destination (Join-Path $desktop "How to use Floorline.txt") -Force
  Write-Host "Desktop icons: Floorline and Stop Floorline"
}

Ensure-Node
Write-Host "node $(node -v)  npm $(npm -v)"
Write-Host "Installing npm packages in $Root ..."
npm install
Install-DesktopShortcuts

Write-Host ""
Write-Host "Install finished. People on the floor only need the Desktop icons:"
Write-Host "  Floorline — starts the app full screen"
Write-Host "  Stop Floorline — closes it"
Write-Host ""

& (Join-Path $Root "start-floorline.ps1")
