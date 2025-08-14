/**
 * Keyboard Shortcuts Hook
 * Professional keyboard navigation like Notion
 */

import { useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAppStore } from '@/core/state/AppStore';
import { Logger } from '@/core/logging/Logger';

interface ShortcutConfig {
  key: string;
  description: string;
  handler: () => void;
  category?: string;
  enabled?: boolean;
}

export const useKeyboardShortcuts = () => {
  const { 
    toggleSidebar, 
    toggleCommandPalette,
    userPreferences: { keyboardShortcuts: enabled }
  } = useAppStore();

  // Global shortcuts
  const shortcuts: ShortcutConfig[] = [
    {
      key: 'cmd+k,ctrl+k',
      description: 'Ouvrir la palette de commandes',
      handler: toggleCommandPalette,
      category: 'Navigation',
      enabled,
    },
    {
      key: 'cmd+\\,ctrl+\\',
      description: 'Basculer la barre latérale',
      handler: toggleSidebar,
      category: 'Navigation',
      enabled,
    },
    {
      key: 'cmd+shift+n,ctrl+shift+n',
      description: 'Nouvelle mémoire',
      handler: () => {
        // Navigate to new memory creation
        window.location.href = '/dashboard?new=true';
      },
      category: 'Actions',
      enabled,
    },
    {
      key: 'cmd+s,ctrl+s',
      description: 'Sauvegarder',
      handler: () => {
        // Trigger save action
        Logger.logUserAction('keyboard_save');
      },
      category: 'Actions',
      enabled,
    },
    {
      key: 'escape',
      description: 'Fermer les modals/menus',
      handler: () => {
        // Close any open modals, command palette, etc.
        const state = useAppStore.getState();
        if (state.ui.commandPaletteOpen) {
          toggleCommandPalette();
        }
      },
      category: 'Navigation',
      enabled,
    },
    {
      key: 'cmd+1,ctrl+1',
      description: 'Aller au tableau de bord',
      handler: () => window.location.href = '/dashboard',
      category: 'Navigation',
      enabled,
    },
    {
      key: 'cmd+2,ctrl+2',
      description: 'Aller aux mémoires',
      handler: () => window.location.href = '/memories',
      category: 'Navigation',
      enabled,
    },
    {
      key: 'cmd+3,ctrl+3',
      description: 'Aller aux paramètres',
      handler: () => window.location.href = '/settings',
      category: 'Navigation',
      enabled,
    },
    {
      key: 'cmd+?,ctrl+?',
      description: 'Afficher les raccourcis clavier',
      handler: () => {
        // Show shortcuts modal
        Logger.logUserAction('show_shortcuts');
      },
      category: 'Aide',
      enabled,
    },
  ];

  // Register shortcuts
  shortcuts.forEach(({ key, handler, enabled: shortcutEnabled }) => {
    useHotkeys(
      key,
      (e) => {
        if (!enabled || !shortcutEnabled) return;
        e.preventDefault();
        handler();
        Logger.logUserAction('keyboard_shortcut', { key });
      },
      {
        enabled: enabled && shortcutEnabled,
        preventDefault: true,
      }
    );
  });

  // Prevent default browser shortcuts that conflict
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F1-F12 from triggering browser actions
      if (e.key >= 'F1' && e.key <= 'F12') {
        e.preventDefault();
      }

      // Prevent Ctrl+S from saving page
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
      }

      // Prevent Ctrl+P from printing
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
      }

      // Prevent Ctrl+F from opening browser search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        // Could implement custom search here
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);

  return {
    shortcuts: shortcuts.filter(s => s.enabled !== false),
    enabled,
  };
};

// Hook for component-specific shortcuts
export const useComponentShortcuts = (shortcuts: ShortcutConfig[]) => {
  const { userPreferences: { keyboardShortcuts: globalEnabled } } = useAppStore();

  shortcuts.forEach(({ key, handler, enabled = true }) => {
    useHotkeys(
      key,
      (e) => {
        if (!globalEnabled || !enabled) return;
        e.preventDefault();
        handler();
        Logger.logUserAction('component_shortcut', { key });
      },
      {
        enabled: globalEnabled && enabled,
        preventDefault: true,
      }
    );
  });
};