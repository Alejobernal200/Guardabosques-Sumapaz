import {createRoot} from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import App from './App.tsx';
import './index.css';

// Registrar Service Worker para soporte PWA en Android e iOS
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.info('Service worker registration:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
