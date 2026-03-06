# AHDL Drone Simulation - Windows Setup Script
# Run: Set-ExecutionPolicy -Scope Process Bypass; .\setup.ps1

Write-Host ""
Write-Host "AHDL Drone Simulation - Windows Setup" -ForegroundColor Cyan
Write-Host "--------------------------------------"
Write-Host ""

$hasErrors = $false

# ─── Check WSL2 ──────────────────────────────────────────────────────────────

Write-Host "[CHECK] WSL2..." -ForegroundColor Blue
try {
    $wslOutput = wsl --status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK]    WSL2 is installed" -ForegroundColor Green
    } else {
        throw "WSL not available"
    }
} catch {
    Write-Host "[WARN]  WSL2 is not installed or not configured" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Install WSL2 (run as Administrator):"
    Write-Host "    wsl --install"
    Write-Host "    wsl --set-default-version 2"
    Write-Host ""
    $hasErrors = $true
}

# ─── Check Docker Desktop ───────────────────────────────────────────────────

Write-Host "[CHECK] Docker Desktop..." -ForegroundColor Blue
try {
    $dockerVersion = docker version --format '{{.Server.Version}}' 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK]    Docker is installed (v$dockerVersion)" -ForegroundColor Green
    } else {
        throw "Docker not running"
    }
} catch {
    $dockerPath = Get-Command docker -ErrorAction SilentlyContinue
    if ($dockerPath) {
        Write-Host "[ERR]   Docker is installed but the daemon is not running" -ForegroundColor Red
        Write-Host "        Start Docker Desktop from the Start menu"
    } else {
        Write-Host "[ERR]   Docker is not installed" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Install Docker Desktop:"
        Write-Host "    https://docs.docker.com/desktop/install/windows-install/"
        Write-Host ""
        Write-Host "  After installation:"
        Write-Host "    1. Open Docker Desktop"
        Write-Host "    2. Go to Settings > General"
        Write-Host "    3. Ensure 'Use WSL 2 based engine' is checked"
    }
    Write-Host ""
    $hasErrors = $true
}

# ─── Check Docker Compose ───────────────────────────────────────────────────

Write-Host "[CHECK] Docker Compose..." -ForegroundColor Blue
try {
    $composeVersion = docker compose version --short 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK]    Docker Compose is available (v$composeVersion)" -ForegroundColor Green
    } else {
        throw "Compose not available"
    }
} catch {
    Write-Host "[WARN]  Docker Compose plugin not found" -ForegroundColor Yellow
    Write-Host "        Docker Desktop should include it. Update Docker Desktop."
    $hasErrors = $true
}

# ─── Check Make ──────────────────────────────────────────────────────────────

Write-Host "[CHECK] Make..." -ForegroundColor Blue
$makePath = Get-Command make -ErrorAction SilentlyContinue
if ($makePath) {
    Write-Host "[OK]    make is available" -ForegroundColor Green
} else {
    Write-Host "[WARN]  make is not installed (optional)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Install make (pick one):"
    Write-Host "    winget install GnuWin32.Make"
    Write-Host "    choco install make"
    Write-Host ""
    Write-Host "  Or skip make and use docker compose directly:"
    Write-Host "    docker compose up --build -d"
}

# ─── Validate Compose File ──────────────────────────────────────────────────

if (-not $hasErrors) {
    Write-Host ""
    Write-Host "[CHECK] Validating docker-compose.yml..." -ForegroundColor Blue
    Push-Location $PSScriptRoot
    try {
        docker compose config --quiet 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK]    docker-compose.yml is valid" -ForegroundColor Green
        } else {
            Write-Host "[ERR]   docker-compose.yml validation failed" -ForegroundColor Red
            docker compose config 2>&1
        }
    } finally {
        Pop-Location
    }
}

# ─── Performance Note ────────────────────────────────────────────────────────

Write-Host ""
Write-Host "[TIP]   For best performance, place the project on the WSL2 filesystem:" -ForegroundColor Yellow
Write-Host "        \\wsl$\Ubuntu\home\<user>\AHDL-paper"
Write-Host "        NOT on C:\Users\... (Windows filesystem is slow in containers)"

# ─── Summary ─────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "--------------------------------------"
if ($hasErrors) {
    Write-Host "Setup has warnings. Fix the issues above, then run:" -ForegroundColor Yellow
} else {
    Write-Host "Setup complete!" -ForegroundColor Green
}
Write-Host ""
Write-Host "  Next steps:"
Write-Host "    make run                         # If make is installed"
Write-Host "    docker compose up --build -d     # Without make"
Write-Host ""
Write-Host "  Services:"
Write-Host "    Frontend:       http://localhost:3001"
Write-Host "    Database API:   http://localhost:8001"
Write-Host "    Simulation API: http://localhost:8002"
Write-Host ""

# ─── Offer to start ─────────────────────────────────────────────────────────

if (-not $hasErrors) {
    $answer = Read-Host "Start services now? [y/N]"
    if ($answer -match "^[Yy]") {
        Push-Location $PSScriptRoot
        docker compose up --build -d
        Pop-Location
    }
}
