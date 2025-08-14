/**
 * Global Application State Management
 * Using Zustand for predictable state management with TypeScript
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Logger } from '@/core/logging/Logger';

// UI State
interface UIState {
  isLoading: boolean;
  isSidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  commandPaletteOpen: boolean;
  notifications: Notification[];
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timestamp: number;
  dismissed?: boolean;
}

// Performance State
interface PerformanceState {
  metrics: {
    pageLoadTime?: number;
    apiResponseTimes: Record<string, number[]>;
    memoryUsage?: number;
  };
  connectionStatus: 'online' | 'offline' | 'slow';
}

// User Preferences
interface UserPreferences {
  language: 'fr' | 'en';
  audioQuality: 'low' | 'medium' | 'high';
  autoSave: boolean;
  keyboardShortcuts: boolean;
  notifications: {
    email: boolean;
    push: boolean;
    sound: boolean;
  };
}

// App State Interface
interface AppState {
  ui: UIState;
  performance: PerformanceState;
  userPreferences: UserPreferences;
  
  // Actions
  setLoading: (loading: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: UIState['theme']) => void;
  toggleCommandPalette: () => void;
  
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  
  updatePerformanceMetric: (key: string, value: number) => void;
  setConnectionStatus: (status: PerformanceState['connectionStatus']) => void;
  
  updateUserPreferences: (preferences: Partial<UserPreferences>) => void;
  
  // Computed
  getActiveNotifications: () => Notification[];
}

const initialState = {
  ui: {
    isLoading: false,
    isSidebarOpen: true,
    theme: 'system' as const,
    commandPaletteOpen: false,
    notifications: [],
  },
  performance: {
    metrics: {
      apiResponseTimes: {},
    },
    connectionStatus: 'online' as const,
  },
  userPreferences: {
    language: 'fr' as const,
    audioQuality: 'medium' as const,
    autoSave: true,
    keyboardShortcuts: true,
    notifications: {
      email: true,
      push: true,
      sound: false,
    },
  },
};

export const useAppStore = create<AppState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // UI Actions
      setLoading: (loading: boolean) => {
        set((state) => {
          state.ui.isLoading = loading;
        });
        Logger.debug('Loading state changed', { loading });
      },

      toggleSidebar: () => {
        set((state) => {
          state.ui.isSidebarOpen = !state.ui.isSidebarOpen;
        });
        Logger.logUserAction('toggle_sidebar');
      },

      setTheme: (theme: UIState['theme']) => {
        set((state) => {
          state.ui.theme = theme;
        });
        Logger.logUserAction('change_theme', { theme });
      },

      toggleCommandPalette: () => {
        set((state) => {
          state.ui.commandPaletteOpen = !state.ui.commandPaletteOpen;
        });
        Logger.logUserAction('toggle_command_palette');
      },

      // Notification Actions
      addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => {
        const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newNotification: Notification = {
          ...notification,
          id,
          timestamp: Date.now(),
        };

        set((state) => {
          state.ui.notifications.push(newNotification);
          // Keep only last 10 notifications
          if (state.ui.notifications.length > 10) {
            state.ui.notifications.shift();
          }
        });

        Logger.info('Notification added', { type: notification.type, title: notification.title });
      },

      dismissNotification: (id: string) => {
        set((state) => {
          const notification = state.ui.notifications.find(n => n.id === id);
          if (notification) {
            notification.dismissed = true;
          }
        });
      },

      clearNotifications: () => {
        set((state) => {
          state.ui.notifications = [];
        });
      },

      // Performance Actions
      updatePerformanceMetric: (key: string, value: number) => {
        set((state) => {
          if (key.includes('api_')) {
            const apiKey = key.replace('api_', '');
            if (!state.performance.metrics.apiResponseTimes[apiKey]) {
              state.performance.metrics.apiResponseTimes[apiKey] = [];
            }
            state.performance.metrics.apiResponseTimes[apiKey].push(value);
            
            // Keep only last 20 measurements per API
            if (state.performance.metrics.apiResponseTimes[apiKey].length > 20) {
              state.performance.metrics.apiResponseTimes[apiKey].shift();
            }
          } else {
            (state.performance.metrics as any)[key] = value;
          }
        });
      },

      setConnectionStatus: (status: PerformanceState['connectionStatus']) => {
        set((state) => {
          state.performance.connectionStatus = status;
        });
        Logger.info('Connection status changed', { status });
      },

      // User Preferences Actions
      updateUserPreferences: (preferences: Partial<UserPreferences>) => {
        set((state) => {
          Object.assign(state.userPreferences, preferences);
        });
        Logger.logUserAction('update_preferences', preferences);
      },

      // Computed
      getActiveNotifications: () => {
        return get().ui.notifications.filter(n => !n.dismissed);
      },
    }))
  )
);

// Persistence middleware for user preferences
useAppStore.subscribe(
  (state) => state.userPreferences,
  (preferences) => {
    try {
      localStorage.setItem('echovault_preferences', JSON.stringify(preferences));
    } catch (error) {
      Logger.error('Failed to save user preferences', { error });
    }
  }
);

// Load saved preferences on init
try {
  const savedPreferences = localStorage.getItem('echovault_preferences');
  if (savedPreferences) {
    const preferences = JSON.parse(savedPreferences);
    useAppStore.getState().updateUserPreferences(preferences);
  }
} catch (error) {
  Logger.warn('Failed to load saved preferences', { error });
}

// Export selectors for better performance
export const selectUIState = (state: AppState) => state.ui;
export const selectPerformanceState = (state: AppState) => state.performance;
export const selectUserPreferences = (state: AppState) => state.userPreferences;
export const selectIsLoading = (state: AppState) => state.ui.isLoading;
export const selectTheme = (state: AppState) => state.ui.theme;
export const selectNotifications = (state: AppState) => state.getActiveNotifications();
