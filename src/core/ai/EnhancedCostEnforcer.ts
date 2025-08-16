/**
 * Enhanced Cost Enforcer - Production-grade cost control with intelligent backoff and batching
 */

import { Logger } from '@/core/logging/Logger';
import { costEnforcer } from './CostEnforcer';
import { EnhancedCostEnforcerMethods } from './EnhancedCostEnforcerMethods';

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type DegradationStrategy = 'defer' | 'cache' | 'local' | 'batch' | 'proceed';

export interface Alternative {
  description: string;
  cost: number;
  quality: number;
}

export interface EnhancedCostDecision {
  allowed: boolean;
  reason: string;
  suggestedAction: string;
  estimatedCost: number;
  priority: Priority;
  alternatives: Alternative[];
  degradationStrategy: DegradationStrategy;
  backoffDelay?: number;
  batchId?: string;
  cache_hit?: boolean;
}

export interface RequestEntry {
  timestamp: number;
  operation: string;
  cost: number;
  priority: Priority;
  userId?: string;
}

interface CostConstraints {
  dailyBudgetUSD: number;
  monthlyBudgetUSD: number;
  hourlyRateLimit: number;
  maxRetries: number;
  enableCaching: boolean;
  enableBatching: boolean;
  circuitBreakerThreshold: number;
  backoffMultiplier: number;
  batchWindow: number;
  priorityQuotas: Record<Priority, number>;
}

interface UsageMetrics {
  requests: {
    successful: number;
    failed: number;
    cached: number;
    batched: number;
  };
  costs: {
    hourly: number;
    daily: number;
    monthly: number;
  };
  performance: {
    avgLatency: number;
    p95Latency: number;
    cacheHitRate: number;
    batchEfficiency: number;
  };
  circuitBreaker: {
    state: 'closed' | 'open' | 'half-open';
    failureCount: number;
    lastFailure?: Date;
  };
}

interface BatchItem {
  id: string;
  operation: string;
  tokens: number;
  cost: number;
  userId?: string;
  timestamp: number;
}

interface ModelDecision {
  model: string;
  cost: number;
  optimizations: string[];
}

interface CacheEntry {
  decision: EnhancedCostDecision;
  timestamp: number;
  ttl: number;
}

export class EnhancedCostEnforcer {
  private static instance: EnhancedCostEnforcer;
  private constraints: CostConstraints;
  private decisionCache = new Map<string, CacheEntry>();
  private requestHistory: RequestEntry[] = [];
  private batchQueues = new Map<Priority, BatchQueue>();
  private circuitBreaker = new CircuitBreaker();
  private metrics: UsageMetrics;

  private constructor() {
    this.constraints = {
      dailyBudgetUSD: 5.0,
      monthlyBudgetUSD: 100.0,
      hourlyRateLimit: 60,
      maxRetries: 3,
      enableCaching: true,
      enableBatching: true,
      circuitBreakerThreshold: 0.5,
      backoffMultiplier: 1.5,
      batchWindow: 5000,
      priorityQuotas: {
        critical: 0.5,
        high: 0.3,
        medium: 0.15,
        low: 0.05
      }
    };

    this.metrics = this.initializeMetrics();
    this.startMaintenanceTasks();
  }

  public static getInstance(): EnhancedCostEnforcer {
    if (!EnhancedCostEnforcer.instance) {
      EnhancedCostEnforcer.instance = new EnhancedCostEnforcer();
    }
    return EnhancedCostEnforcer.instance;
  }

  async shouldProceed(
    operation: string,
    estimatedTokens: number,
    estimatedCost: number,
    priority: Priority = 'medium',
    userId?: string
  ): Promise<EnhancedCostDecision> {
    const startTime = performance.now();
    
    try {
      // 1. Circuit breaker check
      if (this.circuitBreaker.isOpen() && priority !== 'critical') {
        return this.createDecision(false, 'Circuit breaker open', 'defer', priority, {
          backoffDelay: this.circuitBreaker.getBackoffDelay()
        });
      }

      // 2. Cache check
      const cacheKey = this.generateCacheKey(operation, estimatedTokens, userId);
      if (this.constraints.enableCaching) {
        const cached = EnhancedCostEnforcerMethods.getCachedDecision(this.decisionCache, cacheKey);
        if (cached) {
          EnhancedCostEnforcerMethods.updateMetrics(this.metrics, 'cache_hit', startTime);
          return { ...cached, cache_hit: true };
        }
      }

      // 3. Rate limiting check
      if (EnhancedCostEnforcerMethods.isRateLimited(this.requestHistory, priority, this.constraints.hourlyRateLimit)) {
        const alternatives = EnhancedCostEnforcerMethods.generateAlternatives(operation, priority);
        return this.createDecision(false, 'Rate limit exceeded', 'defer', priority, { alternatives });
      }

      // 4. Budget analysis
      const budgetAnalysis = await EnhancedCostEnforcerMethods.analyzeBudget(this.metrics.costs, estimatedCost, priority, userId);
      if (!budgetAnalysis.allowed) {
        return EnhancedCostEnforcerMethods.handleBudgetExceeded(budgetAnalysis, operation, priority, estimatedCost);
      }

      // 5. Success - track and return
      EnhancedCostEnforcerMethods.trackRequest(this.requestHistory, operation, estimatedCost, priority, userId);
      
      const decision = this.createDecision(true, 'Within budget and limits', 'proceed', priority);
      
      // Update metrics and cache
      EnhancedCostEnforcerMethods.updateMetrics(this.metrics, 'success', startTime);
      
      // Cache successful decisions
      EnhancedCostEnforcerMethods.cacheDecision(this.decisionCache, cacheKey, decision);
      
      return decision;

    } catch (error) {
      EnhancedCostEnforcerMethods.updateMetrics(this.metrics, 'error', startTime);
      Logger.error('Enhanced cost enforcement failed', { error, operation, priority });
      
      // Fallback to simple enforcement
      const fallback = await costEnforcer.shouldProceed(operation, estimatedTokens, estimatedCost, priority as any);
      return {
        allowed: fallback.allowed,
        reason: fallback.reason,
        suggestedAction: fallback.suggestedAction,
        estimatedCost: fallback.estimatedCost,
        priority,
        alternatives: [],
        degradationStrategy: fallback.allowed ? 'proceed' : 'defer'
      };
    }
  }

