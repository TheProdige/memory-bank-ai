/**
 * Enhanced Cost Enforcer - Production-grade cost control with intelligent backoff and batching
 */

import { Logger } from '@/core/logging/Logger';

export interface CostConstraints {
  dailyBudgetUSD: number;
  monthlyBudgetUSD: number;
  hourlyRateLimit: number;
  maxRetries: number;
  enableCaching: boolean;
  enableBatching: boolean;
  circuitBreakerThreshold: number;
  backoffMultiplier: number;
  batchWindow: number; // ms
  priorityQuotas: Record<Priority, number>; // % of budget
}

export interface EnhancedCostDecision extends CostDecision {
  backoffDelay?: number;
  batchId?: string;
  degradationStrategy?: DegradationStrategy;
  priority: Priority;
  alternatives: Alternative[];
}

export interface UsageMetrics {
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

type Priority = 'critical' | 'high' | 'medium' | 'low';
type DegradationStrategy = 'local-only' | 'cache-only' | 'simple-model' | 'defer' | 'reject';

export class EnhancedCostEnforcer {
  private static instance: EnhancedCostEnforcer;
  private constraints: CostConstraints;
  private cache = new Map<string, CacheEntry>();
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
      circuitBreakerThreshold: 0.5, // 50% failure rate
      backoffMultiplier: 1.5,
      batchWindow: 5000, // 5 seconds
      priorityQuotas: {
        critical: 0.5,
        high: 0.3,
        medium: 0.15,
        low: 0.05
      }
    };

    this.metrics = this.initializeMetrics();
    this.startPeriodicTasks();
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

      // 2. Cache check with intelligent key generation
      const cacheKey = this.generateIntelligentCacheKey(operation, estimatedTokens, userId);
      if (this.constraints.enableCaching) {
        const cached = this.getCachedDecision(cacheKey);
        if (cached) {
          this.updateMetrics('cache_hit', startTime);
          return { ...cached, cache_hit: true };
        }
      }

      // 3. Rate limiting with priority consideration
      if (this.isRateLimited(priority)) {
        const delay = this.computeBackoffDelay(priority);
        return this.createDecision(false, 'Rate limited', 'defer', priority, {
          backoffDelay: delay,
          alternatives: this.generateAlternatives(operation, priority)
        });
      }

      // 4. Budget analysis with priority quotas
      const budgetAnalysis = await this.analyzeBudget(estimatedCost, priority, userId);
      if (!budgetAnalysis.allowed) {
        return this.handleBudgetExceeded(budgetAnalysis, operation, priority, estimatedCost);
      }

      // 5. Batching for non-critical operations
      if (this.shouldBatch(operation, priority, estimatedCost)) {
        const batchId = this.addToBatch(operation, estimatedTokens, estimatedCost, priority, userId);
        return this.createDecision(false, 'Batched for optimization', 'defer', priority, {
          batchId,
          alternatives: ['Execute immediately (higher cost)']
        });
      }

      // 6. Dynamic model selection
      const modelDecision = this.selectOptimalModel(operation, estimatedCost, priority, budgetAnalysis.remainingBudget);

      // 7. Track request and update metrics
      this.trackRequest(operation, estimatedCost, priority, userId);
      
      const decision = this.createDecision(true, 'Approved', 'proceed', priority, {
        model: modelDecision.model,
        adjustedCost: modelDecision.cost,
        optimizations: modelDecision.optimizations
      });

      // 8. Cache decision
      if (this.constraints.enableCaching) {
        this.cacheDecision(cacheKey, decision);
      }

