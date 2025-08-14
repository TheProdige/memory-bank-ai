/**
 * PWA Manifest and Installation Manager
 * Handles PWA installation prompts and app-like experience
 */

interface PWAManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  background_color: string;
  theme_color: string;
  orientation: 'portrait' | 'landscape' | 'any';
  icons: {
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }[];
  screenshots?: {
    src: string;
    sizes: string;
    type: string;
    form_factor?: 'narrow' | 'wide';
    label?: string;
  }[];
}

export const pwaManifest: PWAManifest = {
  name: 'EchoVault - AI Memory Bank',
  short_name: 'EchoVault',
  description: 'Intelligent voice memory bank with AI-powered transcription and organization',
  start_url: '/',
  display: 'standalone',
  background_color: '#1a1a2e',
  theme_color: '#ffd700',
  orientation: 'portrait',
  icons: [
    {
      src: '/icons/icon-72x72.png',
      sizes: '72x72',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/icons/icon-96x96.png',
      sizes: '96x96',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/icons/icon-128x128.png',
      sizes: '128x128',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/icons/icon-144x144.png',
      sizes: '144x144',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/icons/icon-152x152.png',
      sizes: '152x152',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/icons/icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/icons/icon-384x384.png',
      sizes: '384x384',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/icons/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable'
    }
  ],
  screenshots: [
    {
      src: '/screenshots/desktop-1.png',
      sizes: '1280x720',
      type: 'image/png',
      form_factor: 'wide',
      label: 'EchoVault Dashboard'
    },
    {
      src: '/screenshots/mobile-1.png',
      sizes: '390x844',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'EchoVault Mobile Interface'
    }
  ]
};

import { Logger } from '@/core/logging/Logger';
import { useAppStore } from '@/core/state/AppStore';

class PWAManager {
  private static instance: PWAManager;
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private isInstalled = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): PWAManager {
    if (!PWAManager.instance) {
      PWAManager.instance = new PWAManager();
    }
    return PWAManager.instance;
  }

  private initialize(): void {
    // Check if already installed
    this.checkInstallStatus();
    
    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e as BeforeInstallPromptEvent;
      this.showInstallBanner();
      Logger.info('PWA install prompt captured');
    });

    // Listen for app installation
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.hideInstallBanner();
      this.showInstalledNotification();
      Logger.info('PWA installed successfully');
    });

    // Handle iOS installation
    this.handleIOSInstallation();
  }

  private checkInstallStatus(): void {
    // Check if running as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = (window.navigator as any).standalone;

    this.isInstalled = isStandalone || (isIOS && isInStandaloneMode);

    if (this.isInstalled) {
      Logger.info('PWA is already installed');
    }
  }

  private showInstallBanner(): void {
    if (this.isInstalled) return;

    const { addNotification } = useAppStore.getState();
    
    addNotification({
      type: 'info',
      title: 'Installer EchoVault',
      message: 'Installez l\'application pour une expérience optimale',
      actions: [
        {
          label: 'Installer',
          action: () => this.promptInstall(),
          variant: 'default'
        },
        {
          label: 'Plus tard',
          action: () => {},
          variant: 'outline'
        }
      ]
    });
  }

  private hideInstallBanner(): void {
    // The notification will auto-dismiss or be manually dismissed
  }

  private showInstalledNotification(): void {
    const { addNotification } = useAppStore.getState();
    
    addNotification({
      type: 'success',
      title: 'Application installée !',
      message: 'EchoVault est maintenant installé sur votre appareil',
    });
  }

  private handleIOSInstallation(): void {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = (window.navigator as any).standalone;

    if (isIOS && !isInStandaloneMode && !this.isInstalled) {
      // Show iOS-specific installation instructions
      setTimeout(() => {
        const { addNotification } = useAppStore.getState();
        
        addNotification({
          type: 'info',
          title: 'Installer sur iOS',
          message: 'Appuyez sur l\'icône de partage et sélectionnez "Ajouter à l\'écran d\'accueil"',
          persistent: true,
        });
      }, 5000); // Show after 5 seconds
    }
  }

  public async promptInstall(): Promise<boolean> {
    if (!this.installPrompt) {
      Logger.warn('No install prompt available');
      return false;
    }

    try {
      const result = await this.installPrompt.prompt();
      const outcome = result.outcome;
      
      Logger.info('Install prompt result', { outcome });
      
      if (outcome === 'accepted') {
        this.installPrompt = null;
        return true;
      }
      
      return false;
    } catch (error) {
      Logger.error('Install prompt failed', { error });
      return false;
    }
  }

  public isInstallable(): boolean {
    return this.installPrompt !== null && !this.isInstalled;
  }

  public isAppInstalled(): boolean {
    return this.isInstalled;
  }

  // Handle app updates
  public checkForUpdates(): void {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CHECK_FOR_UPDATES'
      });
    }
  }

  // Share API integration
  public async shareContent(data: {
    title: string;
    text: string;
    url?: string;
  }): Promise<boolean> {
    if (navigator.share) {
      try {
        await navigator.share(data);
        Logger.logUserAction('native_share', data);
        return true;
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          Logger.error('Native share failed', { error });
        }
        return false;
      }
    }
    
    // Fallback to clipboard
    try {
      const textToShare = `${data.title}\n${data.text}${data.url ? `\n${data.url}` : ''}`;
      await navigator.clipboard.writeText(textToShare);
      
      const { addNotification } = useAppStore.getState();
      addNotification({
        type: 'success',
        title: 'Copié !',
        message: 'Le contenu a été copié dans le presse-papiers',
      });
      
      Logger.logUserAction('clipboard_share', data);
      return true;
    } catch (error) {
      Logger.error('Clipboard share failed', { error });
      return false;
    }
  }

  // File System Access API integration
  public async saveFile(
    data: string,
    fileName: string,
    mimeType = 'text/plain'
  ): Promise<boolean> {
    // @ts-ignore - File System Access API
    if (window.showSaveFilePicker) {
      try {
        // @ts-ignore
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'Files',
            accept: { [mimeType]: [`.${fileName.split('.').pop()}`] },
          }],
        });

        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();

        Logger.logUserAction('native_file_save', { fileName });
        return true;
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          Logger.error('Native file save failed', { error });
        }
        return false;
      }
    }

    // Fallback to download
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    Logger.logUserAction('fallback_file_save', { fileName });
    return true;
  }

  // Wake Lock API integration
  private wakeLock: WakeLockSentinel | null = null;

  public async requestWakeLock(): Promise<boolean> {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        Logger.info('Wake lock acquired');
        
        this.wakeLock.addEventListener('release', () => {
          Logger.info('Wake lock released');
        });
        
        return true;
      } catch (error) {
        Logger.error('Wake lock request failed', { error });
        return false;
      }
    }
    
    return false;
  }

  public async releaseWakeLock(): Promise<void> {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
    }
  }
}

// Extend BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWA = PWAManager.getInstance();

// Generate manifest.json content
export const generateManifest = (): string => {
  return JSON.stringify(pwaManifest, null, 2);
};