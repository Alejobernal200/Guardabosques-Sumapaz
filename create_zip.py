#!/usr/bin/env python3
"""
Script para empaquetar todo el proyecto Guardabosques Sumapaz en un archivo .zip
limpio, excluyendo node_modules, dist y temporales.
"""

import os
import shutil
import zipfile

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
ZIP_NAME = "guardabosques-sumapaz.zip"

INCLUDED_FILES = [
    "main.py",
    "requirements.txt",
    "README.md",
    "setup_project.py",
    "iniciar_windows.bat",
    "iniciar_windows.ps1",
    "metadata.json",
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    ".env.example",
    ".gitignore",
]

INCLUDED_DIRS = [
    "static",
    "src",
]

EXCLUDE_PATTERNS = [
    "node_modules",
    "dist",
    "__pycache__",
    ".git",
    ".DS_Store",
    ".cache",
    "*.pyc",
    "guardabosques-sumapaz.zip",
    ".zip"
]

def should_exclude(path):
    for pattern in EXCLUDE_PATTERNS:
        if pattern in path:
            return True
    return False

def build_zip():
    zip_path = os.path.join(PROJECT_DIR, ZIP_NAME)
    print(f"Creando archivo comprimido en {zip_path}...")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        # Archivos raíz individuales
        for filename in INCLUDED_FILES:
            file_path = os.path.join(PROJECT_DIR, filename)
            if os.path.isfile(file_path):
                arcname = os.path.join("guardabosques-sumapaz", filename)
                zipf.write(file_path, arcname)
                print(f"  + Agregado: {arcname}")

        # Directorios
        for dirname in INCLUDED_DIRS:
            dir_path = os.path.join(PROJECT_DIR, dirname)
            if os.path.isdir(dir_path):
                for root, _, files in os.walk(dir_path):
                    for file in files:
                        full_path = os.path.join(root, file)
                        if should_exclude(full_path):
                            continue
                        rel_path = os.path.relpath(full_path, PROJECT_DIR)
                        arcname = os.path.join("guardabosques-sumapaz", rel_path)
                        zipf.write(full_path, arcname)
                        print(f"  + Agregado: {arcname}")

    # Copiar también a public/ y static/ para descarga directa HTTP
    public_target = os.path.join(PROJECT_DIR, "public", ZIP_NAME)
    static_target = os.path.join(PROJECT_DIR, "static", ZIP_NAME)

    shutil.copyfile(zip_path, public_target)
    shutil.copyfile(zip_path, static_target)

    size_kb = os.path.getsize(zip_path) / 1024
    print(f"\n¡Éxito! Archivo ZIP generado ({size_kb:.1f} KB):")
    print(f" - {zip_path}")
    print(f" - {public_target}")
    print(f" - {static_target}")

if __name__ == "__main__":
    build_zip()
