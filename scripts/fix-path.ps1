# Add Node.js and global npm to PATH for the current PowerShell session.
$nodeDir = "C:\Program Files\nodejs"
$npmGlobal = Join-Path $env:APPDATA "npm"

foreach ($dir in @($nodeDir, $npmGlobal)) {
  if ((Test-Path $dir) -and ($env:Path -notlike "*$dir*")) {
    $env:Path = "$dir;$env:Path"
  }
}

Write-Host "PATH updated for this session."
Write-Host "node: $(Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)"
Write-Host "firebase: $(Get-Command firebase -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)"
Write-Host ""
Write-Host "Now run: firebase login"
