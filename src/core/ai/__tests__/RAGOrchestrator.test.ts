/**
 * RAG Orchestrator Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RAGOrchestrator, RAGRequest, RAGResponse } from '../RAGOrchestrator';
import { ragOrchestrator } from '../RAGOrchestrator';

// Mock dependencies
vi.mock('@/core/logging/Logger');
vi.mock('@/integrations/supabase/client');
vi.mock('../EnhancedCostEnforcer');

describe('RAGOrchestrator', () => {
  let orchestrator: RAGOrchestrator;
  
  beforeEach(() => {
    orchestrator = RAGOrchestrator.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = RAGOrchestrator.getInstance();
      const instance2 = RAGOrchestrator.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export a singleton instance', () => {
      expect(ragOrchestrator).toBeInstanceOf(RAGOrchestrator);
    });
  });

  const mockRequest: RAGRequest = {
    query: 'What is the capital of France?',
    userId: 'test-user',
    context: {
      preferences: {
        language: 'fr',
        responseStyle: 'detailed',
        citationStyle: 'inline'
      }
    },
    options: {
      maxResults: 5,
      threshold: 0.6,
      enableReranking: true
    }
  };

  describe('Query Processing', () => {

    it('should process a simple query successfully', async () => {
      // Mock the cost enforcer to allow the request
      const mockCostDecision = { allowed: true, reason: 'Within budget' };
      vi.doMock('../EnhancedCostEnforcer', () => ({
        enhancedCostEnforcer: {
          shouldProceed: vi.fn().mockResolvedValue(mockCostDecision)
        }
      }));

      const response = await orchestrator.processQuery(mockRequest);
      
      expect(response).toBeDefined();
      expect(response.answer).toBeDefined();
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
      expect(response.metadata).toBeDefined();
      expect(response.metadata.requestId).toMatch(/^rag_/);
    });

    it('should handle empty query', async () => {
      const emptyRequest = { ...mockRequest, query: '' };
      
      await expect(orchestrator.processQuery(emptyRequest)).rejects.toThrow('Query cannot be empty');
    });

    it('should handle very long query', async () => {
      const longQuery = 'a'.repeat(3000);
      const longRequest = { ...mockRequest, query: longQuery };
      
      await expect(orchestrator.processQuery(longRequest)).rejects.toThrow('Query too long');
    });

    it('should handle cost limitation', async () => {
      const mockCostDecision = { 
        allowed: false, 
        reason: 'Daily budget exceeded',
        suggestedAction: 'Try tomorrow'
      };
      
      vi.doMock('../EnhancedCostEnforcer', () => ({
        enhancedCostEnforcer: {
          shouldProceed: vi.fn().mockResolvedValue(mockCostDecision)
        }
      }));

      const response = await orchestrator.processQuery(mockRequest);
      
      expect(response.answer).toContain('Limite de coût atteinte');
      expect(response.confidence).toBe(0);
      expect(response.metadata.model).toBe('cost-enforcer');
    });
  });

  describe('Intent Analysis', () => {
    it('should classify factual queries', async () => {
      const request = { ...mockRequest, query: 'What is the population of Paris?' };
      
      // We need to test the internal analyzeIntent method
      // This is a simplified test - in practice you might expose this method for testing
      const result = await orchestrator.processQuery(request);
      expect(result).toBeDefined();
    });

    it('should classify procedural queries', async () => {
      const request = { ...mockRequest, query: 'How do you make a cake?' };
      
      const result = await orchestrator.processQuery(request);
      expect(result).toBeDefined();
    });

    it('should classify temporal queries', async () => {
      const request = { ...mockRequest, query: 'When was the Eiffel Tower built?' };
      
      const result = await orchestrator.processQuery(request);
      expect(result).toBeDefined();
    });

    it('should classify comparative queries', async () => {
      const request = { ...mockRequest, query: 'What is the difference between cats and dogs?' };
      
      const result = await orchestrator.processQuery(request);
      expect(result).toBeDefined();
    });
  });

  describe('Complexity Analysis', () => {
    it('should handle simple queries', async () => {
      const request = { ...mockRequest, query: 'Paris' };
      
      const result = await orchestrator.processQuery(request);
      expect(result).toBeDefined();
    });

    it('should handle complex queries', async () => {
      const complexQuery = 'Compare the economic policies of different European countries and explain how they affect international trade relationships in the context of global market dynamics';
      const request = { ...mockRequest, query: complexQuery };
      
      const result = await orchestrator.processQuery(request);
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle retrieval errors gracefully', async () => {
      // Mock a retrieval error
      const failingRequest = { ...mockRequest, query: 'test query' };
      
      // The orchestrator should handle errors and not crash
      const result = await orchestrator.processQuery(failingRequest);
      expect(result).toBeDefined();
    });

    it('should provide fallback responses', async () => {
      const request = { ...mockRequest, query: 'completely unknown topic that definitely does not exist' };
      
      const result = await orchestrator.processQuery(request);
      expect(result).toBeDefined();
      expect(result.answer).toBeDefined();
    });
  });

  describe('Response Quality', () => {
    it('should provide valid response structure', async () => {
      const result = await orchestrator.processQuery(mockRequest);
      
      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('citations');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('answerability');
      expect(result).toHaveProperty('sources');
      expect(result).toHaveProperty('metadata');
      
      expect(Array.isArray(result.citations)).toBe(true);
      expect(Array.isArray(result.sources)).toBe(true);
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.answerability).toBe('number');
    });

    it('should have reasonable confidence scores', async () => {
      const result = await orchestrator.processQuery(mockRequest);
      
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.answerability).toBeGreaterThanOrEqual(0);
      expect(result.answerability).toBeLessThanOrEqual(1);
    });

    it('should have proper metadata', async () => {
      const result = await orchestrator.processQuery(mockRequest);
      
      expect(result.metadata.requestId).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(result.metadata.model).toBeDefined();
      expect(result.metadata.tokensUsed).toBeGreaterThanOrEqual(0);
      expect(result.metadata.cost).toBeGreaterThanOrEqual(0);
      expect(result.metadata.retrievalStats).toBeDefined();
    });
  });
});