/**
 * Command Palette Component
 * Notion-style command palette for quick navigation and actions
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { 
  Search, 
  Plus, 
  Settings, 
  Home, 
  Mic,
  Upload,
  Download,
  Trash2,
  Moon,
  Sun,
  Monitor,
  Keyboard,
  FileText,
  BarChart3,
} from 'lucide-react';
import { useAppStore } from '@/core/state/AppStore';
import { Logger } from '@/core/logging/Logger';
import { Badge } from '@/components/ui/badge';

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  category: string;
  action: () => void;
  keywords?: string[];
}

export const CommandPalette: React.FC = () => {
  const { 
    ui: { commandPaletteOpen },
    toggleCommandPalette,
    setTheme
  } = useAppStore();
  
  const [search, setSearch] = useState('');

  // Define all available commands
  const commands: CommandAction[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      label: 'Aller au tableau de bord',
      description: 'Vue d\'ensemble de vos mémoires',
      icon: <Home className="w-4 h-4" />,
      shortcut: 'Ctrl+1',
      category: 'Navigation',
      action: () => {
        window.location.href = '/dashboard';
        toggleCommandPalette();
      },
      keywords: ['accueil', 'home', 'dashboard'],
    },
    {
      id: 'nav-memories',
      label: 'Voir les mémoires',
      description: 'Parcourir toutes vos mémoires',
      icon: <FileText className="w-4 h-4" />,
      shortcut: 'Ctrl+2',
      category: 'Navigation',
      action: () => {
        window.location.href = '/memories';
        toggleCommandPalette();
      },
      keywords: ['mémoires', 'memories', 'notes'],
    },
    {
      id: 'nav-settings',
      label: 'Paramètres',
      description: 'Configurer l\'application',
      icon: <Settings className="w-4 h-4" />,
      shortcut: 'Ctrl+3',
      category: 'Navigation',
      action: () => {
        window.location.href = '/settings';
        toggleCommandPalette();
      },
      keywords: ['paramètres', 'settings', 'config'],
    },

    // Actions
    {
      id: 'action-record',
      label: 'Enregistrer une mémoire',
      description: 'Commencer un nouvel enregistrement',
      icon: <Mic className="w-4 h-4" />,
      shortcut: 'Ctrl+Shift+R',
      category: 'Actions',
      action: () => {
        // Trigger recording
        window.dispatchEvent(new CustomEvent('start-recording'));
        toggleCommandPalette();
      },
      keywords: ['enregistrer', 'record', 'micro', 'audio'],
    },
    {
      id: 'action-upload',
      label: 'Importer un fichier',
      description: 'Importer un fichier audio ou texte',
      icon: <Upload className="w-4 h-4" />,
      category: 'Actions',
      action: () => {
        // Trigger file upload
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*,text/*';
        input.click();
        toggleCommandPalette();
      },
      keywords: ['importer', 'upload', 'fichier', 'file'],
    },
    {
      id: 'action-new-note',
      label: 'Nouvelle note',
      description: 'Créer une note manuelle',
      icon: <Plus className="w-4 h-4" />,
      shortcut: 'Ctrl+Shift+N',
      category: 'Actions',
      action: () => {
        window.location.href = '/dashboard?new=note';
        toggleCommandPalette();
      },
      keywords: ['nouvelle', 'note', 'créer', 'new'],
    },

    // Appearance
    {
      id: 'theme-light',
      label: 'Thème clair',
      description: 'Basculer vers le thème clair',
      icon: <Sun className="w-4 h-4" />,
      category: 'Apparence',
      action: () => {
        setTheme('light');
        toggleCommandPalette();
      },
      keywords: ['clair', 'light', 'thème'],
    },
    {
      id: 'theme-dark',
      label: 'Thème sombre',
      description: 'Basculer vers le thème sombre',
      icon: <Moon className="w-4 h-4" />,
      category: 'Apparence',
      action: () => {
        setTheme('dark');
        toggleCommandPalette();
      },
      keywords: ['sombre', 'dark', 'thème'],
    },
    {
      id: 'theme-system',
      label: 'Thème système',
      description: 'Suivre le thème du système',
      icon: <Monitor className="w-4 h-4" />,
      category: 'Apparence',
      action: () => {
        setTheme('system');
        toggleCommandPalette();
      },
      keywords: ['système', 'system', 'auto', 'thème'],
    },

    // Help
    {
      id: 'help-shortcuts',
      label: 'Raccourcis clavier',
      description: 'Voir tous les raccourcis disponibles',
      icon: <Keyboard className="w-4 h-4" />,
      shortcut: 'Ctrl+?',
      category: 'Aide',
      action: () => {
        // Show shortcuts modal
        window.dispatchEvent(new CustomEvent('show-shortcuts'));
        toggleCommandPalette();
      },
      keywords: ['raccourcis', 'shortcuts', 'clavier', 'aide'],
    },
    {
      id: 'help-analytics',
      label: 'Statistiques d\'utilisation',
      description: 'Voir vos statistiques d\'utilisation',
      icon: <BarChart3 className="w-4 h-4" />,
      category: 'Aide',
      action: () => {
        window.location.href = '/settings#analytics';
        toggleCommandPalette();
      },
      keywords: ['stats', 'statistiques', 'analytics', 'usage'],
    },
  ];

  // Filter commands based on search
  const filteredCommands = commands.filter(command => {
    if (!search) return true;
    
    const searchLower = search.toLowerCase();
    const matchesLabel = command.label.toLowerCase().includes(searchLower);
    const matchesDescription = command.description?.toLowerCase().includes(searchLower);
    const matchesKeywords = command.keywords?.some(keyword => 
      keyword.toLowerCase().includes(searchLower)
    );
    
    return matchesLabel || matchesDescription || matchesKeywords;
  });

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, command) => {
    if (!acc[command.category]) {
      acc[command.category] = [];
    }
    acc[command.category].push(command);
    return acc;
  }, {} as Record<string, CommandAction[]>);

  useEffect(() => {
    if (!commandPaletteOpen) {
      setSearch('');
    }
  }, [commandPaletteOpen]);

  const handleSelect = (command: CommandAction) => {
    Logger.logUserAction('command_palette_action', { 
      commandId: command.id,
      label: command.label 
    });
    command.action();
  };

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={toggleCommandPalette}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <CommandInput
          placeholder="Rechercher des commandes..."
          value={search}
          onValueChange={setSearch}
        />
        
        <CommandList>
          <CommandEmpty>
            <div className="text-center py-6">
              <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Aucune commande trouvée pour "{search}"
              </p>
            </div>
          </CommandEmpty>
          
          <AnimatePresence>
            {Object.entries(groupedCommands).map(([category, categoryCommands], groupIndex) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIndex * 0.05 }}
              >
                <CommandGroup heading={category}>
                  {categoryCommands.map((command, index) => (
                    <CommandItem
                      key={command.id}
                      onSelect={() => handleSelect(command)}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                    >
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (groupIndex * categoryCommands.length + index) * 0.02 }}
                        className="flex items-center gap-3 flex-1"
                      >
                        <div className="flex-shrink-0">
                          {command.icon}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{command.label}</div>
                          {command.description && (
                            <div className="text-xs text-muted-foreground">
                              {command.description}
                            </div>
                          )}
                        </div>
                        
                        {command.shortcut && (
                          <Badge variant="secondary" className="text-xs font-mono">
                            {command.shortcut}
                          </Badge>
                        )}
                      </motion.div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                
                {groupIndex < Object.keys(groupedCommands).length - 1 && (
                  <CommandSeparator />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </CommandList>
      </motion.div>
    </CommandDialog>
  );
};