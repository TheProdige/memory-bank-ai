/**
 * RAG System Integrator - Main entry point for ChatGPT-class RAG
 */

import { ragOrchestrator, RAGRequest, RAGResponse } from './RAGOrchestrator';
import { ragEvaluationSuite } from '../evaluation/RAGEvaluationSuite';
import { Logger } from '@/core/logging/Logger';
import { enhancedCostEnforcer } from './EnhancedCostEnforcer';

export interface RAGIntegratorConfig {
  evaluationMode: boolean;
  costLimits: {
    maxDailyCost: number;
    maxHourlyCost: number;
    maxTokensPerRequest: number;
  };
  qualityThreshold: number;
  enableCaching: boolean;
}

export class RAGIntegrator {
  private static instance: RAGIntegrator;
  private config: RAGIntegratorConfig;

  constructor(config?: Partial<RAGIntegratorConfig>) {
    this.config = {
      evaluationMode: false,
      costLimits: {
        maxDailyCost: 10.0,
        maxHourlyCost: 2.0,
        maxTokensPerRequest: 4000
      },
      qualityThreshold: 0.6,
      enableCaching: true,
      ...config
    };
  }

  public static getInstance(config?: Partial<RAGIntegratorConfig>): RAGIntegrator {
    if (!RAGIntegrator.instance) {
      RAGIntegrator.instance = new RAGIntegrator(config);
    }
    return RAGIntegrator.instance;
  }

  /**
   * Main RAG query method - handles everything
   */
  async query(request: RAGRequest): Promise<RAGResponse> {
    const startTime = performance.now();
    
    try {
      // Pre-flight checks
      await this.performPreflightChecks(request);

      // Execute RAG pipeline
      const response = await ragOrchestrator.processQuery(request);

      // Post-processing and validation
      const validatedResponse = await this.validateResponse(response, request);

      // Optional: Run evaluation if enabled
      if (this.config.evaluationMode) {
        await this.evaluateResponse(validatedResponse, request);
      }

      Logger.info('RAG query completed successfully', {
        userId: request.userId,
        confidence: response.confidence,
        totalTime: performance.now() - startTime
      });

      return validatedResponse;

    } catch (error) {
      Logger.error('RAG query failed', { error, request: request.query.slice(0, 100) });
      return this.createFallbackResponse(request, error);
    }
  }

  /**
   * Run full evaluation suite for a user
   */
  async runEvaluation(userId: string): Promise<any> {
    Logger.info('Starting RAG evaluation', { userId });
    return ragEvaluationSuite.runFullEvaluation(userId);
  }

  /**
   * Get system metrics and health
   */
  async getSystemMetrics(): Promise<any> {
    const costMetrics = enhancedCostEnforcer.getMetrics();
    
    return {
      cost: costMetrics,
      timestamp: new Date().toISOString(),
      systemHealth: 'healthy' // TODO: Implement health checks
    };
  }

  private async performPreflightChecks(request: RAGRequest): Promise<void> {
    // Validate request format
    if (!request.query || request.query.trim().length === 0) {
      throw new Error('Empty query not allowed');
    }

    if (request.query.length > this.config.costLimits.maxTokensPerRequest * 4) {
      throw new Error('Query too long');
    }

    // Check cost constraints
    const costDecision = await enhancedCostEnforcer.shouldProceed(
      'rag_query',
      Math.ceil(request.query.length / 4),
      0.01,
      'medium'
    );

    if (!costDecision.allowed) {
      throw new Error(`Cost limit exceeded: ${costDecision.reason}`);
    }
  }

  private async validateResponse(response: RAGResponse, request: RAGRequest): Promise<RAGResponse> {
    // Quality checks
    if (response.confidence < this.config.qualityThreshold) {
      Logger.warn('Low confidence response', {
        confidence: response.confidence,
        threshold: this.config.qualityThreshold,
        query: request.query.slice(0, 50)
      });
    }

    // Citation validation
    if (response.citations.length === 0 && response.sources.length > 0) {
      Logger.warn('Response has sources but no citations', {
        sourcesCount: response.sources.length,
        query: request.query.slice(0, 50)
      });
    }

    return response;
  }

  private async evaluateResponse(response: RAGResponse, request: RAGRequest): Promise<void> {
    // Background evaluation - don't block the response
    setTimeout(async () => {
      try {
        // Log evaluation metrics
        Logger.info('Response evaluation', {
          confidence: response.confidence,
          citationCount: response.citations.length,
          sourceCount: response.sources.length,
          cost: response.metadata.cost
        });
      } catch (error) {
        Logger.error('Response evaluation failed', { error });
      }
    }, 100);
  }

  private createFallbackResponse(request: RAGRequest, error: any): RAGResponse {
    return {
      answer: "Je ne peux pas traiter votre demande en ce moment. Veuillez réessayer plus tard.",
      citations: [],
      confidence: 0,
      answerability: 0,
      sources: [],
      metadata: {
        requestId: `fallback_${Date.now()}`,
        processingTime: 0,
        model: 'fallback',
        tokensUsed: 0,
        cost: 0,
        retrievalStats: {
          totalCandidates: 0,
          afterRerank: 0,
          strategy: 'error'
        }
      }
    };
  }
}

// Export singleton
export const ragIntegrator = RAGIntegrator.getInstance();