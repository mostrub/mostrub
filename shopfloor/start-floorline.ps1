# Starts Floorline for shopfloor users: background server + full-screen browser.
# Listens on the LAN so Windows / macOS / Linux clients can join.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
$Port = 5173
$LocalUrl = "http://127.0.0.1:$Port/"

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

Refresh-Path
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is missing. Double-click install-windows.cmd once, then use this shortcut."
}
if (-not (Test-Path (Join-Path $Root "node_modules"))) {
  Write-Host "Installing npm packages..."
  npm install
}

if (-not (Test-PortOpen -Port $Port)) {
  Write-Host "Starting Floorline on port $Port (LAN + this PC)..."
  Start-Process -FilePath "cmd.exe" -WorkingDirectory $Root -WindowStyle Minimized -ArgumentList "/c npm run dev -- --host 0.0.0.0 --port $Port"
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
  throw "Floorline did not start on $LocalUrl. Run install-windows.cmd and try again."
}

Write-Host "This PC: $LocalUrl"
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  ForEach-Object { Write-Host ("LAN:     http://{0}:{1}/" -f $_.IPAddress, $Port) }

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

Write-Host "Floorline is running. Use Stop Floorline on the Desktop to quit."
