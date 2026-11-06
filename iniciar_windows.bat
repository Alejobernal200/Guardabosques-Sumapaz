@echo off
chcp 65001 > nul
title Guardabosques Sumapaz - Monitoreo Satelital

echo ======================================================================
echo           GUARDABOSQUES SUMAPAZ - INICIADOR PARA WINDOWS
echo ======================================================================
echo.

REM 1. Verificar si Python está instalado en Windows
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] No se encontro Python instalado en este equipo.
    echo.
    echo Pasos rapidos para instalarlo:
    echo  1. Ve a https://www.python.org/downloads/
    echo  2. Descarga el instalador de Python para Windows.
    echo  3. IMPORTANTE: Durante la instalacion marca la casilla:
    echo     "Add Python to PATH" (Agregar Python al PATH).
    echo.
    pause
    exit /b 1
)

echo [1/3] Python detectado correctamente:
python --version

echo.
echo [2/3] Instalando librerias necesarias (fastapi, uvicorn, requests, pydantic)...
python -m pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo.
    echo [AVISO] pip reporto un aviso. No te preocupes:
    echo El sistema activara automaticamente el servidor autonomo de contingencia.
)

echo.
echo [3/3] Iniciando el servidor web de Guardabosques Sumapaz...
echo.
echo ======================================================================
echo  Plataforma activa en: http://localhost:8000
echo  Para detener el servidor presiona Ctrl + C en esta ventana.
echo ======================================================================
echo.

REM Abrir automaticamente la aplicacion en el navegador predeterminado de Windows
start http://localhost:8000

REM Ejecutar el servidor Python
python main.py

pause
