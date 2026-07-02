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
    $state = @{}
    $budgetFile = Get-ChildItem -Path $dataDir -File | Where-Object {
        $_.Name.ToLower() -in @('presupuestos.xlsx', 'presupuestos ventas.xlsx')
    } | Select-Object -First 1

    if (-not $budgetFile) {
        throw "No se encontro archivo de presupuestos en $dataDir"
    }

    $salesFiles = Get-ChildItem -Path $dataDir -File | Where-Object {
        $_.Name -match '^VENTAS_\d{4}\.xlsx$'
    } | Sort-Object Name

    if ($salesFiles.Count -lt 2) {
        throw "Se necesitan al menos dos archivos VENTAS_YYYY.xlsx en $dataDir"
    }

    $targets = @($budgetFile) + $salesFiles

    foreach ($target in $targets) {
        $state[$target.Name] = [ordered]@{
            path = $target.FullName
            lastWriteUtc = $target.LastWriteTimeUtc.ToString("o")
            length = $target.Length
        }
    }

    return $state
}

function Write-Log($logPath, $message) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $message
    Add-Content -Path $logPath -Value $line
    Write-Host $message
}

function Publish-DashboardViaFtp {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LocalRoot,
        [Parameter(Mandatory = $true)]
        [string]$RemoteBase,
        [Parameter(Mandatory = $true)]
        [string]$Server,
        [Parameter(Mandatory = $true)]
        [string]$Username,
        [Parameter(Mandatory = $true)]
        [string]$Password,
        [Parameter(Mandatory = $true)]
        [string[]]$Files,
        [string]$LogPath,
        [switch]$UseSsl
    )

    function Invoke-FtpRequest {
        param(
            [string]$Uri,
            [string]$Method,
            [byte[]]$Payload
        )

        $originalCallback = [System.Net.ServicePointManager]::ServerCertificateValidationCallback
        try {
            if ($UseSsl) {
                [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
            }

            $request = [System.Net.FtpWebRequest]::Create($Uri)
            $request.Method = $Method
            $request.Credentials = New-Object System.Net.NetworkCredential($Username, $Password)
            $request.UseBinary = $true
            $request.UsePassive = $true
            $request.KeepAlive = $false
            $request.EnableSsl = [bool]$UseSsl
            $request.Proxy = $null

            if ($Method -eq [System.Net.WebRequestMethods+Ftp]::UploadFile) {
                $request.ContentLength = $Payload.Length
                $requestStream = $request.GetRequestStream()
                try {
                    $requestStream.Write($Payload, 0, $Payload.Length)
                } finally {
                    $requestStream.Close()
                }
            }

            $response = $request.GetResponse()
            try {
                return $response.StatusDescription
            } finally {
                $response.Close()
            }
        } finally {
            if ($UseSsl) {
                [System.Net.ServicePointManager]::ServerCertificateValidationCallback = $originalCallback
            }
        }
    }

    $remoteBase = $RemoteBase.TrimEnd('/')
    $currentPath = "ftp://$Server/$remoteBase"

    foreach ($fileName in $Files) {
        $localPath = Join-Path $LocalRoot $fileName
        if (-not (Test-Path $localPath)) {
            throw "No se encontro el fichero local necesario para FTP: $localPath"
        }

        $remoteFileUri = "$currentPath/$fileName"
        $payload = [System.IO.File]::ReadAllBytes($localPath)
        Write-Log $LogPath "Subiendo $fileName a $remoteFileUri"
        Invoke-FtpRequest -Uri $remoteFileUri -Method ([System.Net.WebRequestMethods+Ftp]::UploadFile) -Payload $payload | Out-Null
    }
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

$publishChoice = Read-Host "¿Desea actualizar via FTP la carpeta web www.caroruiz.es/dashboard? (S/N)"
if ($publishChoice -match '^[sS]') {
    Write-Log $dailyLogPath "Publicacion FTP solicitada por el usuario."
    try {
        Publish-DashboardViaFtp `
            -LocalRoot $PSScriptRoot `
            -RemoteBase 'www.caroruiz.es/dashboard' `
            -Server 'ftp.caroruiz.es' `
            -Username '2595037@aruba.it' `
            -Password '$Monterde$2024.' `
            -Files @('index.html', 'app.js', 'styles.css', 'data.js') `
            -LogPath $dailyLogPath `
            -UseSsl
        Write-Log $dailyLogPath "Publicacion FTP completada correctamente usando FTPS."
    } catch {
        Write-Log $dailyLogPath ("FTPS fallo: {0}. Reintentando sin SSL..." -f $_.Exception.Message)
        Publish-DashboardViaFtp `
            -LocalRoot $PSScriptRoot `
            -RemoteBase 'www.caroruiz.es/dashboard' `
            -Server 'ftp.caroruiz.es' `
            -Username '2595037@aruba.it' `
            -Password '$Monterde$2024.' `
            -Files @('index.html', 'app.js', 'styles.css', 'data.js') `
            -LogPath $dailyLogPath
        Write-Log $dailyLogPath "Publicacion FTP completada correctamente usando FTP sin SSL."
    }
} else {
    Write-Log $dailyLogPath "Publicacion FTP omitida por el usuario."
}

if ($OpenDashboard) {
    Start-Process .\index.html
}
