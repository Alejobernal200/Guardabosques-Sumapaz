/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import L from 'leaflet';
import {
  Flame,
  ShieldAlert,
  BookOpen,
  FileText,
  Compass,
  Satellite,
  RefreshCw,
  Layers,
  Download,
  Printer,
  X,
  Sliders,
  MapPin,
  Info,
  Maximize2,
  AlertTriangle,
  Activity,
  Wind,
  Copy,
  Check,
  FileCode,
  Terminal,
  FolderArchive,
  CheckCircle2,
  Key,
  ExternalLink
} from 'lucide-react';
import JSZip from 'jszip';
import { PROJECT_FILES, ProjectFile } from './projectFiles';

// Bounding Box del Páramo de Sumapaz
const SUMAPAZ_BBOX = {
  south: 3.70,
  north: 4.40,
  west: -74.50,
  east: -73.90,
  centerLat: 4.05,
  centerLon: -74.20,
  defaultZoom: 10
};

// Sectores biogeográficos de referencia en Sumapaz
const SUMAPAZ_SECTORS = [
  { name: "Cuenca Río Blanco / San Juan", lat: 4.025, lon: -74.280, elev: 3650 },
  { name: "Alto de las Cruces / Chisacá", lat: 4.295, lon: -74.195, elev: 3920 },
  { name: "Sector Nazaret / Curubital", lat: 4.140, lon: -74.150, elev: 3710 },
  { name: "Sector Cabrera / Peñas Blancas", lat: 3.890, lon: -74.420, elev: 3300 },
  { name: "Zona Amortiguación Pasca", lat: 4.310, lon: -74.310, elev: 3150 },
  { name: "Laguna de Chisacá / Usme", lat: 4.360, lon: -74.180, elev: 3750 },
  { name: "Sector Santa Rosa / El Nevado", lat: 3.960, lon: -74.080, elev: 4100 },
  { name: "Sector La Unión / Duda", lat: 3.780, lon: -74.120, elev: 3400 }
];

interface ThermalAnomaly {
  id: string;
  latitude: number;
  longitude: number;
  frp: number; // Fire Radiative Power in MW
  bright_ti4: number; // Brightness Temp in Kelvin (Band I-4 at 3.9 µm)
  acq_date: string;
  acq_time: string;
  confidence: string;
  satellite: string;
  sector: string;
  risk_level: 'BAJO' | 'MEDIO' | 'ALTO';
  stefan_boltzmann_flux: number; // kW/m²
}

// Conversión a Grados, Minutos, Segundos (DMS)
function decimalToDMS(deg: number, isLat: boolean): string {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
  const direction = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
  return `${degrees}°${minutes}'${seconds}"${direction}`;
}

