/**
 * PWA Service Worker Registration
 * Handles service worker registration with update notifications
 */

import { config } from '@/core/config/env';
import { Logger } from '@/core/logging/Logger';
import { useAppStore } from '@/core/state/AppStore';

class ServiceWorkerManager {
  private static instance: ServiceWorkerManager;
  private registration: ServiceWorkerRegistration | null = null;

  private constructor() {}

  public static getInstance(): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager();
    }
    return ServiceWorkerManager.instance;
  }

  public async register(): Promise<void> {
    if (!config.features.enableServiceWorker || !('serviceWorker' in navigator)) {
      Logger.info('Service Worker not supported or disabled');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      Logger.info('Service Worker registered successfully', {
        scope: this.registration.scope,
      });

      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        this.handleUpdateFound();
      });

      // Check for updates periodically
      setInterval(() => {
        this.checkForUpdates();
      }, 60000); // Check every minute

      // Handle controller changes (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        Logger.info('New Service Worker activated');
        this.showUpdateNotification();
      });

    } catch (error) {
      Logger.error('Service Worker registration failed', { error });
    }
  }

  private handleUpdateFound(): void {
    if (!this.registration) return;

    const newWorker = this.registration.installing;
    if (!newWorker) return;

    Logger.info('New Service Worker found, installing...');

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New content is available
        this.showUpdateAvailableNotification();
      }
    });
  }

  private async checkForUpdates(): Promise<void> {
    if (!this.registration) return;

    try {
      await this.registration.update();
    } catch (error) {
      Logger.warn('Failed to check for Service Worker updates', { error });
    }
  }

  private showUpdateAvailableNotification(): void {
    const { addNotification } = useAppStore.getState();
    
    addNotification({
      type: 'info',
      title: 'Mise à jour disponible',
      message: 'Une nouvelle version de l\'application est disponible. Rechargez la page pour l\'installer.',
    });

    // Show browser notification if permission granted
    if (Notification.permission === 'granted') {
      new Notification('EchoVault - Mise à jour disponible', {
        body: 'Une nouvelle version est prête à être installée.',
        icon: '/favicon.ico',
        tag: 'update-available',
      });
    }
  }

  private showUpdateNotification(): void {
    const { addNotification } = useAppStore.getState();
    
    addNotification({
      type: 'success',
      title: 'Application mise à jour',
      message: 'L\'application a été mise à jour avec succès.',
    });
  }

  public async skipWaiting(): Promise<void> {
    if (!this.registration?.waiting) return;

    // Tell the waiting SW to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  // Push notification subscription
  public async subscribeToNotifications(): Promise<PushSubscription | null> {
    if (!this.registration) {
      Logger.warn('No service worker registration for push notifications');
      return null;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        Logger.warn('Notification permission denied');
        return null;
      }

      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          // Replace with your VAPID public key
          'your-vapid-public-key'
        ),
      });

      Logger.info('Push notification subscription created', { subscription });
      return subscription;

    } catch (error) {
      Logger.error('Failed to subscribe to push notifications', { error });
      return null;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Background sync for offline actions
  public async scheduleBackgroundSync(tag: string): Promise<void> {
    if (!this.registration) return;

    try {
      // Check if sync is supported
      if ('sync' in this.registration) {
        await (this.registration as any).sync.register(tag);
        Logger.info('Background sync scheduled', { tag });
      } else {
        Logger.warn('Background sync not supported');
      }
    } catch (error) {
      Logger.error('Failed to schedule background sync', { error, tag });
    }
  }
}

export const ServiceWorker = ServiceWorkerManager.getInstance();

// Auto-register service worker
if (config.features.enableServiceWorker) {
  ServiceWorker.register();
}