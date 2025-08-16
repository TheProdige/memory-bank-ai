/**
 * RAG Integrator Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RAGIntegrator, ragIntegrator } from '../RAGIntegrator';
import { RAGRequest } from '../RAGOrchestrator';

// Mock dependencies
vi.mock('../RAGOrchestrator');
vi.mock('../EnhancedCostEnforcer');
vi.mock('../../evaluation/RAGEvaluationSuite');
vi.mock('@/core/logging/Logger');

describe('RAGIntegrator', () => {
  let integrator: RAGIntegrator;

  beforeEach(() => {
    integrator = RAGIntegrator.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = RAGIntegrator.getInstance();
      const instance2 = RAGIntegrator.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export a singleton instance', () => {
      expect(ragIntegrator).toBeInstanceOf(RAGIntegrator);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const defaultIntegrator = RAGIntegrator.getInstance();
      expect(defaultIntegrator).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        evaluationMode: true,
        costLimits: {
          maxDailyCost: 20.0,
          maxHourlyCost: 5.0,
          maxTokensPerRequest: 8000
        },
        qualityThreshold: 0.8
      };

      const customIntegrator = new RAGIntegrator(customConfig);
      expect(customIntegrator).toBeDefined();
    });
  });

  describe('Query Processing', () => {
    const mockRequest: RAGRequest = {
      query: 'Test query',
      userId: 'test-user',
      context: {
        preferences: {
          language: 'fr',
          responseStyle: 'detailed',
          citationStyle: 'inline'
        }
      }
    };

    it('should process queries successfully', async () => {
      const result = await integrator.query(mockRequest);
      expect(result).toBeDefined();
    });

    it('should handle pre-flight check failures', async () => {
      const emptyRequest = { ...mockRequest, query: '' };
      const result = await integrator.query(emptyRequest);
      
      // Should return fallback response
      expect(result).toBeDefined();
      expect(result.answer).toContain('ne peux pas traiter');
    });

    it('should handle very long queries', async () => {
      const longQuery = 'a'.repeat(20000);
      const longRequest = { ...mockRequest, query: longQuery };
      
      const result = await integrator.query(longRequest);
      expect(result).toBeDefined();
      expect(result.answer).toContain('ne peux pas traiter');
    });
  });

  describe('Cost Management', () => {
    const mockRequest: RAGRequest = {
      query: 'Expensive query that might exceed limits',
      userId: 'test-user'
    };

    it('should enforce cost limits', async () => {
      // Mock cost enforcer to deny request
      vi.doMock('../EnhancedCostEnforcer', () => ({
        enhancedCostEnforcer: {
          shouldProceed: vi.fn().mockResolvedValue({
            allowed: false,
            reason: 'Daily budget exceeded'
          })
        }
      }));

      const result = await integrator.query(mockRequest);
      expect(result).toBeDefined();
      expect(result.answer).toContain('ne peux pas traiter');
    });
  });

  describe('Evaluation', () => {
    it('should run evaluations for users', async () => {
      const userId = 'test-user';
      const result = await integrator.runEvaluation(userId);
      expect(result).toBeDefined();
    });
  });

  describe('System Metrics', () => {
    it('should provide system metrics', async () => {
      const metrics = await integrator.getSystemMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.cost).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
      expect(metrics.systemHealth).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should provide fallback responses on errors', async () => {
      const invalidRequest: any = { invalid: 'request' };
      
      const result = await integrator.query(invalidRequest);
      expect(result).toBeDefined();
      expect(result.answer).toContain('ne peux pas traiter');
      expect(result.confidence).toBe(0);
    });

    it('should handle orchestrator failures gracefully', async () => {
      // Mock orchestrator to throw error
      vi.doMock('../RAGOrchestrator', () => ({
        ragOrchestrator: {
          processQuery: vi.fn().mockRejectedValue(new Error('Orchestrator failed'))
        }
      }));

      const mockRequest: RAGRequest = {
        query: 'Test query',
        userId: 'test-user'
      };

      const result = await integrator.query(mockRequest);
      expect(result).toBeDefined();
      expect(result.metadata.model).toBe('fallback');
    });
  });

  describe('Response Validation', () => {
    const mockRequest: RAGRequest = {
      query: 'Test query for validation',
      userId: 'test-user'
    };

    it('should validate response quality', async () => {
      const result = await integrator.query(mockRequest);
      expect(result).toBeDefined();
      
      // Quality validation should not block response
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should validate citations', async () => {
      const result = await integrator.query(mockRequest);
      expect(result).toBeDefined();
      
      // Citations validation
      expect(Array.isArray(result.citations)).toBe(true);
      expect(Array.isArray(result.sources)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete queries in reasonable time', async () => {
      const start = performance.now();
      
      const mockRequest: RAGRequest = {
        query: 'Performance test query',
        userId: 'test-user'
      };

      const result = await integrator.query(mockRequest);
      const duration = performance.now() - start;
      
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });
  });
});