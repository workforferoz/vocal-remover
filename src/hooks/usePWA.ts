import { useState, useEffect } from 'react';
import { pwaManager, type NetworkStatus } from '../services/pwa';

export function usePWA() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(() => pwaManager.getNetworkStatus());
  const [canInstall, setCanInstall] = useState<boolean>(() => pwaManager.getCanInstall());
  const [isInstalled, setIsInstalled] = useState<boolean>(() => pwaManager.getIsInstalled());
  const [hasUpdate, setHasUpdate] = useState<boolean>(() => pwaManager.getHasUpdate());

  useEffect(() => {
    const unsubscribe = pwaManager.subscribe(() => {
      setNetworkStatus(pwaManager.getNetworkStatus());
      setCanInstall(pwaManager.getCanInstall());
      setIsInstalled(pwaManager.getIsInstalled());
      setHasUpdate(pwaManager.getHasUpdate());
    });

    return unsubscribe;
  }, []);

  return {
    networkStatus,
    canInstall,
    isInstalled,
    hasUpdate,
    promptInstall: () => pwaManager.promptInstall(),
    applyUpdate: () => pwaManager.applyUpdate(),
  };
}

