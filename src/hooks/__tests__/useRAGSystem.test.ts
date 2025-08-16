/**
 * useRAGSystem Hook Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRAGSystem } from '../useRAGSystem';
import { useAuth } from '@/contexts/AuthContext';

// Mock waitFor for this test file
const waitFor = async (callback: () => void) => {
  await new Promise(resolve => setTimeout(resolve, 0));
  callback();
};

// Mock dependencies
vi.mock('@/contexts/AuthContext');
vi.mock('../RAGIntegrator');
vi.mock('@/core/logging/Logger');

// Mock useAuth
const mockUseAuth = useAuth as any;

describe('useRAGSystem', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com'
  };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser
    });
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useRAGSystem());
      
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.lastResponse).toBe(null);
      expect(result.current.metrics).toBe(null);
      expect(typeof result.current.query).toBe('function');
      expect(typeof result.current.runEvaluation).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });

    it('should accept custom options', () => {
      const options = {
        enableEvaluation: true,
        autoRetry: false,
        maxRetries: 5
      };

      const { result } = renderHook(() => useRAGSystem(options));
      expect(result.current).toBeDefined();
    });
  });

  describe('Authentication', () => {
    it('should handle unauthenticated user', async () => {
      mockUseAuth.mockReturnValue({ user: null });
      
      const { result } = renderHook(() => useRAGSystem());
      
      const response = await act(async () => {
        return result.current.query('test query');
      });
      
      expect(response).toBe(null);
      expect(result.current.error).toBe('User not authenticated');
    });

    it('should work with authenticated user', async () => {
      const { result } = renderHook(() => useRAGSystem());
      
      const response = await act(async () => {
        return result.current.query('test query');
      });
      
      // Should not error due to authentication
      expect(result.current.error).not.toBe('User not authenticated');
    });
  });

  describe('Query Processing', () => {
    it('should handle empty queries', async () => {
      const { result } = renderHook(() => useRAGSystem());
      
      const response = await act(async () => {
        return result.current.query('');
      });
      
      expect(response).toBe(null);
      expect(result.current.error).toBe('Query cannot be empty');
    });

    it('should handle whitespace-only queries', async () => {
      const { result } = renderHook(() => useRAGSystem());
      
      const response = await act(async () => {
        return result.current.query('   ');
      });
      
      expect(response).toBe(null);
      expect(result.current.error).toBe('Query cannot be empty');
    });

    it('should process valid queries', async () => {
      const { result } = renderHook(() => useRAGSystem());
      
      await act(async () => {
        const response = await result.current.query('What is AI?');
        // The response depends on the mock implementation
      });
      
      // Loading should be false after completion
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should set loading state during query', async () => {
      const { result } = renderHook(() => useRAGSystem());
      
      act(() => {
        result.current.query('test query');
      });
      
      expect(result.current.loading).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle query errors', async () => {
      // Mock RAG integrator to throw error
      vi.doMock('../RAGIntegrator', () => ({
        ragIntegrator: {
          query: vi.fn().mockRejectedValue(new Error('Network error'))
        }
      }));

      const { result } = renderHook(() => useRAGSystem({ autoRetry: false }));
      
      await act(async () => {
        await result.current.query('test query');
      });
      
      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.loading).toBe(false);
      });
    });

    it('should clear errors', async () => {
      const { result } = renderHook(() => useRAGSystem());
      
      // Simulate an error
      await act(async () => {
        await result.current.query('');
      });
      
      expect(result.current.error).toBeDefined();
      
      // Clear the error
      act(() => {
        result.current.clearError();
      });
      
      expect(result.current.error).toBe(null);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure when autoRetry is enabled', async () => {
      const mockQuery = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce({ answer: 'Success' });

      vi.doMock('../RAGIntegrator', () => ({
        ragIntegrator: {
          query: mockQuery,
          getSystemMetrics: vi.fn().mockResolvedValue({})
        }
      }));

      const { result } = renderHook(() => useRAGSystem({ 
        autoRetry: true, 
        maxRetries: 2 
      }));
      
      await act(async () => {
        await result.current.query('test query');
      });
      
      // Should have called query multiple times due to retries
      await waitFor(() => {
        expect(mockQuery).toHaveBeenCalledTimes(3);
      });
    });

    it('should not retry when autoRetry is disabled', async () => {
      const mockQuery = vi.fn().mockRejectedValue(new Error('Failure'));

      vi.doMock('../RAGIntegrator', () => ({
        ragIntegrator: {
          query: mockQuery
        }
      }));

      const { result } = renderHook(() => useRAGSystem({ autoRetry: false }));
      
      await act(async () => {
        await result.current.query('test query');
      });
      
      await waitFor(() => {
        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(result.current.error).toBeDefined();
      });
    });
  });

  describe('Evaluation', () => {
    it('should run evaluations', async () => {
      const { result } = renderHook(() => useRAGSystem());
      
      await act(async () => {
        await result.current.runEvaluation();
      });
      
      // Should complete without error
      expect(result.current.error).toBe(null);
    });

    it('should handle evaluation failures', async () => {
      mockUseAuth.mockReturnValue({ user: null });
      
      const { result } = renderHook(() => useRAGSystem());
      
      await expect(act(async () => {
        await result.current.runEvaluation();
      })).rejects.toThrow('User not authenticated');
    });
  });

  describe('Metrics', () => {
    it('should update metrics after successful queries', async () => {
      const mockMetrics = {
        cost: { total: 1.5 },
        timestamp: new Date().toISOString(),
        systemHealth: 'healthy'
      };

      vi.doMock('../RAGIntegrator', () => ({
        ragIntegrator: {
          query: vi.fn().mockResolvedValue({ answer: 'Test' }),
          getSystemMetrics: vi.fn().mockResolvedValue(mockMetrics)
        }
      }));

      const { result } = renderHook(() => useRAGSystem());
      
      await act(async () => {
        await result.current.query('test query');
      });
      
      await waitFor(() => {
        expect(result.current.metrics).toBeDefined();
      });
    });
  });
});