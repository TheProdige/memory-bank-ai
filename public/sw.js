/**
 * Service Worker for Advanced Caching and Offline Support
 * PWA-grade service worker with intelligent caching strategies
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// Precache and route all static assets
precacheAndRoute(self.__WB_MANIFEST);

// Clean up outdated caches
cleanupOutdatedCaches();

// Cache API responses with network-first strategy
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') || url.hostname.includes('supabase'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      {
        cacheKeyWillBeUsed: async ({ request }) => {
          // Create cache key that excludes auth headers for better cache hits
          const url = new URL(request.url);
          return url.toString();
        },
        cacheWillUpdate: async ({ response }) => {
          // Only cache successful responses
          return response.status === 200 ? response : null;
        },
      },
    ],
  })
);

// Cache images with cache-first strategy
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      {
        cacheKeyWillBeUsed: async ({ request }) => request.url,
      },
    ],
  })
);

// Cache audio files with stale-while-revalidate
registerRoute(
  ({ request }) => request.destination === 'audio' || request.url.includes('audio'),
  new StaleWhileRevalidate({
    cacheName: 'audio-files',
  })
);

// Cache static assets (JS, CSS, fonts)
registerRoute(
  ({ request }) => 
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
  })
);

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'memory-upload') {
    event.waitUntil(retryFailedUploads());
  }
});

async function retryFailedUploads() {
  // Get failed uploads from IndexedDB and retry them
  const pendingUploads = await getPendingUploads();
  
  for (const upload of pendingUploads) {
    try {
      await fetch(upload.url, upload.options);
      await removePendingUpload(upload.id);
    } catch (error) {
      console.error('Failed to retry upload:', error);
    }
  }
}

// Notification handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const action = event.action;
  const notification = event.notification;
  
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      const client = clients.find((c) => c.visibilityState === 'visible');
      
      if (client) {
        client.focus();
        client.postMessage({
          type: 'NOTIFICATION_CLICKED',
          action,
          data: notification.data,
        });
      } else {
        self.clients.openWindow('/dashboard');
      }
    })
  );
});

// Push notification handling
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'Nouvelle notification EchoVault',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'explore',
        title: 'Ouvrir l\'application',
        icon: '/favicon.ico',
      },
      {
        action: 'close',
        title: 'Fermer',
        icon: '/favicon.ico',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification('EchoVault', options)
  );
});

// Utility functions for IndexedDB operations
async function getPendingUploads(): Promise<any[]> {
  return new Promise((resolve) => {
    const request = indexedDB.open('EchoVaultDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingUploads'], 'readonly');
      const store = transaction.objectStore('pendingUploads');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result);
      };
    };
    
    request.onerror = () => resolve([]);
  });
}

async function removePendingUpload(id: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.open('EchoVaultDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingUploads'], 'readwrite');
      const store = transaction.objectStore('pendingUploads');
      
      store.delete(id);
      transaction.oncomplete = () => resolve();
    };
    
    request.onerror = () => resolve();
  });
}