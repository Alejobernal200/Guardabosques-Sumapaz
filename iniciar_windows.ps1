# ======================================================================
# GUARDABOSQUES SUMAPAZ - INICIADOR POWERSHELL PARA WINDOWS
# ======================================================================

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "          GUARDABOSQUES SUMAPAZ - INICIADOR POWERSHELL" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar si Python está instalado
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] No se encontró Python en el sistema." -ForegroundColor Red
    Write-Host "Por favor instala Python 3.9 o superior desde https://www.python.org/"
    Write-Host "Asegúrate de marcar la opción 'Add Python to PATH'."
    Read-Host "Presiona Enter para salir..."
    exit 1
}

Write-Host "[1/3] Python detectado:" -ForegroundColor Green
python --version

Write-Host ""
Write-Host "[2/3] Instalando dependencias de requirements.txt..." -ForegroundColor Yellow
python -m pip install -r requirements.txt

Write-Host ""
Write-Host "[3/3] Iniciando servidor en http://localhost:8000..." -ForegroundColor Green
Write-Host "Abriendo en tu navegador predeterminado..."

Start-Process "http://localhost:8000"

python main.py
