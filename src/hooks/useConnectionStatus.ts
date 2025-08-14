/**
 * Network Connection Status Hook
 * Monitors online/offline status and connection quality
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '@/core/state/AppStore';
import { Logger } from '@/core/logging/Logger';

interface ConnectionStatus {
  isOnline: boolean;
  connectionType: 'slow' | 'fast' | 'unknown';
  effectiveType: string;
  downlink: number;
  rtt: number;
}

export const useConnectionStatus = () => {
  const { setConnectionStatus, addNotification } = useAppStore();
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: navigator.onLine,
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
  });

  const updateConnectionInfo = () => {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (connection) {
      const newStatus: ConnectionStatus = {
        isOnline: navigator.onLine,
        connectionType: connection.downlink < 1.5 ? 'slow' : 'fast',
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
      };

      setStatus(newStatus);
      
      // Update global state
      if (!newStatus.isOnline) {
        setConnectionStatus('offline');
      } else if (newStatus.connectionType === 'slow') {
        setConnectionStatus('slow');
      } else {
        setConnectionStatus('online');
      }

      Logger.info('Connection status updated', newStatus);
      return newStatus;
    }

    return null;
  };

  const handleOnline = () => {
    const newStatus = updateConnectionInfo();
    Logger.info('Device came online');
    
    addNotification({
      type: 'success',
      title: 'Connexion rétablie',
      message: 'Vous êtes de nouveau en ligne.',
    });

    // Trigger sync or refresh operations here
    window.dispatchEvent(new CustomEvent('connection-restored'));
  };

  const handleOffline = () => {
    setStatus(prev => ({ ...prev, isOnline: false }));
    setConnectionStatus('offline');
    
    Logger.warn('Device went offline');
    
    addNotification({
      type: 'warning',
      title: 'Connexion perdue',
      message: 'Vous êtes hors ligne. Certaines fonctionnalités peuvent être limitées.',
    });
  };

  const handleConnectionChange = () => {
    updateConnectionInfo();
  };

  useEffect(() => {
    // Initial connection check
    updateConnectionInfo();

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Periodic connection quality check
    const interval = setInterval(() => {
      if (navigator.onLine) {
        // Ping test to check actual connectivity
        measureConnectionQuality();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
      
      clearInterval(interval);
    };
  }, []);

  const measureConnectionQuality = async () => {
    try {
      const startTime = performance.now();
      
      // Use a small image or API endpoint for ping test
      const response = await fetch('/favicon.ico?' + Date.now(), {
        method: 'HEAD',
        cache: 'no-cache',
      });
      
      const endTime = performance.now();
      const latency = endTime - startTime;

      if (response.ok) {
        const quality = latency < 200 ? 'fast' : latency < 500 ? 'medium' : 'slow';
        
        setStatus(prev => ({
          ...prev,
          connectionType: quality === 'slow' ? 'slow' : 'fast',
        }));

        if (quality === 'slow') {
          setConnectionStatus('slow');
        } else {
          setConnectionStatus('online');
        }
      }
    } catch (error) {
      Logger.warn('Connection quality check failed', { error });
      // Don't update status on fetch error, as it might be a server issue
    }
  };

  const retryConnection = async () => {
    Logger.info('Manually retrying connection');
    
    try {
      await measureConnectionQuality();
      addNotification({
        type: 'info',
        title: 'Test de connexion',
        message: 'Vérification de la qualité de connexion...',
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Échec du test',
        message: 'Impossible de vérifier la connexion.',
      });
    }
  };

  return {
    ...status,
    retryConnection,
    measureConnectionQuality,
  };
};