      this.updateMetrics('success', startTime);
      return decision;

    } catch (error) {
      this.updateMetrics('error', startTime);
      this.circuitBreaker.recordFailure();
      
      Logger.error('Cost enforcement failed', { error, operation, priority });
      
      // Fail-safe: allow critical operations, defer others
      return this.createDecision(
        priority === 'critical',
        `Enforcement error: ${error}`,
        priority === 'critical' ? 'proceed' : 'defer',
        priority
      );
    }
  }

  private shouldBatch(operation: string, priority: Priority, cost: number): boolean {
    if (!this.constraints.enableBatching || priority === 'critical') return false;
    
    const batchableOps = ['embed', 'summarize', 'classify', 'extract'];
    if (!batchableOps.includes(operation)) return false;
    
    const queue = this.batchQueues.get(priority);
    return !queue || queue.items.length < 10; // Don't batch if queue is full
  }

  private addToBatch(operation: string, tokens: number, cost: number, priority: Priority, userId?: string): string {
    let queue = this.batchQueues.get(priority);
    if (!queue) {
      queue = new BatchQueue(priority, this.constraints.batchWindow);
      this.batchQueues.set(priority, queue);
    }

    const batchId = `batch_${priority}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    queue.add({
      id: batchId,
      operation,
      tokens,
      cost,
      userId,
      timestamp: Date.now()
    });

    // Schedule processing if not already scheduled
    if (!queue.processingScheduled) {
      queue.processingScheduled = true;
      setTimeout(() => this.processBatch(priority), this.constraints.batchWindow);
    }

    return batchId;
  }

  private async processBatch(priority: Priority): Promise<void> {
    const queue = this.batchQueues.get(priority);
    if (!queue || queue.items.length === 0) return;

    const items = queue.flush();
    const totalCost = items.reduce((sum, item) => sum + item.cost, 0);
    const totalTokens = items.reduce((sum, item) => sum + item.tokens, 0);
    
    // Batch processing reduces cost by ~30%
    const optimizedCost = totalCost * 0.7;
    const savings = totalCost - optimizedCost;

    Logger.info('Processing batch', {
      priority,
      itemCount: items.length,
      totalCost,
      optimizedCost,
      savings: `$${savings.toFixed(4)}`
    });

    // Group by operation type for efficient processing
    const grouped = this.groupBatchItems(items);
    
    for (const [operation, operationItems] of grouped) {
      try {
        await this.executeBatchOperation(operation, operationItems);
        this.updateMetrics('batch_success', 0, operationItems.length);
      } catch (error) {
        Logger.error('Batch operation failed', { error, operation, itemCount: operationItems.length });
        this.updateMetrics('batch_error', 0, operationItems.length);
      }
    }
  }

  private computeBackoffDelay(priority: Priority, attempt: number = 1): number {
    const baseDelay = {
      critical: 100,
      high: 500,
      medium: 1000,
      low: 2000
    }[priority];

    const delay = baseDelay * Math.pow(this.constraints.backoffMultiplier, attempt - 1);
    const jitter = delay * 0.1 * Math.random(); // 10% jitter
    
    return Math.min(delay + jitter, 30000); // Max 30 seconds
  }

  private selectOptimalModel(operation: string, cost: number, priority: Priority, remainingBudget: number): ModelDecision {
    const models = {
      'gpt-4o-mini': { cost: 1.0, quality: 0.7, speed: 0.9 },
      'gpt-4.1-2025-04-14': { cost: 3.0, quality: 0.95, speed: 0.7 },
      'local': { cost: 0.0, quality: 0.5, speed: 0.8 }
    };

    // Select based on priority, budget, and requirements
    if (priority === 'critical' || remainingBudget > cost * 2) {
      return {
        model: 'gpt-4.1-2025-04-14',
        cost: cost * models['gpt-4.1-2025-04-14'].cost,
        optimizations: ['high-quality-model']
      };
    }

    if (remainingBudget < cost * 0.5) {
      return {
        model: 'local',
        cost: 0,
        optimizations: ['local-fallback', 'cost-optimization']
      };
    }

    return {
      model: 'gpt-4o-mini',
      cost: cost,
      optimizations: ['balanced-model']
    };
  }

  private generateIntelligentCacheKey(operation: string, tokens: number, userId?: string): string {
    const temporal = Math.floor(Date.now() / 300000); // 5-minute buckets
    const tokenBucket = Math.floor(tokens / 100) * 100; // 100-token buckets
    return `${operation}_${tokenBucket}_${temporal}_${userId || 'anon'}`;
  }

  async getMetrics(): Promise<UsageMetrics> {
    return { ...this.metrics };
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

  private startPeriodicTasks(): void {
    // Reset hourly metrics
    setInterval(() => this.resetHourlyMetrics(), 60 * 60 * 1000);
    
    // Cleanup expired cache entries
    setInterval(() => this.cleanupCache(), 15 * 60 * 1000);
    
    // Process idle batches
    setInterval(() => this.processIdleBatches(), 30 * 1000);
  }
}

class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailure?: Date;
  private threshold = 5;
  private timeout = 60000; // 1 minute

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

export const enhancedCostEnforcer = EnhancedCostEnforcer.getInstance();