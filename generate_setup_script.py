#!/usr/bin/env python3
"""
Generador automático de setup_project.py
Lee los archivos del proyecto y crea un script Python autocontenido que puede reconstruir
el proyecto completo sin herramientas externas de compresión.
"""

import json
import os

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

TARGET_FILES = [
    "main.py",
    "requirements.txt",
    "README.md",
    "iniciar_windows.bat",
    "iniciar_windows.ps1",
    "static/index.html",
    "static/app.js",
    "static/style.css",
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    ".env.example",
    ".gitignore",
    "metadata.json"
]

def make_setup_script():
    payload = {}
    for rel_path in TARGET_FILES:
        full_path = os.path.join(PROJECT_DIR, rel_path)
        if os.path.isfile(full_path):
            with open(full_path, "r", encoding="utf-8") as f:
                payload[rel_path] = f.read()

    encoded_json = json.dumps(payload, indent=2, ensure_ascii=False)

    template = '''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
GUARDABOSQUES SUMAPAZ - AUTO-EXTRACTOR Y CONSTRUCTOR DEL PROYECTO
================================================================================
Este script crea directamente en disco todos los archivos y carpetas del proyecto
Guardabosques Sumapaz sin requerir WinRAR, 7-Zip ni herramientas externas de descompresión.
Totalmente compatible con Windows, macOS y Linux.

Instrucciones:
1. Guarda este archivo como 'setup_project.py' en una carpeta vacía.
2. Ejecuta en tu terminal, CMD o PowerShell:
   python setup_project.py
3. ¡Listo! Se habrán creado todos los archivos listos para usar.
   En Windows puedes simplemente hacer doble clic en 'iniciar_windows.bat'.
"""

import os
import sys

PROJECT_DATA = __ENCODED_JSON__

def extract_project():
    print("=" * 70)
    print(" INICIANDO CONSTRUCCIÓN DE GUARDABOSQUES SUMAPAZ")
    print("=" * 70)

    total = len(PROJECT_DATA)
    count = 0

    for file_path, content in PROJECT_DATA.items():
        native_path = os.path.normpath(file_path)
        dir_name = os.path.dirname(native_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)

        with open(native_path, "w", encoding="utf-8") as f:
            f.write(content)

        count += 1
        print(f" [{count}/{total}] Creado: {native_path}")

    print("=" * 70)
    print(" ¡PROYECTO EXTRAÍDO CON ÉXITO!")
    print("=" * 70)
    print("\\nPara iniciar el sistema en WINDOWS:")
    print("  -> Haz doble clic en: iniciar_windows.bat")
    print("\\nO mediante terminal / CMD / PowerShell:")
    print("  1. Instalar dependencias:")
    print("     pip install -r requirements.txt")
    print("  2. Iniciar el servidor:")
    print("     python main.py")
    print("  3. Abrir en el navegador:")
    print("     http://localhost:8000\\n")

if __name__ == "__main__":
    extract_project()
'''

    script_content = template.replace("__ENCODED_JSON__", encoded_json)

    output_path = os.path.join(PROJECT_DIR, "setup_project.py")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(script_content)

    os.makedirs(os.path.join(PROJECT_DIR, "public"), exist_ok=True)
    os.makedirs(os.path.join(PROJECT_DIR, "static"), exist_ok=True)
    with open(os.path.join(PROJECT_DIR, "public", "setup_project.py"), "w", encoding="utf-8") as f:
        f.write(script_content)
    with open(os.path.join(PROJECT_DIR, "static", "setup_project.py"), "w", encoding="utf-8") as f:
        f.write(script_content)

    print(f"Script de instalación setup_project.py creado ({len(payload)} archivos empaquetados).")

if __name__ == "__main__":
    make_setup_script()
