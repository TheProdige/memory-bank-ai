/**
 * React hook for the integrated RAG system
 */

import { useState, useCallback } from 'react';
import { ragIntegrator } from '@/core/ai/RAGIntegrator';
import { RAGRequest, RAGResponse } from '@/core/ai/RAGOrchestrator';
import { Logger } from '@/core/logging/Logger';
import { useAuth } from '@/contexts/AuthContext';

interface UseRAGSystemOptions {
  enableEvaluation?: boolean;
  autoRetry?: boolean;
  maxRetries?: number;
}

interface UseRAGSystemReturn {
  query: (query: string, options?: Partial<RAGRequest>) => Promise<RAGResponse | null>;
  loading: boolean;
  error: string | null;
  lastResponse: RAGResponse | null;
  metrics: any;
  runEvaluation: () => Promise<any>;
  clearError: () => void;
}

export const useRAGSystem = (options: UseRAGSystemOptions = {}): UseRAGSystemReturn => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<RAGResponse | null>(null);
  const [metrics, setMetrics] = useState<any>(null);

  const {
    enableEvaluation = false,
    autoRetry = true,
    maxRetries = 2
  } = options;

  const query = useCallback(async (
    queryText: string, 
    requestOptions: Partial<RAGRequest> = {}
  ): Promise<RAGResponse | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    if (!queryText.trim()) {
      setError('Query cannot be empty');
      return null;
    }

    setLoading(true);
    setError(null);

    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        const request: RAGRequest = {
          query: queryText,
          userId: user.id,
          context: {
            conversation: [],
            filters: {},
            preferences: {
              language: 'fr',
              responseStyle: 'detailed',
              citationStyle: 'inline'
            }
          },
          options: {
            maxResults: 5,
            threshold: 0.6,
            enableReranking: true,
            useLocalOnly: false
          },
          ...requestOptions
        };

        Logger.info('RAG query started', { 
          query: queryText.slice(0, 50), 
          userId: user.id,
          retryCount 
        });

        const response = await ragIntegrator.query(request);
        
        setLastResponse(response);
        setLoading(false);

        // Update metrics
        const systemMetrics = await ragIntegrator.getSystemMetrics();
        setMetrics(systemMetrics);

        Logger.info('RAG query completed', {
          confidence: response.confidence,
          sourcesCount: response.sources.length,
          cost: response.metadata.cost
        });

        return response;

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        Logger.error('RAG query failed', { 
          error: err, 
          retryCount, 
          query: queryText.slice(0, 50) 
        });

        if (retryCount < maxRetries && autoRetry) {
          retryCount++;
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          continue;
        }

        setError(errorMessage);
        setLoading(false);
        return null;
      }
    }

    return null;
  }, [user, autoRetry, maxRetries]);

  const runEvaluation = useCallback(async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    Logger.info('Starting RAG evaluation', { userId: user.id });
    return ragIntegrator.runEvaluation(user.id);
  }, [user]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    query,
    loading,
    error,
    lastResponse,
    metrics,
    runEvaluation,
    clearError
  };
};