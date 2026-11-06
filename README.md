# Guardabosques Sumapaz 🛰️🔥

**Plataforma de alerta temprana, monitoreo satelital y divulgación científica para la detección de anomalías térmicas en tiempo real en el Páramo de Sumapaz mediante datos abiertos de NASA FIRMS (sensores VIIRS y MODIS).**

---

## 📋 Tabla de Contenidos
1. [Descripción General](#-descripción-general)
2. [Delimitación Geográfica (Bounding Box)](#-delimitación-geográfica-bounding-box)
3. [Fundamentos Físicos y Científicos](#-fundamentos-físicos-y-científicos)
4. [Estructura del Proyecto](#-estructura-del-proyecto)
5. [Requisitos Previos](#-requisitos-previos)
6. [Instalación y Puesta en Marcha](#-instalación-y-puesta-en-marcha)
   - [Opción A: Servidor FastAPI con Uvicorn (Recomendada)](#opción-a-servidor-fastapi-con-uvicorn-recomendada)
   - [Opción B: Servidor Autónomo (Sin dependencias externas)](#opción-b-servidor-autónomo-sin-dependencias-externas)
   - [Opción C: Interfaz React / Vite SPA](#opción-c-interfaz-react--vite-spa)
7. [Documentación de la API](#-documentación-de-la-api)
8. [Configuración de NASA FIRMS (Opcional)](#-configuración-de-nasa-firms-opcional)
9. [Uso Operativo para Brigadas y Guardaparques](#-uso-operativo-para-brigadas-y-guardaparques)
10. [Licencia](#-licencia)

---

## 🌲 Descripción General

El **Páramo de Sumapaz** (Colombia) es el complejo de páramos más grande del planeta Tierra. Es un ecosistema de alta montaña vital para la regulación hídrica de la sabana de Bogotá y las cuencas de los ríos Orinoco y Magdalena.

Sin embargo, sus extensas coberturas de frailejones (*Espeletia spp.*), pajonales y turberas acumulan capas profundas de materia orgánica altamente susceptibles al fuego en épocas de estiaje o por quemas agropecuarias descontroladas.

**Guardabosques Sumapaz** es una solución integral full-stack que:
- Ingesta datos continuos de anomalías térmicas y puntos de calor de los satélites polares **Suomi-NPP / NOAA-20 (VIIRS, 375m)** y **Terra / Aqua (MODIS, 1km)** de la NASA.
- Filtra rigurosamente los focos térmicos dentro de la delimitación geográfica oficial de Sumapaz.
- Clasifica la severidad radiométrica mediante la **Potencia Radiativa de Fuego (FRP)** en Megavatios (MW).
- Ofrece herramientas tácticas de exportación en formato **CSV** e **impresión de fichas PMU** con coordenadas en grados decimales y **Grados-Minutos-Segundos (DMS)** para receptores GPS de campo (Garmin / móvil).
- Integra un módulo didáctico e interactivo de **divulgación científica** que explica los principios biofísicos de la teledetección.

---

## 🗺️ Delimitación Geográfica (Bounding Box)

El sistema vigila y confina los análisis estrictamente al polígono de Sumapaz:
- **Latitud Sur:** $3.70^\circ\text{ N}$
- **Latitud Norte:** $4.40^\circ\text{ N}$
- **Longitud Oeste:** $-74.50^\circ\text{ W}$
- **Longitud Este:** $-73.90^\circ\text{ W}$
- **Centro del Mapa:** $4.05^\circ\text{ N}, -74.20^\circ\text{ W}$
- **Nivel de Zoom por defecto:** 10

Sectores monitoreados: *Cuenca Río Blanco / San Juan, Alto de las Cruces / Chisacá, Sector Nazaret / Curubital, Sector Cabrera / Peñas Blancas, Zona de Amortiguación Pasca, Laguna de Chisacá / Usme, Sector Santa Rosa / El Nevado, Sector La Unión / Duda*.

---

## 🔬 Fundamentos Físicos y Científicos

### 1. Ley de Stefan-Boltzmann: Radiación Total
$$E = \varepsilon \cdot \sigma \cdot T^4$$

- $\sigma = 5.670374 \times 10^{-8}\ \text{W}/(\text{m}^2\cdot\text{K}^4)$ (Constante de Stefan-Boltzmann).
- $\varepsilon \approx 0.95$ (Emisividad de la biomasa vegetal del páramo).
- $T$: Temperatura termodinámica absoluta en Kelvin (K).

> **Principio de detección:** Debido a la dependencia con $T^4$, cuando la biomasa pasa de la temperatura ambiente de páramo ($300\text{ K} \approx 27^\circ\text{C}$) a temperatura de combustión incipiente ($600\text{ K} \approx 327^\circ\text{C}$), la emitancia radiativa no se duplica, ¡sino que se multiplica por **16** ($2^4$)!

### 2. Ley de Desplazamiento de Wien: Por qué se usa el Infrarrojo Medio (3.9 µm)
$$\lambda_{\max} \cdot T = b \approx 2897.77\ \mu\text{m}\cdot\text{K}$$

- **Fondo ambiental y suelo frío ($T \approx 300\text{ K}$):**
  $$\lambda_{\max} = \frac{2897.77}{300} \approx 9.66\ \mu\text{m}$$
  (Emite en el Infrarrojo Térmico Lejano o TIR, canales a $\sim 10.8\text{ a }11.0\ \mu\text{m}$).
- **Frente de fuego de biomasa ($T \approx 800 - 1200\text{ K}$):**
  $$\lambda_{\max} = \frac{2897.77}{800} \approx 3.62\ \mu\text{m}$$
  (Su pico de emisión coincide exactamente con la **Banda I-4 de VIIRS** y los **Canales 21/22 de MODIS** en $3.7 - 3.9\ \mu\text{m}$).

> **Sensibilidad sub-píxel:** Aunque el frente activo de una quema cubra apenas el $0.05\%$ del área física del píxel satelital ($375\text{ m} \times 375\text{ m}$), el colosal incremento de radiancia a $3.9\ \mu\text{m}$ resalta con nitidez sobre el fondo frío del páramo.

### 3. Potencia Radiativa de Fuego (FRP en Megavatios)
$$\text{Tasa de Pérdida de Biomasa (kg/s)} \approx 0.368\ (\pm 0.015) \times \text{FRP (MW)}$$

Formulada por Wooster et al. (2005), la Potencia Radiativa de Fuego cuantifica la tasa instantánea de energía liberada por la combustión de vegetación. Un foco de $50\text{ MW}$ calcina cerca de $18.4\text{ kg}$ de biomasa de páramo (frailejones, pajonales y turberas) cada segundo.

### 🚦 Semaforización por FRP
- 🟡 **Verde/Amarillo ($\text{FRP} < 10\text{ MW}$):** Baja intensidad o posible falso positivo / quema incipiente.
- 🟠 **Naranja ($10\text{ MW} \le \text{FRP} < 50\text{ MW}$):** Intensidad media / alta confianza de frente de fuego activo.
- 🔴 **Rojo ($\text{FRP} \ge 50\text{ MW}$):** Alta intensidad energética / incendio forestal activo de biomasa (marcador con halo pulsante).

---

## 📂 Estructura del Proyecto

```
guardabosques-sumapaz/
├── main.py                 # Backend FastAPI con soporte dual (Uvicorn / Servidor autónomo)
├── requirements.txt        # Dependencias Python (fastapi, uvicorn, requests, pydantic)
├── README.md               # Documentación científica y manual de despliegue
├── static/                 # Frontend SPA nativo (HTML5 + Leaflet.js + Tailwind CSS)
│   ├── index.html          # Interfaz de usuario responsiva Mobile-First
│   ├── app.js              # Lógica Leaflet, ingesta de API, semaforización y exportación
│   └── style.css           # Estilos complementarios, popups y formatos de impresión
├── src/                    # Frontend React 19 + TypeScript (AI Studio Applet)
│   ├── App.tsx             # Aplicación React con Leaflet y simulador de laboratorio
│   ├── main.tsx            # Punto de entrada de React
│   └── index.css           # Estilos Tailwind CSS
├── index.html              # Plantilla raíz Vite SPA
├── package.json            # Dependencias Node.js / React
├── tsconfig.json           # Configuración de TypeScript
└── vite.config.ts          # Configuración de Vite
```

---

## ⚙️ Requisitos Previos

- **Python 3.9 o superior** (para el backend).
- Opcional: **Node.js 18+** y **npm** (si deseas ejecutar el frontend con Vite).
- Conexión a Internet para descargar las capas cartográficas de Leaflet (OpenStreetMap / CartoDB / Esri).

---

## 🚀 Instalación y Puesta en Marcha

### Opción A: Servidor FastAPI con Uvicorn (Recomendada)

1. **Clonar o descomprimir el proyecto:**
   ```bash
   cd guardabosques-sumapaz
   ```

2. **Crear y activar un entorno virtual (recomendado):**
   ```bash
   python -m venv venv
   # En Linux / macOS:
   source venv/bin/activate
   # En Windows:
   venv\Scripts\activate
   ```

3. **Instalar las dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Iniciar la aplicación:**
   ```bash
   python main.py
   ```
   *Alternativamente con Uvicorn CLI:*
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

5. **Acceder a la plataforma:**
   - Interfaz Web: [http://localhost:8000](http://localhost:8000)
   - Documentación interactiva Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)
   - Redoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

### Opción B: Servidor Autónomo (Sin dependencias externas)

Si te encuentras en una máquina o servidor sin permisos de instalación (`pip`), el archivo `main.py` detecta automáticamente la ausencia de librerías y activa el **servidor HTTP multihilo nativo** de la biblioteca estándar de Python:

```bash
python main.py
```
El servidor servirá la API JSON `/api/thermal-anomalies` y la aplicación web completa en [http://localhost:8000](http://localhost:8000) sin requerir ninguna instalación previa.

---

### Opción C: Interfaz React / Vite SPA

Si deseas desarrollar o ejecutar el cliente moderno con React 19 y Tailwind CSS:

```bash
npm install
npm run dev
```
La aplicación abrirá en [http://localhost:3000](http://localhost:3000).

---

## 📡 Documentación de la API

### Endpoint: `GET /api/thermal-anomalies`

Devuelve las anomalías térmicas filtradas para el Bounding Box de Sumapaz.

#### Parámetros de consulta (Query Params):
| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `hours` | `int` | `24` | Ventana temporal de detección (ej. `24`, `48`, `72`). |
| `source` | `string` | `"ALL"` | Sensor satelital: `"ALL"`, `"VIIRS"`, `"MODIS"`. |
| `min_frp` | `float` | `0.0` | Filtrar solo focos con FRP mayor o igual al valor en MW. |

#### Respuesta de ejemplo (`200 OK`):
```json
{
  "status": "success",
  "total_anomalies": 14,
  "data_source": "NASA FIRMS NRT Live API",
  "time_window_hours": 24,
  "max_frp": 94.2,
  "total_frp": 312.6,
  "high_risk_count": 2,
  "medium_risk_count": 4,
  "low_risk_count": 8,
  "bbox": {
    "lat_min": 3.70,
    "lat_max": 4.40,
    "lon_min": -74.50,
    "lon_max": -73.90,
    "center_lat": 4.05,
    "center_lon": -74.20,
    "default_zoom": 10
  },
  "anomalies": [
    {
      "id": "SUMA-1102-001",
      "latitude": 4.02512,
      "longitude": -74.28145,
      "frp": 94.2,
      "bright_ti4": 368.5,
      "acq_date": "2026-11-02",
      "acq_time": "1845",
      "confidence": "high",
      "satellite": "VIIRS-NOAA20",
      "sector": "Cuenca Río Blanco / San Juan",
      "risk_level": "ALTO",
      "stefan_boltzmann_flux": 100.32
    }
  ],
  "generated_at": "2026-11-02T18:43:00.000000+00:00"
}
```

---

## 🔑 Configuración de NASA FIRMS (Opcional)

Por defecto, la aplicación incluye un motor de contingencia calibrado ultra-realista que opera sin claves. Para conectar con la API en vivo de NASA EOSDIS FIRMS:

1. Obtén una clave de mapa gratuita (`MAP_KEY`) en: [https://firms.modaps.eosdis.nasa.gov/api/map_key](https://firms.modaps.eosdis.nasa.gov/api/map_key)
2. Define la variable de entorno antes de ejecutar:
   ```bash
   # En Linux / macOS:
   export FIRMS_MAP_KEY="tu_clave_nasa_firms"

   # En Windows (CMD):
   set FIRMS_MAP_KEY=tu_clave_nasa_firms

   # En Windows (PowerShell):
   $env:FIRMS_MAP_KEY="tu_clave_nasa_firms"
   ```
3. Ejecuta `python main.py`. El sistema consultará automáticamente el área de Sumapaz en tiempo real en los servidores de la NASA.

---

## 🚒 Uso Operativo para Brigadas y Guardaparques

1. **Visualización y Monitoreo:**
   - Haz clic en los botones `24h`, `48h` o `72h` para alternar la ventana de paso satelital.
   - Haz clic sobre cualquier foco térmico en el mapa o en la lista lateral para desplegar sus parámetros físicos (Brillo en Kelvin, equivalencia en Celsius, Flujo de Stefan-Boltzmann, Potencia FRP y Coordenadas).
2. **Generación de Reporte para PMU (Puesto de Mando Unificado):**
   - Pulsa el botón **Reporte Brigadas**.
   - Se abrirá la ficha operativa estandarizada con tabla de coordenadas **DMS** (*ej. 4°1'30"N 74°16'53"W*) y formato Decimal.
   - Pulsa **Descargar CSV** para importar directamente en Garmin BaseCamp, Google Earth Pro, QGIS o ArcGIS.
   - Pulsa **Imprimir / Guardar PDF** para generar una copia física con diseño limpio optimizado para papel o envío por radioenlace satelital.
3. **Divulgación Científica:**
   - Pulsa **Divulgación Científica** para consultar las fórmulas teóricas de teledetección y utilizar el simulador didáctico de cuerpo negro.

---

## 🌐 Publicación en GitHub Pages (Solución a Pantalla en Blanco)

Si al publicar en GitHub Pages la pantalla sale en blanco, se debe a dos razones comunes:
1. **Rutas absolutas:** Por defecto Vite busca archivos en `/assets/` en lugar de `./assets/`. Ya se configuró `base: './'` en `vite.config.ts`.
2. **Archivos sin compilar:** GitHub Pages es un servidor estático y **no compila TypeScript (`.tsx`) en vivo**. No se puede servir directamente la rama con el código fuente en TypeScript sin compilarlo a HTML/CSS/JS.

### ✅ Método 1: GitHub Actions (Automático - 1 Clic)
Este repositorio ya incluye el flujo automatizado en `.github/workflows/deploy.yml`. Solo debes activarlo en tu repositorio de GitHub:

1. Ve a tu repositorio en GitHub.
2. Haz clic en **Settings** (Configuración) &rarr; **Pages** (en el menú lateral izquierdo).
3. En **Build and deployment** &rarr; **Source**, selecciona:
   👉 **`GitHub Actions`** (en lugar de *"Deploy from a branch"*).
4. Haz cualquier `git push` a `main` o `master`:
   ```bash
   git add .
   git commit -m "Configurar despliegue GitHub Pages"
   git push origin main
   ```
5. GitHub compilará automáticamente el proyecto y lo publicará en tu URL:
   `https://<tu-usuario>.github.io/<nombre-del-repo>/`

---

### 📦 Método 2: Despliegue Manual de la carpeta `dist`
Si prefieres usar la opción clásica *"Deploy from a branch"*:
1. Compila el proyecto en tu máquina local:
   ```bash
   npm run build
   ```
   *(Esto creará la carpeta `dist/` con el `index.html` y los scripts ya compilados a JavaScript puro).*
2. En GitHub Pages, debes indicar que se sirva la carpeta `dist` (puedes crear una rama `gh-pages` con el contenido de `dist`).

---

### ⚡ Método 3: Versión Estática Ultraligera (Sin Node.js)
Si no deseas usar Node.js ni compiladores, la carpeta `static/` contiene una versión 100% nativa en HTML5, Leaflet.js y Tailwind CDN:
- Puedes copiar los 3 archivos de `static/` (`index.html`, `app.js`, `style.css`) en una carpeta llamada `docs/` en tu repositorio.
- En **Settings &rarr; Pages**, selecciona *"Deploy from a branch"* &rarr; Rama `main` &rarr; Carpeta `/docs`.
- Guardas y la página cargará de inmediato.

---

## 📄 Licencia

Desarrollado bajo licencia Apache 2.0. Código libre, modular y listo para su uso por Parques Nacionales Naturales de Colombia, Cuerpos de Bomberos, Defensa Civil y la comunidad científica.

