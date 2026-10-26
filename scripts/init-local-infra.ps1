# Script para inicializar o ambiente de infraestrutura local via Docker Compose
Write-Host "Iniciando infraestrutura local (PostgreSQL + LocalStack)..." -ForegroundColor Cyan

docker-compose up -d postgres localstack

Write-Host "Aguardando serviços ficarem saudáveis..." -ForegroundColor Yellow

$maxAttempts = 30
$attempt = 0
$healthy = $false

while ($attempt -lt $maxAttempts -and -not $healthy) {
    Start-Sleep -Seconds 2
    $attempt++
    
    $pgStatus = (docker inspect --format='{{json .State.Health.Status}}' smartcity-postgres 2>$null) -replace '"',''
    $lsStatus = (docker inspect --format='{{json .State.Health.Status}}' smartcity-localstack 2>$null) -replace '"',''

    Write-Host "Tentativa $attempt: Postgres = $pgStatus, LocalStack = $lsStatus"

    if ($pgStatus -eq "healthy" -and $lsStatus -eq "healthy") {
        $healthy = $true
    }
}

if ($healthy) {
    Write-Host "Ambiente local pronto para desenvolvimento!" -ForegroundColor Green
    Write-Host "PostgreSQL: localhost:5433 (smartcity / postgres / postgres)"
    Write-Host "LocalStack: http://localhost:4566"
} else {
    Write-Host "Aviso: Nem todos os serviços reportaram healthy dentro do tempo limite. Verifique com 'docker compose ps'." -ForegroundColor Red
}
