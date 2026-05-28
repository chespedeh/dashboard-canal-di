param(
    [switch]$OpenDashboard,
    [switch]$Force,
    [int]$MaxRetries = 3
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Resolve-Python {
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe"
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return $null
}

function Resolve-DataDir {
    $candidates = @(".\datos", ".\Datos")
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return (Resolve-Path $candidate).Path
        }
    }
    throw "No se encontro carpeta de datos (datos o Datos)."
}

function Get-SourceState($dataDir) {
    $targets = @("PRESUPUESTOS.xlsx", "VENTAS_2025.xlsx", "VENTAS_2026.xlsx")
    $state = @{}

    foreach ($target in $targets) {
        $file = Get-ChildItem -Path $dataDir -File | Where-Object { $_.Name.ToLower() -eq $target.ToLower() } | Select-Object -First 1
        if (-not $file) {
            throw "No se encontro $target en $dataDir"
        }

        $state[$target] = [ordered]@{
            path = $file.FullName
            lastWriteUtc = $file.LastWriteTimeUtc.ToString("o")
            length = $file.Length
        }
    }

    return $state
}

function Write-Log($logPath, $message) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $message
    Add-Content -Path $logPath -Value $line
    Write-Host $message
}

$python = Resolve-Python
if (-not $python) {
    Write-Host "Python no encontrado. Instalando Python 3.12..." -ForegroundColor Yellow
    winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements --silent | Out-Null
    $python = Resolve-Python
}

if (-not $python) {
    throw "No se pudo resolver una instalacion de Python valida."
}

$dataDir = Resolve-DataDir
$logsDir = Join-Path $dataDir "logs"
New-Item -Path $logsDir -ItemType Directory -Force | Out-Null

$statePath = Join-Path $logsDir "source_state.json"
$dailyLogPath = Join-Path $logsDir ("update_{0}.log" -f (Get-Date -Format "yyyyMMdd"))

Write-Log $dailyLogPath "Usando Python en: $python"
Write-Log $dailyLogPath "Carpeta de datos: $dataDir"

$currentState = Get-SourceState $dataDir
$currentStateJson = $currentState | ConvertTo-Json -Depth 5

$canSkip = $false
if ((-not $Force) -and (Test-Path $statePath) -and (Test-Path ".\data.js")) {
    $previousStateJson = Get-Content $statePath -Raw
    if ($previousStateJson -eq $currentStateJson) {
        $canSkip = $true
    }
}

if ($canSkip) {
    Write-Log $dailyLogPath "Sin cambios detectados en origen. Se omite regeneracion."
} else {
    Write-Log $dailyLogPath "Cambios detectados. Ejecutando regeneracion de data.js..."
    & $python -m pip install -q openpyxl | Out-Null

    $attempt = 0
    $success = $false
    while ((-not $success) -and ($attempt -lt $MaxRetries)) {
        $attempt += 1
        try {
            Write-Log $dailyLogPath "Intento $attempt/$MaxRetries"
            & $python .\generate_data.py
            if ($LASTEXITCODE -ne 0) {
                throw "generate_data.py devolvio codigo $LASTEXITCODE"
            }
            $success = $true
        } catch {
            Write-Log $dailyLogPath ("Error en intento {0}: {1}" -f $attempt, $_.Exception.Message)
            if ($attempt -ge $MaxRetries) {
                throw
            }
            Start-Sleep -Seconds 3
        }
    }

    if ($success) {
        $currentStateJson | Set-Content -Path $statePath -Encoding UTF8
        Write-Log $dailyLogPath "Data.js regenerado correctamente."
    }
}

if ($OpenDashboard) {
    Start-Process .\index.html
}
