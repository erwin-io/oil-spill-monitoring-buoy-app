# BlueGuard mobile entrypoint delegates to the one shared API + Mobile test coordinator.
# Run .\test-blueguard.cmd from this repository. It never modifies Firebase production.
[CmdletBinding()]
param(
    [switch]$Android,
    [switch]$InstallOnDevice,
    [switch]$Screenshot,
    [switch]$FreshDependencies
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$apiRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'oil-spill-monitoring-buoy-api'
$sharedRunner = Join-Path $apiRoot 'test-blueguard.ps1'
if (-not (Test-Path -LiteralPath $sharedRunner)) {
    Write-Host "BlueGuard API repository is required beside this mobile repository: $apiRoot" -ForegroundColor Red
    exit 1
}
& $sharedRunner @PSBoundParameters
if (-not $?) { exit 1 }
