// Guardabosques Sumapaz - Service Worker Seguro para PWA en Android e iOS
const CACHE_NAME = 'sumapaz-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpiar cachés anteriores para evitar cualquier bloqueo en GitHub Pages
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Pass-through nativo seguro: nunca retorna null ni bloquea la carga de la página
self.addEventListener('fetch', () => {
  // Dejar que el navegador resuelva las peticiones de red directamente
});