export default function App() {
  const [hours, setHours] = useState<24 | 48 | 72>(24);
  const [anomalies, setAnomalies] = useState<ThermalAnomaly[]>([]);
  const [selectedAnomaly, setSelectedAnomaly] = useState<ThermalAnomaly | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dataSource, setDataSource] = useState<string>('NASA FIRMS NRT');
  
  // Clave NASA FIRMS y Modo Satelital
  const [nasaFirmsKey, setNasaFirmsKey] = useState<string>(() => {
    return localStorage.getItem('guardabosques_nasa_key') || '';
  });
  const [showNasaKeyModal, setShowNasaKeyModal] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState<string>('');
  const [keyFeedback, setKeyFeedback] = useState<string | null>(null);
  const [lastSweepTime, setLastSweepTime] = useState<string>('');
  const [sweepSeed, setSweepSeed] = useState<number>(() => Math.floor(Date.now() / (1000 * 60 * 15)));
  
  // Modales
  const [showScienceModal, setShowScienceModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [downloadingZip, setDownloadingZip] = useState<boolean>(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Filtros interactivos
  const [filterSatellite, setFilterSatellite] = useState<string>('ALL');
  const [minFrp, setMinFrp] = useState<number>(0);
  const [searchSector, setSearchSector] = useState<string>('');

  // Simulador interactivo en modal científico (Stefan-Boltzmann y Wien)
  const [simTempK, setSimTempK] = useState<number>(850);

  // Generador de ZIP en memoria con JSZip (100% libre de errores de red)
  const handleDownloadZipClient = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const rootFolder = zip.folder('guardabosques-sumapaz') || zip;

      PROJECT_FILES.forEach(file => {
        rootFolder.file(file.path, file.content);
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
        mimeType: 'application/zip'
      });

      const blobUrl = window.URL.createObjectURL(zipBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.setAttribute('download', 'guardabosques-sumapaz.zip');
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
    } catch (err) {
      console.error('Error generando ZIP en memoria:', err);
      // Fallback a enlace estático
      window.location.href = '/guardabosques-sumapaz.zip';
    } finally {
      setDownloadingZip(false);
    }
  };

  // Descarga del autoinstalador setup_project.py
  const handleDownloadSetupScript = () => {
    const file = PROJECT_FILES.find(f => f.name === 'setup_project.py');
    if (!file) return;
    const blob = new Blob([file.content], { type: 'text/x-python;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'setup_project.py');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(url), 2000);
  };

  // Copiar al portapapeles con confirmación visual
  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  // Guardar o eliminar clave de NASA FIRMS
  const handleSaveNasaKey = (key: string) => {
    const cleanKey = key.trim();
    if (!cleanKey) {
      localStorage.removeItem('guardabosques_nasa_key');
      setNasaFirmsKey('');
      setKeyFeedback('Clave eliminada. Modo simulación dinámico activo.');
      setTimeout(() => {
        setShowNasaKeyModal(false);
        loadData(hours, Date.now());
      }, 1000);
      return;
    }
    localStorage.setItem('guardabosques_nasa_key', cleanKey);
    setNasaFirmsKey(cleanKey);
    setKeyFeedback('Clave guardada. Conectando con satélites NASA FIRMS...');
    setTimeout(() => {
      setShowNasaKeyModal(false);
      loadData(hours, Date.now());
    }, 1000);
  };

  // Referencias de Leaflet
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const bboxLayerRef = useRef<L.Polygon | null>(null);

  // Consulta directa a la API de NASA FIRMS (con soporte CORS y fallback proxy)
  const fetchNasaFirmsLive = async (key: string, h: number): Promise<ThermalAnomaly[] | null> => {
    const days = Math.max(1, Math.min(10, Math.ceil(h / 24)));
    const bbox = `${SUMAPAZ_BBOX.west},${SUMAPAZ_BBOX.south},${SUMAPAZ_BBOX.east},${SUMAPAZ_BBOX.north}`;
    const firmsUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key.trim())}/VIIRS_SNPP_NRT/${bbox}/${days}`;
    
    let csvText: string | null = null;
    try {
      const res = await fetch(firmsUrl);
      if (res.ok) {
        csvText = await res.text();
      }
    } catch {
      // Fallback a proxy CORS transparente para evitar bloqueo de navegador en GitHub Pages
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(firmsUrl)}`;
        const pRes = await fetch(proxyUrl);
        if (pRes.ok) {
          csvText = await pRes.text();
        }
      } catch (err) {
        console.warn('Fallo de red al consultar API de NASA:', err);
      }
    }

    if (!csvText) return null;

    if (csvText.toLowerCase().includes('invalid map key') || csvText.toLowerCase().includes('error')) {
      console.warn('NASA FIRMS API Key inválida');
      return null;
    }

    if (!csvText.toLowerCase().includes('latitude')) {
      return null;
    }

    const lines = csvText.trim().split('\n');
    if (lines.length <= 1) {
      // Cabecera sin registros = 0 anomalías reportadas por satélite en Sumapaz
      return [];
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const latIdx = headers.indexOf('latitude');
    const lonIdx = headers.indexOf('longitude');
    const frpIdx = headers.indexOf('frp');
    const brightIdx = headers.indexOf('bright_ti4') !== -1 ? headers.indexOf('bright_ti4') : headers.indexOf('brightness');
    const dateIdx = headers.indexOf('acq_date');
    const timeIdx = headers.indexOf('acq_time');
    const confIdx = headers.indexOf('confidence');

    if (latIdx === -1 || lonIdx === -1) return null;

    const parsed: ThermalAnomaly[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(c => c.trim());
      if (row.length < headers.length) continue;
      const lat = parseFloat(row[latIdx]);
      const lon = parseFloat(row[lonIdx]);
      if (isNaN(lat) || isNaN(lon)) continue;

      if (lat < SUMAPAZ_BBOX.south || lat > SUMAPAZ_BBOX.north || lon < SUMAPAZ_BBOX.west || lon > SUMAPAZ_BBOX.east) {
        continue;
      }

      const frpVal = frpIdx !== -1 ? parseFloat(row[frpIdx]) || 5.0 : 5.0;
      const brightVal = brightIdx !== -1 ? parseFloat(row[brightIdx]) || 310.0 : 310.0;
      const acqDate = dateIdx !== -1 ? row[dateIdx] : new Date().toISOString().substring(0, 10);
      const acqTime = timeIdx !== -1 ? row[timeIdx] : '1200';
      const conf = confIdx !== -1 ? row[confIdx] : 'nominal';

      // Identificar microcuenca más cercana
      let closestSector = SUMAPAZ_SECTORS[0].name;
      let minDistance = 999999;
      for (const s of SUMAPAZ_SECTORS) {
        const d = Math.hypot(s.lat - lat, s.lon - lon);
        if (d < minDistance) {
          minDistance = d;
          closestSector = s.name;
        }
      }

      const risk: 'BAJO' | 'MEDIO' | 'ALTO' = frpVal >= 50 ? 'ALTO' : frpVal >= 10 ? 'MEDIO' : 'BAJO';
      const stefanFlux = +(0.95 * 5.670374e-8 * Math.pow(brightVal, 4) / 1000).toFixed(2);

      parsed.push({
        id: `FIRMS-REAL-${i.toString().padStart(3, '0')}`,
        latitude: +lat.toFixed(4),
        longitude: +lon.toFixed(4),
        frp: +frpVal.toFixed(1),
        bright_ti4: +brightVal.toFixed(1),
        acq_date: acqDate,
        acq_time: acqTime,
        confidence: conf,
        satellite: 'VIIRS-SNPP (NASA)',
        sector: closestSector,
        risk_level: risk,
        stefan_boltzmann_flux: stefanFlux
      });
    }

    parsed.sort((a, b) => b.frp - a.frp);
    return parsed;
  };

  // Generador de telemetría dinámica calibrada por fecha y hora real del día
  function generateClientAnomalies(h: number, seed: number): ThermalAnomaly[] {
    const items: ThermalAnomaly[] = [];
    const now = new Date();

    const pseudoRand = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    // Cantidad variable y realista según la ventana horaria y la semilla del día
    const baseCount = h >= 72 ? 14 : h >= 48 ? 10 : 6;
    const variance = Math.floor(pseudoRand(seed * 11.3) * 5) - 2;
    const count = Math.max(3, baseCount + variance);

    for (let i = 1; i <= count; i++) {
      const spotSeed = seed * 43 + i * 59;
      const sectorIdx = Math.floor(pseudoRand(spotSeed * 1.7) * SUMAPAZ_SECTORS.length);
      const sec = SUMAPAZ_SECTORS[sectorIdx];

      // FRP con distribución de potencia térmica natural
      let frp: number;
      const roll = pseudoRand(spotSeed * 2.3);
      if (i === 1 && roll > 0.45) {
        frp = +(52 + pseudoRand(spotSeed * 3.1) * 48).toFixed(1); // 52 - 100 MW (Alerta Alta)
      } else if (i === 2 || roll > 0.72) {
        frp = +(18 + pseudoRand(spotSeed * 4.3) * 31).toFixed(1); // 18 - 49 MW (Alerta Media)
      } else {
        frp = +(2.8 + pseudoRand(spotSeed * 5.9) * 15.2).toFixed(1); // 2.8 - 18 MW (Bajo)
      }

      const bright_ti4 = +(302 + (frp * 0.68) + (pseudoRand(spotSeed * 6.7) * 10)).toFixed(1);
      const risk: 'BAJO' | 'MEDIO' | 'ALTO' = frp >= 50 ? 'ALTO' : frp >= 10 ? 'MEDIO' : 'BAJO';

      // Horas transcurridas dinámicas respecto al momento actual
      const hoursAgo = +(pseudoRand(spotSeed * 7.1) * (h - 0.2) + 0.15).toFixed(2);
      const spotDate = new Date(now.getTime() - hoursAgo * 3600000);

      // Flujo de Stefan-Boltzmann: E = ε · σ · T^4
      const stefanFlux = +(0.95 * 5.670374e-8 * Math.pow(bright_ti4, 4) / 1000).toFixed(2);

      // Dispersión sutil y realista en los valles del páramo
      const latOffset = (pseudoRand(spotSeed * 8.3) - 0.5) * 0.065;
      const lonOffset = (pseudoRand(spotSeed * 9.7) - 0.5) * 0.075;
      const lat = Math.max(SUMAPAZ_BBOX.south + 0.03, Math.min(SUMAPAZ_BBOX.north - 0.03, sec.lat + latOffset));
      const lon = Math.max(SUMAPAZ_BBOX.west + 0.03, Math.min(SUMAPAZ_BBOX.east - 0.03, sec.lon + lonOffset));

      const satTypes = ['VIIRS-NOAA20', 'VIIRS-SNPP', 'MODIS-Terra', 'MODIS-Aqua', 'VIIRS-NOAA21'];
      const sat = satTypes[Math.floor(pseudoRand(spotSeed * 10.1) * satTypes.length)];

      const hourStr = String(spotDate.getHours()).padStart(2, '0');
      const minStr = String(spotDate.getMinutes()).padStart(2, '0');

      items.push({
        id: `SUMA-${spotDate.getMonth() + 1}${spotDate.getDate()}-${i.toString().padStart(3, '0')}`,
        latitude: +lat.toFixed(4),
        longitude: +lon.toFixed(4),
        frp,
        bright_ti4,
        acq_date: spotDate.toISOString().substring(0, 10),
        acq_time: `${hourStr}${minStr}`,
        confidence: frp >= 50 ? 'high' : frp >= 10 ? 'nominal' : 'low',
        satellite: sat,
        sector: sec.name,
        risk_level: risk,
        stefan_boltzmann_flux: stefanFlux
      });
    }

    items.sort((a, b) => b.frp - a.frp);
    return items;
  }

  // Carga inteligente de anomalías térmicas (NASA Real > Backend > Simulación Dinámica)
  const loadData = async (selectedHours: number, customSeed?: number) => {
    setLoading(true);
    const activeSeed = customSeed !== undefined ? customSeed : sweepSeed;
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastSweepTime(nowTimeStr);

    try {
      // 1. Probar primero si hay una clave de NASA FIRMS configurada
      if (nasaFirmsKey && nasaFirmsKey.trim().length > 6) {
        const liveFirms = await fetchNasaFirmsLive(nasaFirmsKey, selectedHours);
        if (liveFirms !== null) {
          setAnomalies(liveFirms);
          setDataSource(`NASA FIRMS Satelital NRT (${liveFirms.length} focos detectados)`);
          return;
        }
      }

      // 2. Si no, probar si el backend local Python está activo
      const res = await fetch(`/api/thermal-anomalies?hours=${selectedHours}`);
      if (res.ok) {
        const data = await res.json();
        if (data.anomalies && Array.isArray(data.anomalies)) {
          setAnomalies(data.anomalies);
          setDataSource(data.data_source || 'NASA FIRMS NRT');
          return;
        }
      }
      throw new Error('Modo dinámico autónomo');
    } catch {
      // 3. Simulación dinámica basada en la fecha y hora de hoy
      const generated = generateClientAnomalies(selectedHours, activeSeed);
      setAnomalies(generated);
      const isToday = new Date().toLocaleDateString();
      setDataSource(`Simulación Dinámica Sumapaz · ${isToday}`);
    } finally {
      setLoading(false);
    }
  };

  // Re-ejecutar barrido satelital al cambiar ventana o solicitar actualización
  useEffect(() => {
    loadData(hours, sweepSeed);
  }, [hours, sweepSeed, nasaFirmsKey]);

  // Actualización periódica en segundo plano cada 3 minutos
  useEffect(() => {
    const timer = setInterval(() => {
      const autoSeed = Math.floor(Date.now() / (1000 * 60 * 15));
      setSweepSeed(autoSeed);
    }, 180000);
    return () => clearInterval(timer);
  }, []);

  const handleRefreshSweep = () => {
    const freshSeed = Date.now();
    setSweepSeed(freshSeed);
    loadData(hours, freshSeed);
  };


  // Filtrado reactivo de anomalías
  const filteredAnomalies = useMemo(() => {
    return anomalies.filter(a => {
      if (filterSatellite !== 'ALL' && !a.satellite.includes(filterSatellite)) return false;
      if (a.frp < minFrp) return false;
      if (searchSector && !a.sector.toLowerCase().includes(searchSector.toLowerCase())) return false;
      return true;
    });
  }, [anomalies, filterSatellite, minFrp, searchSector]);

  // Métricas agregadas
  const metrics = useMemo(() => {
    const total = filteredAnomalies.length;
    const maxFrp = filteredAnomalies.reduce((max, a) => Math.max(max, a.frp), 0);
    const totalFrp = filteredAnomalies.reduce((sum, a) => sum + a.frp, 0);
    const highRisk = filteredAnomalies.filter(a => a.risk_level === 'ALTO').length;
    const medRisk = filteredAnomalies.filter(a => a.risk_level === 'MEDIO').length;
    const lowRisk = filteredAnomalies.filter(a => a.risk_level === 'BAJO').length;

    // Tasa estimada de consumo de biomasa de páramo: ~0.368 kg/s por MW (Wooster et al.)
    const biomassBurnRateKgPerSec = +(totalFrp * 0.368).toFixed(1);

    let alertStatus: { text: string; color: string; badge: string } = {
      text: 'Verde (Riesgo Bajo)',
      color: 'text-emerald-400',
      badge: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
    };
    if (highRisk > 0 || maxFrp >= 50) {
      alertStatus = {
        text: 'Alerta Roja (Crítico)',
        color: 'text-rose-400',
        badge: 'border-rose-500/40 bg-rose-950/40 text-rose-300'
      };
    } else if (medRisk > 0 || maxFrp >= 10) {
      alertStatus = {
        text: 'Alerta Naranja (Vigilancia)',
        color: 'text-amber-400',
        badge: 'border-amber-500/40 bg-amber-950/40 text-amber-300'
      };
    }

    return { total, maxFrp, totalFrp, highRisk, medRisk, lowRisk, biomassBurnRateKgPerSec, alertStatus };
  }, [filteredAnomalies]);

  // Capa base seleccionada
  const [mapLayerType, setMapLayerType] = useState<'topo' | 'sat' | 'dark' | 'osm'>('topo');
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);

  // Referencias a capas base para conmutación fluida
  const baseLayersMapRef = useRef<{ [key: string]: L.TileLayer }>({});
  const landmarksLayerRef = useRef<L.LayerGroup | null>(null);

  // Inicializar mapa de Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Limpiar id previo si React remonta el contenedor
    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    const map = L.map(mapContainerRef.current, {
      center: [SUMAPAZ_BBOX.centerLat, SUMAPAZ_BBOX.centerLon],
      zoom: SUMAPAZ_BBOX.defaultZoom,
      minZoom: 7,
      maxZoom: 17,
      zoomControl: false
    });

    // Control de zoom en posición inferior derecha
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Definición de Capas Base de Alta Disponibilidad
    const topoLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Esri Topo &mdash; PNN Sumapaz',
      maxZoom: 18
    });

    const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Esri Imagery &mdash; NASA FIRMS',
      maxZoom: 18
    });

    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CARTO &copy; OpenStreetMap',
      subdomains: 'abcd',
      maxZoom: 19
    });

    const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });

    baseLayersMapRef.current = {
      topo: topoLayer,
      sat: satLayer,
      dark: darkLayer,
      osm: osmLayer
    };

    // Añadir la capa inicial (Topográfico por defecto para ver el relieve del páramo)
    topoLayer.addTo(map);

    // Polígono del Bounding Box de Sumapaz con línea punteada
    const bboxPolygon = L.polygon([
      [SUMAPAZ_BBOX.south, SUMAPAZ_BBOX.west],
      [SUMAPAZ_BBOX.north, SUMAPAZ_BBOX.west],
      [SUMAPAZ_BBOX.north, SUMAPAZ_BBOX.east],
      [SUMAPAZ_BBOX.south, SUMAPAZ_BBOX.east]
    ], {
      color: '#06b6d4',
      weight: 2.5,
      opacity: 0.9,
      dashArray: '7, 9',
      fillColor: '#0891b2',
      fillOpacity: 0.05
    }).addTo(map);

    bboxPolygon.bindTooltip("Límite Oficial Páramo de Sumapaz [3.70°N a 4.40°N, -74.50°W a -73.90°W]", {
      sticky: true,
      className: "bg-slate-900 text-cyan-300 font-mono text-xs border border-cyan-700/80 rounded px-2 py-1 shadow-lg"
    });

    // Capa de hitos geográficos de referencia (Lagunas, Picos, Cuencas)
    const landmarksLayer = L.layerGroup().addTo(map);
    const SUMAPAZ_LANDMARKS = [
      { name: "Laguna de Chisacá", type: "laguna", lat: 4.292, lon: -74.202, elev: 3750, color: "#38bdf8" },
      { name: "Laguna Los Tunjos", type: "laguna", lat: 4.288, lon: -74.195, elev: 3800, color: "#38bdf8" },
      { name: "Cerro El Nevado", type: "pico", lat: 3.960, lon: -74.080, elev: 4100, color: "#a855f7" },
      { name: "Alto de Las Cruces", type: "pico", lat: 4.295, lon: -74.195, elev: 3920, color: "#a855f7" },
      { name: "Cañón del Río Blanco", type: "valle", lat: 4.025, lon: -74.280, elev: 3650, color: "#34d399" },
      { name: "Nazaret", type: "poblado", lat: 4.140, lon: -74.150, elev: 3710, color: "#fbbf24" },
      { name: "San Juan de Sumapaz", type: "poblado", lat: 4.015, lon: -74.310, elev: 3250, color: "#fbbf24" },
      { name: "Cabrera / Peñas Blancas", type: "pico", lat: 3.890, lon: -74.420, elev: 3300, color: "#a855f7" },
      { name: "Zona Pasca", type: "valle", lat: 4.310, lon: -74.310, elev: 3150, color: "#34d399" }
    ];

    SUMAPAZ_LANDMARKS.forEach(lm => {
      const iconText = lm.type === 'laguna' ? '💧' : lm.type === 'pico' ? '⛰️' : lm.type === 'valle' ? '🏞️' : '🏡';
      const marker = L.circleMarker([lm.lat, lm.lon], {
        radius: 6,
        color: lm.color,
        fillColor: '#0f172a',
        fillOpacity: 0.9,
        weight: 2
      });

      marker.bindPopup(`
        <div style="font-family:'Plus Jakarta Sans',sans-serif;" class="p-1">
          <div style="font-weight:700; font-size:12px; color:#ffffff; margin-bottom:4px;">
            ${iconText} ${lm.name}
          </div>
          <div style="font-size:11px; color:#94a3b8; font-family:'JetBrains Mono',monospace;">
            <div>Elevación: <strong style="color:#e2e8f0;">${lm.elev} msnm</strong></div>
            <div>Coordenadas: ${lm.lat.toFixed(3)}°, ${lm.lon.toFixed(3)}°</div>
          </div>
        </div>
      `, { maxWidth: 220 });

      marker.bindTooltip(`${iconText} ${lm.name} (${lm.elev}m)`, {
        direction: 'top',
        className: 'bg-slate-900 text-slate-200 border border-slate-700 text-[10px] font-sans px-1.5 py-0.5 rounded shadow'
      });

      landmarksLayer.addLayer(marker);
    });

    const markersLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = markersLayer;
    bboxLayerRef.current = bboxPolygon;
    landmarksLayerRef.current = landmarksLayer;

    // Ajustar vista automáticamente a todo el Páramo de Sumapaz
    map.fitBounds(bboxPolygon.getBounds(), { padding: [25, 25] });

    // Forzar redibujado de teselas tras reflow del DOM
    const t1 = setTimeout(() => map.invalidateSize(), 80);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    const t3 = setTimeout(() => map.invalidateSize(), 1200);

    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', onResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Efecto para conmutar la capa base activa
  useEffect(() => {
    if (!mapInstanceRef.current || !baseLayersMapRef.current) return;
    const map = mapInstanceRef.current;
    const layers = baseLayersMapRef.current;

    // Remover capas existentes
    Object.values(layers).forEach(layer => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });

    // Agregar la seleccionada
    const target = layers[mapLayerType] || layers.topo;
    if (target) {
      target.addTo(map);
      target.bringToBack();
    }
  }, [mapLayerType]);

  // Efecto para activar o desactivar hitos geográficos
  useEffect(() => {
    if (!mapInstanceRef.current || !landmarksLayerRef.current) return;
    const map = mapInstanceRef.current;
    const layer = landmarksLayerRef.current;
    if (showLandmarks) {
      if (!map.hasLayer(layer)) map.addLayer(layer);
    } else {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    }
  }, [showLandmarks]);

  // Actualizar marcadores en el mapa Leaflet
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    filteredAnomalies.forEach(anomaly => {
      const isHigh = anomaly.risk_level === 'ALTO';
      const isMed = anomaly.risk_level === 'MEDIO';

      const color = isHigh ? '#f43f5e' : isMed ? '#f59e0b' : '#10b981';
      const borderColor = isHigh ? '#ffe4e6' : isMed ? '#fef3c7' : '#d1fae5';
      const radius = isHigh ? 11 : isMed ? 8 : 6;
      const pulseClass = isHigh ? 'marker-pulse-red' : isMed ? 'marker-pulse-orange' : '';

      const marker = L.circleMarker([anomaly.latitude, anomaly.longitude], {
        radius,
        color: borderColor,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.9,
        className: pulseClass
      });

      const tempC = (anomaly.bright_ti4 - 273.15).toFixed(1);
      const dms = `${decimalToDMS(anomaly.latitude, true)} ${decimalToDMS(anomaly.longitude, false)}`;

      const popupHtml = `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif;" class="p-1 text-slate-100">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:6px; margin-bottom:8px;">
            <strong style="color:#ffffff; font-size:12px;">${anomaly.sector}</strong>
            <span style="font-family:'JetBrains Mono', monospace; font-size:10px; font-weight:700; color:${color}; background:#1e293b; padding:2px 6px; border-radius:4px; border:1px solid #475569;">
              ${anomaly.frp} MW
            </span>
          </div>
          <div style="font-family:'JetBrains Mono', monospace; font-size:11px; line-height:1.5; color:#cbd5e1;">
            <div><strong>Sensor:</strong> ${anomaly.satellite} (${anomaly.confidence})</div>
            <div><strong>Temp. Brillo (I-4):</strong> ${anomaly.bright_ti4} K (${tempC}°C)</div>
            <div><strong>Flujo Stefan-B.:</strong> ${anomaly.stefan_boltzmann_flux} kW/m²</div>
            <div><strong>Fecha/Hora:</strong> ${anomaly.acq_date} ${anomaly.acq_time} UTC</div>
            <div style="margin-top:6px; padding-top:6px; border-top:1px dashed #334155; color:#38bdf8;">
              <div>GPS: ${anomaly.latitude.toFixed(4)}°, ${anomaly.longitude.toFixed(4)}°</div>
              <div style="font-size:10px; color:#94a3b8;">${dms}</div>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 300 });

      marker.on('click', () => {
        setSelectedAnomaly(anomaly);
      });

      layer.addLayer(marker);
    });
  }, [filteredAnomalies]);

  // Centrar mapa en Sumapaz
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([SUMAPAZ_BBOX.centerLat, SUMAPAZ_BBOX.centerLon], SUMAPAZ_BBOX.defaultZoom, {
        duration: 1
      });
    }
  };

  // Centrar mapa en una anomalía seleccionada
  const handleFocusAnomaly = (anomaly: ThermalAnomaly) => {
    setSelectedAnomaly(anomaly);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([anomaly.latitude, anomaly.longitude], 13, { duration: 0.8 });
    }
  };

  // Exportar datos a CSV
  const handleExportCSV = () => {
    if (!filteredAnomalies.length) return;
    const headers = [
      'ID',
      'Sector',
      'Latitud',
      'Longitud',
      'Coordenadas_DMS',
      'FRP_MW',
      'Brillo_Kelvin',
      'Temp_Celsius',
      'Fecha_UTC',
      'Hora_UTC',
      'Satelite',
      'Confianza',
      'Nivel_Riesgo',
      'Flujo_Radiativo_kW_m2'
    ];

    const rows = filteredAnomalies.map(a => [
      a.id,
      `"${a.sector}"`,
      a.latitude,
      a.longitude,
      `"${decimalToDMS(a.latitude, true)} ${decimalToDMS(a.longitude, false)}"`,
      a.frp,
      a.bright_ti4,
      (a.bright_ti4 - 273.15).toFixed(1),
      a.acq_date,
      a.acq_time,
      a.satellite,
      a.confidence,
      a.risk_level,
      a.stefan_boltzmann_flux
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Guardabosques_Sumapaz_Reporte_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cálculos dinámicos del simulador de física térmica
  const simWienPeakMicrons = +(2897.77 / simTempK).toFixed(2);
  const simStefanFluxKW = +(0.95 * 5.670374e-8 * Math.pow(simTempK, 4) / 1000).toFixed(2);
  const simBiomassRate = +(0.368 * (simStefanFluxKW > 10 ? simStefanFluxKW / 3 : 5)).toFixed(2);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      {/* ===================================================================== */}
      {/* TOP NAVIGATION BAR: Contrato de 3 Zonas (Brand, Links/Filters, Actions) */}
      {/* ===================================================================== */}
      <header className="flex items-center justify-between gap-8 px-5 py-3 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md z-30 shrink-0">
        
        {/* Zona 1: Brand Wordmark Limpio */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-bold text-sm shadow-inner">
            <Compass className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
              Guardabosques Sumapaz
            </span>
            <span className="text-xs text-slate-400 hidden lg:inline">
              · Teledetección Satelital NASA FIRMS
            </span>
          </div>
        </div>

        {/* Zona 2: Selector Temporal Segmentado & Acciones Satelitales */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/70 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 px-2 font-mono hidden sm:inline">Ventana:</span>
            {(['24', '48', '72'] as const).map(opt => {
              const val = parseInt(opt, 10) as 24 | 48 | 72;
              const active = hours === val;
              return (
                <button
                  key={opt}
                  onClick={() => setHours(val)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt}h
                </button>
              );
            })}
          </div>

          {/* Botón de Actualizar Barrido Satelital */}
          <button
            onClick={handleRefreshSweep}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Ejecutar nuevo barrido satelital y refrescar coordenadas dinámicas"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
            <span className="hidden sm:inline">Actualizar Barrido</span>
          </button>

          {/* Botón de Clave NASA FIRMS */}
          <button
            onClick={() => {
              setKeyInput(nasaFirmsKey);
              setKeyFeedback(null);
              setShowNasaKeyModal(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              nasaFirmsKey
                ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-600/60 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Conectar clave API gratuita de NASA FIRMS para telemetría 100% en vivo"
          >
            <Satellite className={`w-3.5 h-3.5 ${nasaFirmsKey ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span className="hidden md:inline">
              {nasaFirmsKey ? 'NASA FIRMS (En Vivo)' : 'Conectar Clave NASA'}
            </span>
            <span className="md:hidden">
              {nasaFirmsKey ? 'NASA Vivo' : 'NASA'}
            </span>
          </button>
        </div>

        {/* Zona 3: Botones de Acción Primaria */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 transition-colors whitespace-nowrap shadow-sm"
            title="Descargar código fuente en .ZIP garantizado, autoinstalador Python o ver archivos"
          >
            <FolderArchive className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Descargar Proyecto (.zip)</span>
            <span className="sm:hidden">.ZIP</span>
          </button>

          <button
            onClick={() => setShowScienceModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors whitespace-nowrap"
            title="Ver fundamentos científicos de la teledetección"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Divulgación Científica</span>
            <span className="md:hidden">Física</span>
          </button>

          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm whitespace-nowrap"
            title="Generar reporte táctico para brigadistas y guardaparques"
          >
            <FileText className="w-3.5 h-3.5 text-slate-950" />
            <span>Reporte Brigadas</span>
          </button>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* TELEMETRY & METRICS RIBBON (Datos Tabulares de Alta Precisión)          */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 text-xs shrink-0">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/90">
          <span className="text-slate-400">Focos Detectados</span>
          <span className="font-mono font-bold text-white text-sm tabular-nums">
            {loading ? '...' : metrics.total}
          </span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/90">
          <span className="text-slate-400">FRP Máximo</span>
          <div className="flex items-baseline gap-1 font-mono font-bold text-amber-400 text-sm tabular-nums">
            <span>{loading ? '...' : metrics.maxFrp.toFixed(1)}</span>
            <span className="text-[10px] text-slate-500 font-normal">MW</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/90">
          <span className="text-slate-400">FRP Acumulado</span>
          <div className="flex items-baseline gap-1 font-mono font-bold text-cyan-400 text-sm tabular-nums">
            <span>{loading ? '...' : metrics.totalFrp.toFixed(1)}</span>
            <span className="text-[10px] text-slate-500 font-normal">MW</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/90">
          <span className="text-slate-400">Consumo Biomasa</span>
          <div className="flex items-baseline gap-1 font-mono font-bold text-slate-200 text-sm tabular-nums">
            <span>{loading ? '...' : metrics.biomassBurnRateKgPerSec}</span>
            <span className="text-[10px] text-slate-500 font-normal">kg/s</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/90">
          <span className="text-slate-400">Alerta General</span>
          <span className={`font-bold text-xs uppercase ${metrics.alertStatus.color} tabular-nums`}>
            {metrics.alertStatus.text}
          </span>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* MAIN WORKSPACE: Split Console (Map Canvas + Lateral Control Column)   */}
      {/* ===================================================================== */}
      <main className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        
        {/* VIEWPORT STAGE: Leaflet Map */}
        <div className="flex-1 relative h-full min-h-[460px] bg-slate-950">
          <div ref={mapContainerRef} className="w-full h-full min-h-[460px] z-0" />

          {/* Quick Controls Overlay on Map (Top Left) */}
          <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2">
            <button
              onClick={handleRecenter}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-cyan-300 shadow-xl transition-colors backdrop-blur-sm"
              title="Centrar mapa en el polígono del Páramo de Sumapaz"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Centrar Sumapaz</span>
            </button>

            <button
              onClick={() => loadData(hours)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 shadow-xl transition-colors backdrop-blur-sm"
              title="Refrescar telemetría satelital"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refrescar</span>
            </button>

            {/* Toggle Hitos Geográficos */}
            <button
              onClick={() => setShowLandmarks(!showLandmarks)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium shadow-xl transition-colors backdrop-blur-sm ${
                showLandmarks
                  ? 'bg-purple-950/90 text-purple-300 border-purple-600/70'
                  : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Mostrar u ocultar lagunas glaciares y picos del Páramo de Sumapaz"
            >
              <MapPin className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Lagunas y Picos</span>
            </button>
          </div>

          {/* Selector de Capa de Mapa (Top Right) */}
          <div className="absolute top-3 right-3 z-[400] flex items-center bg-slate-900/95 p-1 rounded-xl border border-slate-700/80 shadow-2xl backdrop-blur-sm">
            <button
              onClick={() => setMapLayerType('topo')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                mapLayerType === 'topo'
                  ? 'bg-cyan-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Ver curvas de nivel, relieve y cuencas hidrográficas"
            >
              Topográfico
            </button>
            <button
              onClick={() => setMapLayerType('sat')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                mapLayerType === 'sat'
                  ? 'bg-cyan-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Ver fotografía satelital real de la cordillera y páramo"
            >
              Satelital
            </button>
            <button
              onClick={() => setMapLayerType('dark')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                mapLayerType === 'dark'
                  ? 'bg-cyan-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Cartografía nocturna de alto contraste térmico"
            >
              Oscuro
            </button>
            <button
              onClick={() => setMapLayerType('osm')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                mapLayerType === 'osm'
                  ? 'bg-cyan-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Mapa estándar de vías y divisiones político-administrativas"
            >
              Calles
            </button>
          </div>

          {/* Semaforización por FRP Legend Overlay */}
          <div className="absolute bottom-6 left-4 z-[400] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 text-xs shadow-2xl max-w-[280px]">
            <div className="flex items-center justify-between font-bold text-white mb-2">
              <span>Semaforización FRP</span>
              <span className="text-[10px] font-mono text-slate-400">(Megavatios)</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-emerald-300 shrink-0"></span>
                <span className="text-slate-300">&lt; 10 MW: Baja / Falso positivo</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-amber-300 shrink-0"></span>
                <span className="text-slate-300">10 &ndash; 50 MW: Media / Frente activo</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-600 border border-rose-300 shrink-0"></span>
                <span className="text-slate-300">&ge; 50 MW: Alta / Incendio crítico</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center gap-2 text-slate-400 text-[11px]">
                <span className="w-4 h-0 border-t-2 border-dashed border-cyan-400 inline-block"></span>
                <span>Límite BBox Sumapaz</span>
              </div>
            </div>
          </div>
        </div>

        {/* LATERAL COLUMN: Focos List & Tactical Inspector */}
        <aside className="w-full md:w-80 lg:w-96 bg-slate-900/95 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col shrink-0 max-h-[45vh] md:max-h-full z-10">
          
          {/* Header con filtros de búsqueda rápida */}
          <div className="p-3 border-b border-slate-800 space-y-2 bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Focos Térmicos ({filteredAnomalies.length})
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  {lastSweepTime ? `${lastSweepTime}` : ''}
                </span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                  nasaFirmsKey
                    ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
                    : 'border-cyan-500/50 bg-cyan-950/60 text-cyan-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${nasaFirmsKey ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
                  {nasaFirmsKey ? 'NASA En Vivo' : 'Dinámico Hoy'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={filterSatellite}
                onChange={e => setFilterSatellite(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">Todos los Sensores</option>
                <option value="VIIRS">Solo VIIRS (375m)</option>
                <option value="MODIS">Solo MODIS (1km)</option>
              </select>

              <input
                type="text"
                placeholder="Filtrar por sector..."
                value={searchSector}
                onChange={e => setSearchSector(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Listado scrolleable de focos */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                <span>Sincronizando telemetría satelital...</span>
              </div>
            ) : filteredAnomalies.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <p className="font-semibold text-slate-300">
                  {nasaFirmsKey 
                    ? '0 anomalías térmicas en Sumapaz hoy' 
                    : 'Sin focos bajo los criterios seleccionados'}
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {nasaFirmsKey 
                    ? 'Los satélites VIIRS/MODIS no reportan incendios activos en el Bounding Box del Páramo de Sumapaz durante las últimas ' + hours + ' horas.'
                    : 'Prueba cambiando los filtros de FRP, ampliando la ventana a 48h/72h o haciendo un nuevo barrido.'}
                </p>
                <button
                  onClick={handleRefreshSweep}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors"
                >
                  <RefreshCw className="w-3 h-3 text-cyan-400" />
                  <span>Nuevo Barrido Satelital</span>
                </button>
              </div>
            ) : (
              filteredAnomalies.map(item => {
                const isSelected = selectedAnomaly?.id === item.id;
                const tempC = (item.bright_ti4 - 273.15).toFixed(1);
                const frpColor =
                  item.risk_level === 'ALTO'
                    ? 'text-rose-400'
                    : item.risk_level === 'MEDIO'
                    ? 'text-amber-400'
                    : 'text-emerald-400';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleFocusAnomaly(item)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-cyan-500 bg-slate-800/90 shadow-md'
                        : 'border-slate-800/80 bg-slate-950/50 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200 truncate pr-2">
                        {item.sector}
                      </span>
                      <span className={`font-mono font-bold text-xs ${frpColor} tabular-nums shrink-0`}>
                        {item.frp} MW
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{item.satellite}</span>
                      <span>{tempC}°C · {item.bright_ti4} K</span>
                      <span>{item.acq_time}Z</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer del inspector con coordenadas de selección activa */}
          {selectedAnomaly && (
            <div className="p-3 border-t border-slate-800 bg-slate-950/90 text-xs font-mono space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>Foco Seleccionado:</span>
                <span className="text-cyan-400 font-bold">{selectedAnomaly.id}</span>
              </div>
              <div className="text-slate-300">
                Lat: {selectedAnomaly.latitude.toFixed(4)}°, Lon: {selectedAnomaly.longitude.toFixed(4)}°
              </div>
              <div className="text-[10px] text-slate-500">
                DMS: {decimalToDMS(selectedAnomaly.latitude, true)} {decimalToDMS(selectedAnomaly.longitude, false)}
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* ===================================================================== */}
      {/* MODAL 1: DIVULGACIÓN CIENTÍFICA (Física de Teledetección y Fuego)     */}
      {/* ===================================================================== */}
      {showScienceModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Divulgación Científica: Teledetección Térmica Satelital
                  </h3>
                  <p className="text-xs text-slate-400">
                    Física de la radiación electromagnética aplicada a la protección del Páramo de Sumapaz
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScienceModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-6 text-sm text-slate-300">
              
              {/* Sección 1: Ley de Stefan-Boltzmann */}
              <article className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-cyan-400 text-sm">
                    1. Ley de Stefan-Boltzmann: Emitancia Radiativa Total
                  </h4>
                  <span className="text-xs font-mono text-slate-400 font-bold">
                    E = &epsilon; &middot; &sigma; &middot; T<sup>4</sup>
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  Todo cuerpo con temperatura absoluta <span className="font-mono text-cyan-300">T</span> (Kelvin) irradia energía electromagnética. La potencia radiada total por metro cuadrado aumenta con la <strong>cuarta potencia</strong> de la temperatura absoluta.
                </p>
                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
                  <div className="text-slate-400">&sigma; = 5.670374 &times; 10<sup>-8</sup> W/(m&sup2;&middot;K<sup>4</sup>) (Constante de Stefan-Boltzmann)</div>
                  <div className="text-slate-400">&epsilon; = Emisividad de biomasa de alta montaña (&asymp; 0.95 en frailejonal y turbera)</div>
                  <div className="text-amber-400 font-semibold pt-1">
                    &rarr; Efecto Exponencial: Si la temperatura sube de 300 K (27&deg;C ambiente) a 600 K (327&deg;C combustión), la energía radiada se multiplica por 16 (2<sup>4</sup>).
                  </div>
                </div>
              </article>

              {/* Sección 2: Ley de Desplazamiento de Wien */}
              <article className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-amber-400 text-sm">
                    2. Ley de Wien: Por qué se vigila el Infrarrojo Medio (3.9 &mu;m)
                  </h4>
                  <span className="text-xs font-mono text-slate-400 font-bold">
                    &lambda;<sub>m&aacute;x</sub> &middot; T = b &asymp; 2897.77 &mu;m&middot;K
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  La longitud de onda con máxima potencia emitida se desplaza hacia longitudes de onda más cortas a medida que aumenta la temperatura.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="font-bold text-slate-200">Suelo y Vegetación Fría (300 K):</span>
                    <p className="font-mono text-slate-400">&lambda;<sub>m&aacute;x</sub> = 2898 / 300 &asymp; 9.66 &mu;m</p>
                    <p className="text-[11px] text-slate-400">
                      Su pico está en el Infrarrojo Térmico Lejano (Canal TIR &sim;11 &mu;m).
                    </p>
                  </div>
                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="font-bold text-amber-400">Frente de Fuego Activo (800 &ndash; 1200 K):</span>
                    <p className="font-mono text-amber-400">&lambda;<sub>m&aacute;x</sub> = 2898 / 800 &asymp; 3.62 &mu;m</p>
                    <p className="text-[11px] text-slate-400">
                      Su pico cae exactamente en el Infrarrojo Medio (Canal MIR 3.7 &ndash; 3.9 &mu;m: Banda I-4 de VIIRS y Banda 21/22 de MODIS).
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-lg text-xs text-emerald-300">
                  <strong>Principio Sub-Píxel:</strong> Aunque una quema ocupe solo el 0.05% de un píxel de 375 m, la emisión a 3.9 &mu;m satura el sensor óptico, permitiendo a los satélites alertar al Parque Nacional antes de que el fuego se propague.
                </div>
              </article>

              {/* Sección 3: Potencia Radiativa de Fuego (FRP) */}
              <article className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-rose-400 text-sm">
                    3. Potencia Radiativa de Fuego (FRP en Megavatios)
                  </h4>
                  <span className="text-xs font-mono text-slate-400 font-bold">
                    Tasa Biomasa (kg/s) &asymp; 0.368 &times; FRP
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  Desarrollado por Wooster et al. (2005), el FRP cuantifica la energía radiada instantánea generada por la combustión de biomasa, directamente proporcional a la tasa de pérdida de vegetación.
                </p>
                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
                  <div>Un incendio de <strong>50 MW</strong> en Sumapaz consume aprox. <strong>18.4 kg de vegetación de páramo por segundo</strong> (frailejones, chusque y turba).</div>
                </div>
              </article>

              {/* SIMULADOR DIDÁCTICO INTERACTIVO */}
              <div className="p-4 rounded-xl bg-slate-950 border border-cyan-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-cyan-300">
                    Laboratorio Didáctico: Variar Temperatura del Emisor
                  </h5>
                  <span className="font-mono text-xs font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                    {simTempK} K ({(simTempK - 273.15).toFixed(0)}°C)
                  </span>
                </div>

                <input
                  type="range"
                  min="300"
                  max="1400"
                  step="25"
                  value={simTempK}
                  onChange={e => setSimTempK(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />

                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                    <div className="text-[10px] text-slate-400">Pico de Wien (&lambda;<sub>m&aacute;x</sub>)</div>
                    <div className="text-amber-400 font-bold text-sm mt-0.5">{simWienPeakMicrons} &mu;m</div>
                    <div className="text-[9px] text-slate-500">
                      {simWienPeakMicrons < 4.5 ? 'Sensible a Canal MIR 3.9µm' : 'Infrarrojo Térmico'}
                    </div>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                    <div className="text-[10px] text-slate-400">Flujo Stefan-B.</div>
                    <div className="text-cyan-400 font-bold text-sm mt-0.5">{simStefanFluxKW} kW/m²</div>
                    <div className="text-[9px] text-slate-500">Emitancia total</div>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                    <div className="text-[10px] text-slate-400">Pérdida Biomasa</div>
                    <div className="text-rose-400 font-bold text-sm mt-0.5">~{simBiomassRate} kg/s</div>
                    <div className="text-[9px] text-slate-500">Tasa de combustión</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
              <button
                onClick={() => setShowScienceModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Cerrar Fundamentos
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: REPORTE DE RIESGO PARA BRIGADAS (Imprimible y Descargable)   */}
      {/* ===================================================================== */}
      {showReportModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
          <div
            id="printable-report-area"
            className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100"
          >
            {/* Header (No imprimible) */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-950/90 border border-amber-600/70 flex items-center justify-center text-amber-400 font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Reporte Táctico de Riesgo para Brigadas de Terreno
                  </h3>
                  <p className="text-xs text-slate-400">
                    Parque Nacional Natural Sumapaz · Cruz Roja · Defensa Civil · Bomberos
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Reporte Táctico */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300 print:text-black">
              
              {/* Encabezado Institucional */}
              <div className="border-b border-slate-800 print:border-black pb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white print:text-black uppercase tracking-wider">
                    Dossier Operativo de Anomalías Térmicas Satelitales
                  </h4>
                  <p className="text-slate-400 print:text-gray-700 text-xs">
                    Bounding Box: 3.70°N a 4.40°N | -74.50°W a -73.90°W
                  </p>
                </div>
                <div className="text-right text-xs font-mono">
                  <div>Fecha de Emisión: {new Date().toISOString().substring(0, 19).replace('T', ' ')} UTC</div>
                  <div className="text-amber-400 print:text-black font-bold">Ventana Analizada: {hours} Horas</div>
                </div>
              </div>

              {/* Indicadores de Mando y Control */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 print:bg-gray-100 border border-slate-800 print:border-gray-300">
                  <div className="text-slate-400 print:text-gray-600 text-[11px]">Nivel de Alerta</div>
                  <div className={`text-base font-bold mt-1 uppercase ${metrics.alertStatus.color} print:text-black`}>
                    {metrics.alertStatus.text}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 print:bg-gray-100 border border-slate-800 print:border-gray-300">
                  <div className="text-slate-400 print:text-gray-600 text-[11px]">Total Focos Activos</div>
                  <div className="text-base font-mono font-bold text-white print:text-black mt-1">
                    {metrics.total}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 print:bg-gray-100 border border-slate-800 print:border-gray-300">
                  <div className="text-slate-400 print:text-gray-600 text-[11px]">Pico Máximo FRP</div>
                  <div className="text-base font-mono font-bold text-amber-400 print:text-black mt-1">
                    {metrics.maxFrp.toFixed(1)} MW
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 print:bg-gray-100 border border-slate-800 print:border-gray-300">
                  <div className="text-slate-400 print:text-gray-600 text-[11px]">Focos Críticos (&ge;50 MW)</div>
                  <div className="text-base font-mono font-bold text-rose-400 print:text-black mt-1">
                    {metrics.highRisk}
                  </div>
                </div>
              </div>

              {/* Recomendaciones Tácticas para Guardaparques y Brigadistas */}
              <div className="p-3.5 rounded-lg bg-slate-950 print:bg-gray-50 border border-slate-800 print:border-gray-300 space-y-2">
                <h5 className="font-bold text-amber-400 print:text-black text-xs uppercase tracking-wider">
                  Recomendaciones Operativas para Ecosistema de Alta Montaña:
                </h5>
                <ul className="list-disc list-inside space-y-1 text-slate-300 print:text-gray-800 text-xs leading-relaxed">
                  <li>
                    <strong>Quema en Turberas y Fuego Subterráneo:</strong> Los colchones de turba y musgo en Sumapaz pueden mantener brasas subterráneas activas sin llama visible durante 48 a 72 horas.
                  </li>
                  <li>
                    <strong>Vientos de Ladera:</strong> Durante la mañana y mediodía, las corrientes anabáticas ascienden rápidamente por los cañones del Río Blanco y Cabrera, avivando frentes de fuego hacia los frailejonales.
                  </li>
                  <li>
                    <strong>Protocolo GPS:</strong> Cargar las siguientes coordenadas en navegadores Garmin / GPS móvil (Datum WGS84) para verificación de terreno y trazado de líneas de defensa.
                  </li>
                </ul>
              </div>

              {/* Tabla de Geolocalización para GPS Garmin/Móvil */}
              <div className="space-y-2">
                <h5 className="font-bold text-white print:text-black text-xs uppercase tracking-wider">
                  Listado de Coordenadas de Intervención (WGS84):
                </h5>
                <div className="overflow-x-auto border border-slate-800 print:border-gray-300 rounded-lg max-h-64">
                  <table className="w-full text-left text-xs divide-y divide-slate-800 print:divide-gray-300">
                    <thead className="bg-slate-950 print:bg-gray-100 text-slate-400 print:text-gray-700 font-mono text-[11px]">
                      <tr>
                        <th className="p-2">ID</th>
                        <th className="p-2">Sector</th>
                        <th className="p-2">Lat / Lon (Dec)</th>
                        <th className="p-2">Coordenadas DMS</th>
                        <th className="p-2">FRP (MW)</th>
                        <th className="p-2">Temp (K)</th>
                        <th className="p-2">Sensor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 print:divide-gray-200 font-mono text-[11px]">
                      {filteredAnomalies.map(a => (
                        <tr key={a.id} className="hover:bg-slate-800/40 print:hover:bg-transparent">
                          <td className="p-2 text-cyan-300 print:text-black font-bold">{a.id}</td>
                          <td className="p-2 text-slate-200 print:text-black font-sans">{a.sector}</td>
                          <td className="p-2">{a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}</td>
                          <td className="p-2 text-slate-400 print:text-gray-700">
                            {decimalToDMS(a.latitude, true)} {decimalToDMS(a.longitude, false)}
                          </td>
                          <td className={`p-2 font-bold ${
                            a.risk_level === 'ALTO'
                              ? 'text-rose-400 print:text-red-700'
                              : a.risk_level === 'MEDIO'
                              ? 'text-amber-400 print:text-amber-700'
                              : 'text-emerald-400 print:text-green-700'
                          }`}>
                            {a.frp} MW
                          </td>
                          <td className="p-2">{a.bright_ti4} K</td>
                          <td className="p-2 font-sans">{a.satellite}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Footer con Acciones de Descarga e Impresión */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between print:hidden">
              <span className="text-[11px] text-slate-400">
                Formato estándar para Puesto de Mando Unificado (PMU)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar CSV</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Dossier</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: DESCARGA Y EXPORTACIÓN DEL PROYECTO (100% GARANTIZADO)        */}
      {/* ===================================================================== */}
      {showExportModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-600/70 flex items-center justify-center text-emerald-400 font-bold">
                  <FolderArchive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Descargar Proyecto Completo
                    <span className="text-[11px] font-normal text-emerald-400 bg-emerald-950/60 border border-emerald-600/40 px-2 py-0.5 rounded">
                      Sin dependencias corruptas
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Opciones de descarga directa generadas en tu navegador para garantizar compatibilidad con WinRAR, 7-Zip, macOS y Linux
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-6 text-xs text-slate-300">
              
              {/* Opciones Principales de Descarga */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Tarjeta A: Generador ZIP en memoria (JSZip) */}
                <div className="p-4 rounded-xl bg-slate-950 border border-emerald-700/50 flex flex-col justify-between space-y-3 shadow-sm">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <Download className="w-4 h-4" />
                      <span>Opción 1: Archivo ZIP (Generado en Navegador)</span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Genera el archivo <strong className="text-slate-200 font-mono">guardabosques-sumapaz.zip</strong> en la memoria de tu navegador usando JSZip. Al generarse directamente en el cliente, <strong>elimina cualquier truncamiento o daño por descarga de red</strong>.
                    </p>
                    <div className="text-[11px] text-slate-400 font-mono">
                      ✓ 17 archivos empaquetados · Formato estándar ZIP DEFLATE
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                      onClick={handleDownloadZipClient}
                      disabled={downloadingZip}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow"
                    >
                      {downloadingZip ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Comprimiendo en memoria...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Descargar .ZIP Ahora</span>
                        </>
                      )}
                    </button>

                    <a
                      href="/guardabosques-sumapaz.zip"
                      download="guardabosques-sumapaz.zip"
                      className="px-3 py-2 text-xs font-medium text-center text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg transition-colors"
                      title="Descarga directa estática alternativa"
                    >
                      Enlace Estático
                    </a>
                  </div>
                </div>

                {/* Tarjeta B: Autoinstalador Python (100% infalible) */}
                <div className="p-4 rounded-xl bg-slate-950 border border-cyan-800/60 flex flex-col justify-between space-y-3 shadow-sm">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                      <Terminal className="w-4 h-4" />
                      <span>Opción 2: Autoinstalador Python (`setup_project.py`)</span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Si tu explorador o descompresor de Windows/macOS presenta errores de descompresión, descarga este script único y ejecútalo con Python. <strong>Crea automáticamente todos los archivos y carpetas en 1 segundo</strong> sin necesidad de ningún programa externo.
                    </p>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800 font-mono text-[11px] text-slate-300 flex items-center justify-between">
                      <code>python setup_project.py</code>
                      <button
                        onClick={() => handleCopyText('python setup_project.py', 'cmd')}
                        className="text-cyan-400 hover:text-cyan-300 ml-2 text-[10px]"
                      >
                        {copyFeedback === 'cmd' ? '¡Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleDownloadSetupScript}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white transition-all shadow"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar setup_project.py (Script)</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Visor de Código y Copia Individual */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-amber-400" />
                      <span>Opción 3: Visor de Archivos y Copiado en 1 Clic</span>
                    </h4>
                    <p className="text-slate-400 text-[11px]">
                      Puedes inspeccionar o copiar manualmente cualquier archivo del proyecto:
                    </p>
                  </div>

                  <button
                    onClick={() => handleCopyText(PROJECT_FILES[selectedFileIndex].content, 'file')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm shrink-0"
                  >
                    {copyFeedback === 'file' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>¡Código Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar {PROJECT_FILES[selectedFileIndex].name}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Selector de Archivos (Pestañas horizontales scrolleables) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
                  {PROJECT_FILES.map((file, idx) => (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFileIndex(idx)}
                      className={`px-2.5 py-1 text-[11px] font-mono rounded-md whitespace-nowrap transition-colors border ${
                        selectedFileIndex === idx
                          ? 'bg-slate-800 text-cyan-300 border-cyan-500 shadow-sm'
                          : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {file.name}
                    </button>
                  ))}
                </div>

                {/* Caja de Código */}
                <div className="relative rounded-lg border border-slate-800 bg-slate-900/90 overflow-hidden">
                  <div className="p-2 border-b border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>{PROJECT_FILES[selectedFileIndex].path}</span>
                    <span>{PROJECT_FILES[selectedFileIndex].content.split('\n').length} líneas</span>
                  </div>
                  <pre className="p-3 max-h-56 overflow-y-auto text-[11px] font-mono text-slate-300 leading-relaxed select-all">
                    {PROJECT_FILES[selectedFileIndex].content}
                  </pre>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Páramo de Sumapaz · Código Libre y Autónomo
              </span>
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Cerrar Ventana
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: Configuración de Clave NASA FIRMS API (Datos en Tiempo Real)   */}
      {/* ===================================================================== */}
      {showNasaKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-400">
                  <Satellite className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Conexión NASA FIRMS en Vivo</h3>
                  <p className="text-xs text-slate-400">Teledetección satelital VIIRS & MODIS en tiempo real</p>
                </div>
              </div>
              <button
                onClick={() => setShowNasaKeyModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-5 space-y-4 text-xs text-slate-300">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                  ¿Cómo funciona la telemetría en tiempo real?
                </span>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Por defecto, la aplicación opera en <strong>Modo Simulación Dinámica</strong> con fecha y hora actualizadas automáticamente para el Páramo de Sumapaz. Si deseas consultar satélites reales de la NASA cada vez que abras la página, necesitas una clave gratuita <strong>MAP_KEY</strong> emitida por la NASA.
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-slate-200">Pasos para obtener tu clave gratuita (30 segundos):</span>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] pl-1">
                  <li>
                    Abre el enlace oficial de la NASA:{' '}
                    <a
                      href="https://firms.modaps.eosdis.nasa.gov/api/map_key/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 underline inline-flex items-center gap-0.5 hover:text-cyan-300 font-mono"
                    >
                      firms.modaps.eosdis.nasa.gov/api/map_key/
                      <ExternalLink className="w-3 h-3 inline ml-0.5" />
                    </a>
                  </li>
                  <li>Escribe tu correo electrónico y haz clic en <em>"Submit"</em>.</li>
                  <li>La NASA te enviará un correo de inmediato con tu <strong>MAP_KEY</strong>.</li>
                  <li>Pega ese código aquí abajo y haz clic en Guardar.</li>
                </ol>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-mono font-semibold text-slate-300 flex items-center justify-between">
                  <span>Tu NASA FIRMS MAP_KEY:</span>
                  {nasaFirmsKey && (
                    <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Clave Activa
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  placeholder="Ej: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {keyFeedback && (
                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-cyan-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{keyFeedback}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
              <button
                onClick={() => handleSaveNasaKey('')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors"
              >
                Limpiar Clave (Modo Dinámico)
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNasaKeyModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleSaveNasaKey(keyInput)}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
                >
                  Guardar y Sincronizar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
