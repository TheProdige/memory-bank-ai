/**
 * Accessibility Manager
 * Comprehensive accessibility features for WCAG 2.1 AA compliance
 */

import { Logger } from '@/core/logging/Logger';
import { useAppStore } from '@/core/state/AppStore';

interface AccessibilityConfig {
  announceRouteChanges: boolean;
  announceFormErrors: boolean;
  announceLoadingStates: boolean;
  highContrastMode: boolean;
  reducedMotion: boolean;
  focusManagement: boolean;
  keyboardNavigation: boolean;
}

class AccessibilityManagerService {
  private static instance: AccessibilityManagerService;
  private liveRegion: HTMLElement | null = null;
  private config: AccessibilityConfig;
  private focusHistory: HTMLElement[] = [];
  private currentFocusIndex = -1;

  private constructor() {
    this.config = {
      announceRouteChanges: true,
      announceFormErrors: true,
      announceLoadingStates: true,
      highContrastMode: false,
      reducedMotion: this.prefersReducedMotion(),
      focusManagement: true,
      keyboardNavigation: true,
    };

    this.initialize();
  }

  public static getInstance(): AccessibilityManagerService {
    if (!AccessibilityManagerService.instance) {
      AccessibilityManagerService.instance = new AccessibilityManagerService();
    }
    return AccessibilityManagerService.instance;
  }

  private initialize(): void {
    this.createLiveRegion();
    this.setupFocusManagement();
    this.setupKeyboardNavigation();
    this.setupMotionPreferences();
    this.setupContrastPreferences();
    this.observeFormErrors();
    
    Logger.info('Accessibility Manager initialized', this.config);
  }

  private createLiveRegion(): void {
    // Create ARIA live region for announcements
    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.setAttribute('id', 'aria-live-region');
    this.liveRegion.style.position = 'absolute';
    this.liveRegion.style.left = '-10000px';
    this.liveRegion.style.width = '1px';
    this.liveRegion.style.height = '1px';
    this.liveRegion.style.overflow = 'hidden';
    
    document.body.appendChild(this.liveRegion);
  }

