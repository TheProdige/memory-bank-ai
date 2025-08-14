/**
 * Performance Monitoring System
 * Tracks and reports on application performance metrics
 */

import { Logger } from '@/core/logging/Logger';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  type: 'timing' | 'counter' | 'memory' | 'custom';
}

interface NavigationTiming {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
}

class PerformanceMonitorService {
  private static instance: PerformanceMonitorService;
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];

  private constructor() {
    this.initializeObservers();
    this.trackNavigationTiming();
  }

  public static getInstance(): PerformanceMonitorService {
    if (!PerformanceMonitorService.instance) {
      PerformanceMonitorService.instance = new PerformanceMonitorService();
    }
    return PerformanceMonitorService.instance;
  }

  private initializeObservers(): void {
    // Core Web Vitals
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordMetric('LCP', lastEntry.startTime, 'timing');
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        this.observers.push(lcpObserver);
      } catch (e) {
        Logger.warn('LCP observer not supported');
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.recordMetric('FID', entry.processingStart - entry.startTime, 'timing');
          });
        });
        fidObserver.observe({ type: 'first-input', buffered: true });
        this.observers.push(fidObserver);
      } catch (e) {
        Logger.warn('FID observer not supported');
      }

      // Cumulative Layout Shift (CLS)
      try {
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.recordMetric('CLS', clsValue, 'timing');
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
        this.observers.push(clsObserver);
      } catch (e) {
        Logger.warn('CLS observer not supported');
      }
    }
  }

  private trackNavigationTiming(): void {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          const timing: NavigationTiming = {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
            loadComplete: navigation.loadEventEnd - navigation.startTime,
          };

          // Paint timings
          const paintEntries = performance.getEntriesByType('paint');
          paintEntries.forEach((entry) => {
            if (entry.name === 'first-paint') {
              timing.firstPaint = entry.startTime;
            } else if (entry.name === 'first-contentful-paint') {
              timing.firstContentfulPaint = entry.startTime;
            }
          });

          Logger.info('Navigation Timing', timing);
          
          // Record individual metrics
          this.recordMetric('DOM_CONTENT_LOADED', timing.domContentLoaded, 'timing');
          this.recordMetric('LOAD_COMPLETE', timing.loadComplete, 'timing');
          if (timing.firstPaint) {
            this.recordMetric('FIRST_PAINT', timing.firstPaint, 'timing');
          }
          if (timing.firstContentfulPaint) {
            this.recordMetric('FIRST_CONTENTFUL_PAINT', timing.firstContentfulPaint, 'timing');
          }
        }
      }, 0);
    });
  }

  public recordMetric(name: string, value: number, type: PerformanceMetric['type'] = 'custom'): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      type,
    };

    this.metrics.push(metric);
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }

    Logger.debug(`Performance Metric: ${name}`, { value, type });
  }

  public startTiming(label: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(label, duration, 'timing');
    };
  }

  public measureMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.recordMetric('MEMORY_USED', memory.usedJSHeapSize, 'memory');
      this.recordMetric('MEMORY_TOTAL', memory.totalJSHeapSize, 'memory');
      this.recordMetric('MEMORY_LIMIT', memory.jsHeapSizeLimit, 'memory');
    }
  }

  public measureResourceTiming(): void {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    resources.forEach((resource) => {
      const duration = resource.responseEnd - resource.startTime;
      const name = resource.name.split('/').pop() || 'unknown';
      
      this.recordMetric(`RESOURCE_${name}`, duration, 'timing');
    });
  }

  public getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  public getMetricsByType(type: PerformanceMetric['type']): PerformanceMetric[] {
    return this.metrics.filter(metric => metric.type === type);
  }

  public getAverageMetric(name: string): number | null {
    const relevantMetrics = this.metrics.filter(metric => metric.name === name);
    if (relevantMetrics.length === 0) return null;
    
    const sum = relevantMetrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / relevantMetrics.length;
  }

  public exportMetrics(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      metrics: this.metrics,
      summary: {
        totalMetrics: this.metrics.length,
        averageLCP: this.getAverageMetric('LCP'),
        averageFID: this.getAverageMetric('FID'),
        averageCLS: this.getAverageMetric('CLS'),
      },
    }, null, 2);
  }

  public cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

export const PerformanceMonitor = PerformanceMonitorService.getInstance();

// Global performance tracking helpers
export const withPerformanceTracking = <T extends (...args: any[]) => any>(
  fn: T,
  label: string
): T => {
  return ((...args: any[]) => {
    const endTiming = PerformanceMonitor.startTiming(label);
    const result = fn(...args);
    
    if (result instanceof Promise) {
      return result.finally(endTiming);
    } else {
      endTiming();
      return result;
    }
  }) as T;
};
