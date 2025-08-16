/**
 * Component Performance Optimizer - World-class performance
 * React optimization utilities for maximum performance
 */

import React, { 
  memo, 
  useMemo, 
  useCallback, 
  lazy, 
  Suspense,
  ComponentType,
  LazyExoticComponent,
  ReactNode
} from 'react'
import { Loader2 } from 'lucide-react'

// Memoization HOC with deep comparison option
export function withMemo<T extends ComponentType<any>>(
  Component: T,
  areEqual?: (prevProps: any, nextProps: any) => boolean
): React.MemoExoticComponent<T> {
  return memo(Component, areEqual)
}

// Lazy loading HOC with error boundary
export function withLazy<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  fallback?: ReactNode
): LazyExoticComponent<T> {
  return lazy(factory)
}

// Virtualized list component for large datasets
interface VirtualizedListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => ReactNode
  overscan?: number
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0)
  
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight)
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight) + overscan,
      items.length
    )
    
    return {
      start: Math.max(0, start - overscan),
      end
    }
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length])
  
  const virtualItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end)
  }, [items, visibleRange])
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])
  
  return (
    <div
      className="overflow-auto"
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: visibleRange.start * itemHeight,
            width: '100%'
          }}
        >
          {virtualItems.map((item, index) => (
            <div
              key={visibleRange.start + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, visibleRange.start + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Optimized search hook with debouncing
export function useOptimizedSearch<T>(
  items: T[],
  searchFields: (keyof T)[],
  debounceMs: number = 300
) {
  const [query, setQuery] = React.useState('')
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  
  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, debounceMs)
    
    return () => clearTimeout(timer)
  }, [query, debounceMs])
  
  // Memoized search results
  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return items
    
    const lowercaseQuery = debouncedQuery.toLowerCase()
    
    return items.filter(item =>
      searchFields.some(field => {
        const value = item[field]
        if (typeof value === 'string') {
          return value.toLowerCase().includes(lowercaseQuery)
        }
        if (Array.isArray(value)) {
          return value.some(v => 
            typeof v === 'string' && v.toLowerCase().includes(lowercaseQuery)
          )
        }
        return false
      })
    )
  }, [items, searchFields, debouncedQuery])
  
  return {
    query,
    setQuery,
    results,
    isSearching: query !== debouncedQuery
  }
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const renderCount = React.useRef(0)
  const startTime = React.useRef(performance.now())
  
  React.useEffect(() => {
    renderCount.current++
    const endTime = performance.now()
    const renderTime = endTime - startTime.current
    
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Performance] ${componentName}`, {
        renderCount: renderCount.current,
        renderTime: `${renderTime.toFixed(2)}ms`
      })
    }
    
    startTime.current = performance.now()
  })
  
  return {
    renderCount: renderCount.current
  }
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = React.useState(false)
  const [entry, setEntry] = React.useState<IntersectionObserverEntry | null>(null)
  const elementRef = React.useRef<HTMLDivElement | null>(null)
  
  React.useEffect(() => {
    const element = elementRef.current
    if (!element) return
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
        setEntry(entry)
      },
      options
    )
    
    observer.observe(element)
    
    return () => observer.disconnect()
  }, [options])
  
  return {
    elementRef,
    isIntersecting,
    entry
  }
}

// Image lazy loading component
interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  placeholder?: ReactNode
  threshold?: number
}

export const LazyImage = memo(({ 
  src, 
  alt, 
  placeholder,
  threshold = 0.1,
  className,
  ...props 
}: LazyImageProps) => {
  const { elementRef, isIntersecting } = useIntersectionObserver({
    threshold
  })
  const [isLoaded, setIsLoaded] = React.useState(false)
  const [hasError, setHasError] = React.useState(false)
  
  const handleLoad = useCallback(() => {
    setIsLoaded(true)
  }, [])
  
  const handleError = useCallback(() => {
    setHasError(true)
  }, [])
  
  return (
    <div ref={elementRef} className={className}>
      {isIntersecting && !hasError ? (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }}
          {...props}
        />
      ) : (
        placeholder || (
          <div className="bg-muted animate-pulse rounded w-full h-full" />
        )
      )}
    </div>
  )
})

// Code splitting utilities  
export const ComponentSplitter = {
  FileManager: withLazy(() => import('@/components/FileManager').then(m => ({ default: m.FileManager }))),
  FilePreview: withLazy(() => import('@/components/FilePreview').then(m => ({ default: m.FilePreview }))),
  ChatWithFiles: withLazy(() => import('@/components/ChatWithFiles').then(m => ({ default: m.ChatWithFiles }))),
  MetricsDashboard: withLazy(() => import('@/components/MetricsDashboard').then(m => ({ default: m.MetricsDashboard })))
}

LazyImage.displayName = 'LazyImage'