  public announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.liveRegion) return;

    this.liveRegion.setAttribute('aria-live', priority);
    this.liveRegion.textContent = message;
    
    // Clear after announcement to avoid repetition
    setTimeout(() => {
      if (this.liveRegion) {
        this.liveRegion.textContent = '';
      }
    }, 1000);

    Logger.debug('Accessibility announcement', { message, priority });
  }

  public announceRouteChange(routeName: string): void {
    if (!this.config.announceRouteChanges) return;
    
    this.announce(`Navigé vers ${routeName}`, 'polite');
  }

  public announceLoadingState(isLoading: boolean, context?: string): void {
    if (!this.config.announceLoadingStates) return;
    
    const message = isLoading 
      ? `Chargement${context ? ` de ${context}` : ''}...`
      : `Chargement terminé${context ? ` pour ${context}` : ''}`;
    
    this.announce(message, 'polite');
  }

  public announceFormError(fieldName: string, error: string): void {
    if (!this.config.announceFormErrors) return;
    
    this.announce(`Erreur dans le champ ${fieldName}: ${error}`, 'assertive');
  }

  private setupFocusManagement(): void {
    if (!this.config.focusManagement) return;

    // Track focus history for better navigation
    document.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      if (target && target !== document.body) {
        this.focusHistory.push(target);
        
        // Keep only last 10 focused elements
        if (this.focusHistory.length > 10) {
          this.focusHistory.shift();
        }
        
        this.currentFocusIndex = this.focusHistory.length - 1;
      }
    });

    // Enhanced skip links
    this.createSkipLinks();
  }

  private createSkipLinks(): void {
    const skipLinks = document.createElement('nav');
    skipLinks.className = 'skip-links';
    skipLinks.setAttribute('aria-label', 'Liens de navigation rapide');
    
    const links = [
      { href: '#main-content', text: 'Aller au contenu principal' },
      { href: '#navigation', text: 'Aller à la navigation' },
      { href: '#search', text: 'Aller à la recherche' },
    ];

    links.forEach(({ href, text }) => {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = text;
      link.className = 'skip-link';
      
      // Show on focus
      link.addEventListener('focus', () => {
        link.style.position = 'fixed';
        link.style.top = '0';
        link.style.left = '0';
        link.style.zIndex = '9999';
        link.style.padding = '8px 16px';
        link.style.backgroundColor = 'var(--primary)';
        link.style.color = 'var(--primary-foreground)';
        link.style.textDecoration = 'none';
      });
      
      link.addEventListener('blur', () => {
        link.style.position = 'absolute';
        link.style.left = '-10000px';
      });
      
      skipLinks.appendChild(link);
    });

    // Initially hidden
    skipLinks.style.position = 'absolute';
    skipLinks.style.left = '-10000px';
    
    document.body.insertBefore(skipLinks, document.body.firstChild);
  }

  private setupKeyboardNavigation(): void {
    if (!this.config.keyboardNavigation) return;

    document.addEventListener('keydown', (event) => {
      // Escape key handling
      if (event.key === 'Escape') {
        this.handleEscapeKey();
      }

      // Tab management for modal dialogs
      if (event.key === 'Tab') {
        this.handleTabNavigation(event);
      }

      // Arrow key navigation for custom components
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        this.handleArrowNavigation(event);
      }
    });
  }

  private handleEscapeKey(): void {
    // Close any open modals, dropdowns, etc.
    const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (modal) {
      const closeButton = modal.querySelector('[aria-label*="fermer"], [aria-label*="close"]') as HTMLElement;
      closeButton?.click();
      return;
    }

    // Close command palette
    const state = useAppStore.getState();
    if (state.ui.commandPaletteOpen) {
      state.toggleCommandPalette();
      return;
    }

    // Return focus to last focused element
    if (this.focusHistory.length > 1) {
      const previousElement = this.focusHistory[this.focusHistory.length - 2];
      if (previousElement && document.contains(previousElement)) {
        previousElement.focus();
      }
    }
  }

  private handleTabNavigation(event: KeyboardEvent): void {
    const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!modal) return;

    // Trap focus within modal
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  private handleArrowNavigation(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    
    // Handle custom list navigation
    if (target.closest('[role="listbox"], [role="menu"], [role="tablist"]')) {
      event.preventDefault();
      this.navigateList(event, target);
    }
  }

  private navigateList(event: KeyboardEvent, target: HTMLElement): void {
    const container = target.closest('[role="listbox"], [role="menu"], [role="tablist"]');
    if (!container) return;

    const items = Array.from(
      container.querySelectorAll('[role="option"], [role="menuitem"], [role="tab"]')
    ) as HTMLElement[];

    const currentIndex = items.indexOf(target);
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        newIndex = (currentIndex + 1) % items.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        newIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = items.length - 1;
        break;
    }

    if (newIndex !== currentIndex && items[newIndex]) {
      items[newIndex].focus();
    }
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private setupMotionPreferences(): void {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const updateMotionPreference = () => {
      this.config.reducedMotion = mediaQuery.matches;
      document.documentElement.style.setProperty(
        '--animation-duration',
        mediaQuery.matches ? '0ms' : '300ms'
      );
      
      Logger.info('Motion preference updated', { reducedMotion: mediaQuery.matches });
    };

    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);
  }

  private setupContrastPreferences(): void {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    
    const updateContrastPreference = () => {
      this.config.highContrastMode = mediaQuery.matches;
      
      if (mediaQuery.matches) {
        document.documentElement.classList.add('high-contrast');
      } else {
        document.documentElement.classList.remove('high-contrast');
      }
      
      Logger.info('Contrast preference updated', { highContrast: mediaQuery.matches });
    };

    updateContrastPreference();
    mediaQuery.addEventListener('change', updateContrastPreference);
  }

  private observeFormErrors(): void {
    // Observe form validation errors and announce them
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            
            // Look for error messages
            const errorElement = element.querySelector('[role="alert"], .error-message, [aria-invalid="true"]') as HTMLElement;
            if (errorElement) {
              const fieldLabel = this.getFieldLabel(errorElement);
              const errorText = errorElement.textContent || 'Erreur de validation';
              this.announceFormError(fieldLabel, errorText);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private getFieldLabel(errorElement: HTMLElement): string {
    // Try to find associated label
    const field = errorElement.closest('.form-field, .input-group') || errorElement;
    const label = field.querySelector('label');
    
    if (label) {
      return label.textContent || 'Champ';
    }

    // Fallback to aria-label or placeholder
    const input = field.querySelector('input, textarea, select') as HTMLElement;
    if (input) {
      return input.getAttribute('aria-label') || 
             input.getAttribute('placeholder') || 
             'Champ';
    }

    return 'Champ';
  }

  // Color contrast checker
  public checkColorContrast(foreground: string, background: string): number {
    const getLuminance = (hex: string) => {
      const rgb = parseInt(hex.slice(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;
      
      const rsRGB = r / 255;
      const gsRGB = g / 255;
      const bsRGB = b / 255;
      
      const rLin = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
      const gLin = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
      const bLin = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
      
      return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
    };

    const lum1 = getLuminance(foreground);
    const lum2 = getLuminance(background);
    
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  }

  public getConfig(): AccessibilityConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<AccessibilityConfig>): void {
    this.config = { ...this.config, ...updates };
    Logger.info('Accessibility config updated', updates);
  }
}

export const AccessibilityManager = AccessibilityManagerService.getInstance();
