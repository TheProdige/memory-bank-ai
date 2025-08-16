/**
 * Accessibility Enhancer - World-class WCAG AA compliance
 * React accessibility utilities and components
 */

import React, { 
  useEffect, 
  useRef, 
  createContext, 
  useContext,
  ReactNode,
  KeyboardEvent,
  RefObject
} from 'react'

// Accessibility context
interface AccessibilityContextType {
  announceMessage: (message: string, priority?: 'polite' | 'assertive') => void
  focusFirstElement: (container: HTMLElement) => void
  focusLastElement: (container: HTMLElement) => void
  trapFocus: (container: HTMLElement) => () => void
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null)

// Accessibility provider
export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const liveRegionRef = useRef<HTMLDivElement>(null)
  
  const announceMessage = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (liveRegionRef.current) {
      // Clear previous message first
      liveRegionRef.current.textContent = ''
      
      // Add new message after a brief delay
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = message
          liveRegionRef.current.setAttribute('aria-live', priority)
        }
      }, 100)
    }
  }
  
  const focusFirstElement = (container: HTMLElement) => {
    const focusableElements = getFocusableElements(container)
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    }
  }
  
  const focusLastElement = (container: HTMLElement) => {
    const focusableElements = getFocusableElements(container)
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1].focus()
    }
  }
  
  const trapFocus = (container: HTMLElement) => {
    const focusableElements = getFocusableElements(container)
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement?.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement?.focus()
          }
        }
      }
      
      if (e.key === 'Escape') {
        const trigger = container.querySelector('[data-focus-trigger]') as HTMLElement
        trigger?.focus()
      }
    }
    
    // Add event listener
    container.addEventListener('keydown', handleKeyDown as any)
    
    // Focus first element
    firstElement?.focus()
    
    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown as any)
    }
  }
  
  const value = {
    announceMessage,
    focusFirstElement,
    focusLastElement,
    trapFocus
  }
  
  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      {/* Screen reader live region */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="live-region"
      />
    </AccessibilityContext.Provider>
  )
}

// Hook to use accessibility context
export function useAccessibility() {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider')
  }
  return context
}

// Focus management hook
export function useFocusManagement() {
  const previousFocusRef = useRef<HTMLElement | null>(null)
  
  const saveFocus = () => {
    previousFocusRef.current = document.activeElement as HTMLElement
  }
  
  const restoreFocus = () => {
    if (previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }
  
  const focusElement = (element: HTMLElement | null) => {
    if (element) {
      element.focus()
    }
  }
  
  return {
    saveFocus,
    restoreFocus,
    focusElement
  }
}

// Skip link component
export function SkipLink({ 
  href, 
  children 
}: { 
  href: string
  children: ReactNode 
}) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 bg-primary text-primary-foreground px-4 py-2 rounded transition-all"
      onFocus={(e) => {
        e.currentTarget.classList.remove('sr-only')
      }}
      onBlur={(e) => {
        e.currentTarget.classList.add('sr-only')
      }}
    >
      {children}
    </a>
  )
}

// Accessible button with loading state
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  loadingText?: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function AccessibleButton({
  children,
  isLoading = false,
  loadingText = 'Chargement...',
  disabled,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  ...props
}: AccessibleButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { announceMessage } = useAccessibility()
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isLoading || disabled) {
      e.preventDefault()
      return
    }
    
    props.onClick?.(e)
  }
  
  // Announce loading state to screen readers
  useEffect(() => {
    if (isLoading) {
      announceMessage(loadingText)
    }
  }, [isLoading, loadingText, announceMessage])
  
  return (
    <button
      ref={buttonRef}
      {...props}
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      aria-describedby={ariaDescribedBy}
      aria-busy={isLoading}
      data-loading={isLoading}
    >
      {isLoading ? loadingText : children}
    </button>
  )
}

// Accessible form field with error handling
interface AccessibleFieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}

export function AccessibleField({
  id,
  label,
  error,
  hint,
  required = false,
  children
}: AccessibleFieldProps) {
  const errorId = error ? `${id}-error` : undefined
  const hintId = hint ? `${id}-hint` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ')
  
  return (
    <div className="space-y-2">
      <label 
        htmlFor={id}
        className="block text-sm font-medium text-foreground"
      >
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-label="requis">
            *
          </span>
        )}
      </label>
      
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      
      <div>
        {React.cloneElement(children as React.ReactElement, {
          id,
          'aria-describedby': describedBy || undefined,
          'aria-invalid': error ? 'true' : undefined,
          'aria-required': required
        })}
      </div>
      
      {error && (
        <p 
          id={errorId} 
          className="text-sm text-destructive"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  )
}

// Keyboard navigation hook
export function useKeyboardNavigation(
  containerRef: RefObject<HTMLElement>,
  orientation: 'horizontal' | 'vertical' = 'vertical'
) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const focusableElements = getFocusableElements(container)
      const currentIndex = focusableElements.findIndex(el => el === document.activeElement)
      
      let nextIndex: number
      
      switch (e.key) {
        case 'ArrowDown':
          if (orientation === 'vertical') {
            e.preventDefault()
            nextIndex = (currentIndex + 1) % focusableElements.length
            focusableElements[nextIndex]?.focus()
          }
          break
          
        case 'ArrowUp':
          if (orientation === 'vertical') {
            e.preventDefault()
            nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1
            focusableElements[nextIndex]?.focus()
          }
          break
          
        case 'ArrowRight':
          if (orientation === 'horizontal') {
            e.preventDefault()
            nextIndex = (currentIndex + 1) % focusableElements.length
            focusableElements[nextIndex]?.focus()
          }
          break
          
        case 'ArrowLeft':
          if (orientation === 'horizontal') {
            e.preventDefault()
            nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1
            focusableElements[nextIndex]?.focus()
          }
          break
          
        case 'Home':
          e.preventDefault()
          focusableElements[0]?.focus()
          break
          
        case 'End':
          e.preventDefault()
          focusableElements[focusableElements.length - 1]?.focus()
          break
      }
    }
    
    container.addEventListener('keydown', handleKeyDown as any)
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown as any)
    }
  }, [containerRef, orientation])
}

// Utility function to get focusable elements
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(', ')
  
  return Array.from(container.querySelectorAll(focusableSelectors))
}

// Color contrast checker (dev tool)
export function checkColorContrast(
  foreground: string, 
  background: string
): { ratio: number; wcagAA: boolean; wcagAAA: boolean } {
  const getLuminance = (color: string): number => {
    // Simplified luminance calculation - would need proper color parsing in production
    const rgb = color.replace(/[^\d,]/g, '').split(',').map(Number)
    const [r, g, b] = rgb.map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  
  const l1 = getLuminance(foreground)
  const l2 = getLuminance(background)
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  
  return {
    ratio,
    wcagAA: ratio >= 4.5,
    wcagAAA: ratio >= 7
  }
}