  async processBatch(items: BatchItem[]): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Group by operation type
      const grouped = EnhancedCostEnforcerMethods.groupBatchItems(items);
      
      for (const [operation, operationItems] of grouped.entries()) {
        try {
          await EnhancedCostEnforcerMethods.executeBatchOperation(operation, operationItems);
          EnhancedCostEnforcerMethods.updateMetrics(this.metrics, 'batch_success', startTime, operationItems.length);
        } catch (error) {
          EnhancedCostEnforcerMethods.updateMetrics(this.metrics, 'batch_error', startTime, operationItems.length);
          Logger.error('Batch operation failed', { error, operation, count: operationItems.length });
        }
      }
      
    } catch (error) {
      Logger.error('Batch processing failed', { error, itemCount: items.length });
    }
  }

  async getMetrics(): Promise<UsageMetrics> {
    return { ...this.metrics };
  }

  private generateCacheKey(operation: string, tokens: number, userId?: string): string {
    const temporal = Math.floor(Date.now() / 300000); // 5-minute buckets
    const tokenBucket = Math.floor(tokens / 100) * 100; // 100-token buckets
    return `${operation}_${tokenBucket}_${temporal}_${userId || 'anon'}`;
  }

  private createDecision(
    allowed: boolean,
    reason: string,
    action: DegradationStrategy,
    priority: Priority,
    extras: any = {}
  ): EnhancedCostDecision {
    return {
      allowed,
      reason,
      suggestedAction: action,
      estimatedCost: extras.adjustedCost || 0,
      priority,
      alternatives: extras.alternatives || [],
      degradationStrategy: action,
      ...extras
    };
  }

  private initializeMetrics(): UsageMetrics {
    return {
      requests: { successful: 0, failed: 0, cached: 0, batched: 0 },
      costs: { hourly: 0, daily: 0, monthly: 0 },
      performance: { avgLatency: 0, p95Latency: 0, cacheHitRate: 0, batchEfficiency: 0 },
      circuitBreaker: { state: 'closed', failureCount: 0 }
    };
  }

  private startMaintenanceTasks(): void {
    // Hourly cleanup
    setInterval(() => {
      EnhancedCostEnforcerMethods.resetHourlyMetrics(this.metrics);
    }, 60 * 60 * 1000);

    // Cache cleanup every 5 minutes
    setInterval(() => {
      EnhancedCostEnforcerMethods.cleanupCache(this.decisionCache);
    }, 5 * 60 * 1000);

    // Process idle batches every 30 seconds
    setInterval(() => {
      EnhancedCostEnforcerMethods.processIdleBatches(this.batchQueues);
    }, 30 * 1000);
  }
}

class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailure?: Date;
  private threshold = 5;
  private timeout = 60000;

  recordFailure(): void {
    this.failureCount++;
    this.lastFailure = new Date();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'open';
      setTimeout(() => this.state = 'half-open', this.timeout);
    }
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  isOpen(): boolean {
    return this.state === 'open';
  }

  getBackoffDelay(): number {
    if (this.state === 'open' && this.lastFailure) {
      const timeSinceFailure = Date.now() - this.lastFailure.getTime();
      return Math.max(0, this.timeout - timeSinceFailure);
    }
    return 0;
  }
}

class BatchQueue {
  items: BatchItem[] = [];
  processingScheduled = false;

  constructor(
    public priority: Priority,
    public windowMs: number
  ) {}

  add(item: BatchItem): void {
    this.items.push(item);
  }

  flush(): BatchItem[] {
    const items = [...this.items];
    this.items = [];
    this.processingScheduled = false;
    return items;
  }
}

export const enhancedCostEnforcer = EnhancedCostEnforcer.getInstance();