# Stops the local Floorline server started by the Desktop shortcut.

$ErrorActionPreference = "SilentlyContinue"
$Port = 5173

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

$pids = @()
try {
  $pids = @(
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
      Select-Object -ExpandProperty OwningProcess -Unique
  )
} catch {
  $lines = netstat -ano | Select-String ":$Port"
  foreach ($line in $lines) {
    $parts = ($line.ToString() -split "\s+") | Where-Object { $_ }
    if ($parts.Count -ge 5 -and $parts[-1] -match "^\d+$") {
      $pids += [int]$parts[-1]
    }
  }
}

$pids = $pids | Where-Object { $_ -and $_ -ne 0 } | Select-Object -Unique
if (-not $pids) {
  Show-FloorlineMessage "Floorline is already closed."
  exit 0
}

foreach ($processId in $pids) {
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}
Show-FloorlineMessage "Floorline is closed. You can use this PC for something else."
