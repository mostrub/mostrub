# Starts Floorline for shopfloor users: background server + full-screen browser.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
$Port = 5173
$LocalUrl = "http://127.0.0.1:$Port/"

function Show-FloorlineMessage {
  param([string] $Text)
  Add-Type -AssemblyName System.Windows.Forms
  [void][System.Windows.Forms.MessageBox]::Show(
    $Text,
    "Floorline",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
  )
}

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machine;$user"
}

function Test-PortOpen {
  param([int] $Port)
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $client.Connect("127.0.0.1", $Port)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

try {
  Refresh-Path
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is missing. Double-click install-windows.cmd once, then use Floorline again."
  }
  if (-not (Test-Path (Join-Path $Root "node_modules"))) {
    npm install
  }

  if (-not (Test-PortOpen -Port $Port)) {
    Start-Process -FilePath "cmd.exe" -WorkingDirectory $Root -WindowStyle Hidden -ArgumentList "/c npm run dev -- --host 0.0.0.0 --port $Port"
  }

  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    if (Test-PortOpen -Port $Port) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) {
    throw "Floorline did not start. Double-click install-windows.cmd once and try again."
  }

  $edgeCandidates = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  )
  $chromeCandidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
  )
  $browser = $edgeCandidates + $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($browser) {
    Start-Process -FilePath $browser -ArgumentList @("--app=$LocalUrl", "--start-fullscreen")
  } else {
    Start-Process $LocalUrl
  }
} catch {
  Show-FloorlineMessage $_.Exception.Message
  exit 1
}
