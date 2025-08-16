/**
 * Missing methods for EnhancedCostEnforcer
 */

import { Priority, DegradationStrategy, Alternative, EnhancedCostDecision } from './EnhancedCostEnforcer';

export class EnhancedCostEnforcerMethods {
  static getCachedDecision(cache: Map<string, any>, key: string): EnhancedCostDecision | null {
    const entry = cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key);
      return null;
    }
    
    return entry.decision;
  }

  static updateMetrics(metrics: any, type: string, startTime: number, count: number = 1): void {
    const latency = performance.now() - startTime;
    
    switch (type) {
      case 'success':
        metrics.requests.successful += count;
        break;
      case 'cache_hit':
        metrics.requests.cached += count;
        break;
      case 'batch_success':
        metrics.requests.batched += count;
        break;
      case 'error':
      case 'batch_error':
        metrics.requests.failed += count;
        break;
    }
    
    // Update performance metrics
    metrics.performance.avgLatency = (metrics.performance.avgLatency + latency) / 2;
    if (latency > metrics.performance.p95Latency) {
      metrics.performance.p95Latency = latency;
    }
  }

  static isRateLimited(requestHistory: any[], priority: Priority, hourlyLimit: number): boolean {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentRequests = requestHistory.filter(req => req.timestamp > oneHourAgo);
    
    const priorityMultiplier = {
      critical: 1.5,
      high: 1.2,
      medium: 1.0,
      low: 0.5
    }[priority];
    
    return recentRequests.length >= hourlyLimit * priorityMultiplier;
  }

  static generateAlternatives(operation: string, priority: Priority): Alternative[] {
    const alternatives: Alternative[] = [];
    
    if (priority !== 'critical') {
      alternatives.push({
        description: 'Use local model instead',
        cost: 0,
        quality: 0.7
      });
    }
    
    if (priority === 'low') {
      alternatives.push({
        description: 'Cache result from similar query',
        cost: 0,
        quality: 0.6
      });
    }
    
    alternatives.push({
      description: 'Retry in 5 minutes',
      cost: 0,
      quality: 1.0
    });
    
    return alternatives;
  }

  static async analyzeBudget(costs: any, estimatedCost: number, priority: Priority, userId?: string): Promise<any> {
    const remainingDaily = Math.max(0, 5.0 - costs.daily);
    const remainingMonthly = Math.max(0, 100.0 - costs.monthly);
    const remainingBudget = Math.min(remainingDaily, remainingMonthly);
    
    const priorityQuotas = {
      critical: 0.5,
      high: 0.3,
      medium: 0.15,
      low: 0.05
    };
    
    const allocatedBudget = remainingBudget * priorityQuotas[priority];
    
    return {
      allowed: estimatedCost <= allocatedBudget,
      remainingBudget,
      allocatedBudget,
      reason: estimatedCost > allocatedBudget ? 'Budget quota exceeded for priority level' : 'Within budget'
    };
  }

  static handleBudgetExceeded(analysis: any, operation: string, priority: Priority, cost: number): EnhancedCostDecision {
    return {
      allowed: false,
      reason: analysis.reason,
      suggestedAction: priority === 'critical' ? 'proceed' : 'defer',
      estimatedCost: cost,
      priority,
      alternatives: this.generateAlternatives(operation, priority),
      degradationStrategy: priority === 'critical' ? 'proceed' : 'defer'
    };
  }

  static trackRequest(history: any[], operation: string, cost: number, priority: Priority, userId?: string): void {
    history.push({
      timestamp: Date.now(),
      operation,
      cost,
      priority,
      userId
    });
    
    // Keep only last 1000 requests
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  static cacheDecision(cache: Map<string, any>, key: string, decision: EnhancedCostDecision, ttl: number = 300000): void {
    cache.set(key, {
      decision,
      timestamp: Date.now(),
      ttl
    });
  }

  static groupBatchItems(items: any[]): Map<string, any[]> {
    const grouped = new Map();
    
    for (const item of items) {
      if (!grouped.has(item.operation)) {
        grouped.set(item.operation, []);
      }
      grouped.get(item.operation).push(item);
    }
    
    return grouped;
  }

  static async executeBatchOperation(operation: string, items: any[]): Promise<void> {
    // Mock batch execution - in production would call actual batch API
    console.log(`Executing batch ${operation} with ${items.length} items`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  static resetHourlyMetrics(metrics: any): void {
    metrics.costs.hourly = 0;
    metrics.requests = { successful: 0, failed: 0, cached: 0, batched: 0 };
  }

  static cleanupCache(cache: Map<string, any>): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => cache.delete(key));
  }

  static processIdleBatches(batchQueues: Map<string, any>): void {
    for (const [priority, queue] of batchQueues.entries()) {
      if (queue.items.length > 0 && !queue.processingScheduled) {
        // Process idle batches that haven't been scheduled
        setTimeout(() => queue.flush(), 1000);
      }
    }
  }
}
