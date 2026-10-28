@echo off
setlocal
title TripLOG Local Preview
set "TRIPLOG_LOCAL_ROOT=%~dp0"
set "TRIPLOG_LOCAL_LAUNCHER=%~f0"
powershell.exe -NoLogo -NoProfile -Command "$text = [IO.File]::ReadAllText($env:TRIPLOG_LOCAL_LAUNCHER); & ([ScriptBlock]::Create($text.Substring($text.LastIndexOf('# TRIPLOG_LOCAL_POWERSHELL'))))"
set "TripLogLocalExit=%ERRORLEVEL%"
if not "%TripLogLocalExit%"=="0" pause
exit /b %TripLogLocalExit%

# TRIPLOG_LOCAL_POWERSHELL
$ErrorActionPreference = 'Stop'
$tripLogUrl = 'http://127.0.0.1:18080/Travel?page=itinerary'
$tripLogOpenJob = $null

try {
    Set-Location -LiteralPath $env:TRIPLOG_LOCAL_ROOT
    $tripLogNode = (Get-Command node.exe -ErrorAction Stop).Source
    $tripLogVersion = (& $tripLogNode --version).TrimStart('v').Split('.')[0]
    if ([int]$tripLogVersion -lt 24) { throw 'Node.js 24 or newer is required.' }

    $tripLogRunning = $false
    try {
        $tripLogPage = Invoke-WebRequest -Uri $tripLogUrl -UseBasicParsing -TimeoutSec 2
        $tripLogRunning = $tripLogPage.Content -match 'triplog-build' -and $tripLogPage.Content -match 'itineraryEditor'
    } catch { }

    if ($tripLogRunning) {
        Write-Host '[TripLOG] Local preview is already running. Opening the browser.'
        Start-Process -FilePath $tripLogUrl
        exit 0
    }

    $tripLogClient = [System.Net.Sockets.TcpClient]::new()
    $tripLogPortBusy = $false
    try { $tripLogClient.Connect('127.0.0.1', 18080); $tripLogPortBusy = $true } catch { }
    finally { $tripLogClient.Dispose() }
    if ($tripLogPortBusy) { throw 'Port 18080 is used by another service. Close that service and try again.' }

    # This job opens the browser only after the server is ready.
    # The server itself stays in this console so Ctrl+C or closing it stops Node.
    $tripLogOpenJob = Start-Job -ArgumentList $tripLogUrl -ScriptBlock {
        param($tripLogAddress)
        for ($tripLogAttempt = 0; $tripLogAttempt -lt 40; $tripLogAttempt++) {
            try {
                $tripLogResponse = Invoke-WebRequest -Uri $tripLogAddress -UseBasicParsing -TimeoutSec 1
                if ($tripLogResponse.Content -match 'triplog-build' -and $tripLogResponse.Content -match 'itineraryEditor') {
                    Start-Process -FilePath $tripLogAddress
                    return
                }
            } catch { }
            Start-Sleep -Milliseconds 250
        }
    }

    Write-Host '[TripLOG] Starting local preview...'
    Write-Host "[TripLOG] $tripLogUrl"
    Write-Host '[TripLOG] Keep this window open. Press Ctrl+C to stop the server.'
    $env:PORT = '18080'
    & $tripLogNode (Join-Path $env:TRIPLOG_LOCAL_ROOT 'scripts\serve-test.js')
    if ($LASTEXITCODE -and $LASTEXITCODE -ne -1073741510 -and $LASTEXITCODE -ne 130) {
        throw "The local server exited with code $LASTEXITCODE."
    }
    exit 0
} catch {
    Write-Host "[TripLOG] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if ($tripLogOpenJob) {
        Stop-Job -Job $tripLogOpenJob -ErrorAction SilentlyContinue
        Remove-Job -Job $tripLogOpenJob -Force -ErrorAction SilentlyContinue
    }
}
