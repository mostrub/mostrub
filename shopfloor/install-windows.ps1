# Floorline-Ein-Skript-Installation für Windows 11.
# install-windows.cmd doppelklicken.
# Desktop-Symbole: Floorline (Start, Vollbild) und Floorline beenden.

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
    Write-Host "Node.js $($node.Source) ist schon im PATH."
    return
  }

  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw "Node.js ist nicht installiert und winget fehlt. Node.js LTS von https://nodejs.org installieren und dieses Skript erneut starten."
  }

  Write-Host "Installiere Node.js LTS mit winget..."
  winget install --id OpenJS.NodeJS.LTS --source winget --accept-package-agreements --accept-source-agreements --silent
  Refresh-Path
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    throw "Node.js ist installiert, aber noch nicht im PATH. Dieses Fenster schließen, eine neue PowerShell öffnen und das Skript erneut starten."
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

  New-FloorlineShortcut -Path (Join-Path $desktop "Floorline.lnk") -TargetPath $startVbs -Description "Floorline im Vollbild starten" -IconLocation $startIcon
  New-FloorlineShortcut -Path (Join-Path $desktop "Floorline beenden.lnk") -TargetPath $stopVbs -Description "Floorline beenden" -IconLocation $stopIcon
  New-FloorlineShortcut -Path (Join-Path $pack "Floorline starten.lnk") -TargetPath $startVbs -Description "Floorline im Vollbild starten" -IconLocation $startIcon
  New-FloorlineShortcut -Path (Join-Path $pack "Floorline beenden.lnk") -TargetPath $stopVbs -Description "Floorline beenden" -IconLocation $stopIcon
  Copy-Item -Path (Join-Path $Root "HOW-TO-USE.txt") -Destination (Join-Path $pack "Floorline - Kurzanleitung.txt") -Force
  Copy-Item -Path (Join-Path $Root "HOW-TO-USE.txt") -Destination (Join-Path $desktop "Floorline - Kurzanleitung.txt") -Force
  Write-Host "Desktop-Symbole: Floorline und Floorline beenden"
}

Ensure-Node
Write-Host "node $(node -v)  npm $(npm -v)"
Write-Host "Installiere npm-Pakete in $Root ..."
npm install
Install-DesktopShortcuts

Write-Host ""
Write-Host "Installation fertig. An der Linie reichen die Desktop-Symbole:"
Write-Host "  Floorline startet die App im Vollbild"
Write-Host "  Floorline beenden schließt sie"
Write-Host ""

& (Join-Path $Root "start-floorline.ps1")
