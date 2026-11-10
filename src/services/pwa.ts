/**
 * Vocal Studio AI - PWA, Offline & Desktop Installation Manager (Stage 6)
 */

export type NetworkStatus = 'online' | 'offline' | 'reconnecting';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type PwaListener = () => void;

class PwaManager {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isAppInstalled: boolean = false;
  private networkStatus: NetworkStatus = typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline';
  private hasUpdate: boolean = false;
  private waitingWorker: ServiceWorker | null = null;

  private listeners: Set<PwaListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initNetworkListeners();
      this.initInstallListeners();
    }
  }

  public subscribe(listener: PwaListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private initNetworkListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  public handleOnline() {
    this.networkStatus = 'reconnecting';
    this.notify();
    setTimeout(() => {
      this.networkStatus = 'online';
      this.notify();
    }, 1000);
  }

  public handleOffline() {
    this.networkStatus = 'offline';
    this.notify();
  }

  public handleBeforeInstallPrompt(e: BeforeInstallPromptEvent) {
    e.preventDefault();
    this.deferredPrompt = e;
    this.notify();
  }

  private initInstallListeners() {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      this.handleBeforeInstallPrompt(e as BeforeInstallPromptEvent);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isAppInstalled = true;
      this.notify();
    });

    // Check if launched in standalone display mode
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      this.isAppInstalled = true;
    }
  }

  /**
   * Registers the service worker with update checking.
   */
  public registerServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for waiting service worker
          if (registration.waiting) {
            this.waitingWorker = registration.waiting;
            this.hasUpdate = true;
            this.notify();
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  this.waitingWorker = newWorker;
                  this.hasUpdate = true;
                  this.notify();
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('Service Worker registration skipped or failed:', err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }

  /**
   * Prompts the user to install the application as a standalone desktop app.
   */
  public async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      this.notify();
      return choice.outcome === 'accepted';
    } catch {
      return false;
    }
  }

  /**
   * Activates the waiting service worker and reloads the application.
   */
  public applyUpdate() {
    if (this.waitingWorker) {
      this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  public getCanInstall(): boolean {
    return Boolean(this.deferredPrompt);
  }

  public getIsInstalled(): boolean {
    return this.isAppInstalled;
  }

  public getNetworkStatus(): NetworkStatus {
    return this.networkStatus;
  }

  public getHasUpdate(): boolean {
    return this.hasUpdate;
  }
}

export const pwaManager = new PwaManager();
