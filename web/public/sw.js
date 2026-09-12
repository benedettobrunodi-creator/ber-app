/* Service worker BER App — deliberadamente CONSERVADOR (11/09/26):
 * - cacheia SÓ estáticos imutáveis (/_next/static, ícones, fontes)
 * - navegações e API (/v1) vão SEMPRE à rede (ponto/dados nunca vêm de cache)
 * - push handlers prontos pros alertas (backend liga em seguida) */
const CACHE = 'ber-static-v1';

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const ehEstatico = url.origin === location.origin &&
    (url.pathname.startsWith('/_next/static/') || /\.(png|svg|ico|woff2?)$/.test(url.pathname));
  if (e.request.method !== 'GET' || !ehEstatico) return; // rede pura pro resto
  e.respondWith(
    caches.match(e.request).then((hit) => hit ?? fetch(e.request).then((resp) => {
      if (resp.ok) {
        const clone = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
      }
      return resp;
    }))
  );
});

self.addEventListener('push', (e) => {
  let dados = { title: 'BER App', body: 'Novo alerta', url: '/' };
  try { dados = { ...dados, ...e.data.json() }; } catch { /* payload texto */ }
  e.waitUntil(self.registration.showNotification(dados.title, {
    body: dados.body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: { url: dados.url },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const alvo = e.notification.data?.url || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
    for (const c of lista) { if ('focus' in c) { c.navigate(alvo); return c.focus(); } }
    return clients.openWindow(alvo);
  }));
});
