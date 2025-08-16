/**
 * RAG Orchestrator - ChatGPT-class quality engine
 * Implements hybrid retrieval, advanced reranking, answerability gates, and citation verification
 */

import { Logger } from '@/core/logging/Logger';
import { costEnforcer } from '@/core/ai/CostEnforcer';
import { supabase } from '@/integrations/supabase/client';
import { InputValidator } from '@/lib/security/InputValidator';
import { 
  ConversationTurn, 
  QueryFilters, 
  UserPreferences, 
  RAGOptions, 
  Source, 
  RAGMetadata, 
  RerankedChunk,
  IntentAnalysis 
} from './RAGTypes';
import { HybridRetriever, AnswerSynthesizer, CitationValidator } from './RAGSupportingClasses';
import { AdvancedReranker } from './AdvancedReranker';
import { RAGUtilityMethods } from './RAGUtilityMethods';

export interface RAGRequest {
  query: string;
  userId: string;
  context?: {
    conversation?: ConversationTurn[];
    filters?: QueryFilters;
    preferences?: UserPreferences;
  };
  options?: RAGOptions;
}

export interface RAGResponse {
  answer: string;
  citations: Citation[];
  confidence: number;
  answerability: number;
  sources: Source[];
  metadata: RAGMetadata;
  reasoning?: ReasoningTrace;
}

export interface TextSpan {
  start: number;
  end: number;
}

export interface Citation {
  id: string;
  text: string;
  sourceId: string;
  confidence: number;
  spans: TextSpan[];
}

export interface ReasoningStep {
  step: string;
  reasoning: string;
  confidence: number;
}

export interface ReasoningTrace {
  steps: ReasoningStep[];
  intentAnalysis: IntentAnalysis;
  retrievalPlan: RetrievalPlan;
  synthesisStrategy: string;
}

export interface AnswerabilityResult {
  canAnswer: boolean;
  confidence: number;
  reasoning: string;
  missingInfo?: string[];
  suggestedQueries?: string[];
}

export class RAGOrchestrator {
  private static instance: RAGOrchestrator;
  private validator = InputValidator.getInstance();
  private hybridRetriever = new HybridRetriever();
  private reranker = new AdvancedReranker();
  private synthesizer = new AnswerSynthesizer();
  private citationValidator = new CitationValidator();
  
  public static getInstance(): RAGOrchestrator {
    if (!RAGOrchestrator.instance) {
      RAGOrchestrator.instance = new RAGOrchestrator();
    }
    return RAGOrchestrator.instance;
  }

  async processQuery(request: RAGRequest): Promise<RAGResponse> {
    const startTime = performance.now();
    const requestId = `rag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    try {
      Logger.info('RAG processing started', { requestId, query: request.query.slice(0, 100) });

      // 1. Validate and sanitize input
      const sanitizedQuery = await this.validateInput(request.query);
      
      // 2. Analyze intent and complexity
      const intentAnalysis = await this.analyzeIntent(sanitizedQuery, request.context);
      
      // 3. Check cost constraints
      const costDecision = await this.checkCostConstraints(intentAnalysis, request.userId);
      if (!costDecision.allowed) {
        return RAGUtilityMethods.handleCostLimitation(costDecision, sanitizedQuery);
      }

      // 4. Execute retrieval strategy
      const retrievalPlan = this.planRetrieval(intentAnalysis, request.options);
      const retrievedChunks = await this.hybridRetriever.retrieve(sanitizedQuery, retrievalPlan);
      
      if (retrievedChunks.length === 0) {
        return RAGUtilityMethods.handleNoResults(sanitizedQuery, requestId);
      }

      // 5. Rerank and filter
      const rerankedChunks = await this.reranker.rerank(sanitizedQuery, retrievedChunks, intentAnalysis);
      
      // 6. Answerability gate
      const answerability = await this.checkAnswerability(sanitizedQuery, rerankedChunks);
      if (!answerability.canAnswer) {
        return this.handleUnanswerable(answerability, sanitizedQuery, requestId);
      }

      // 7. Generate answer with reasoning
      const synthesisResult = await this.synthesizer.generate({
        query: sanitizedQuery,
        chunks: rerankedChunks,
        intent: intentAnalysis,
        answerability,
        userId: request.userId
      });

      // 8. Validate citations
      const validatedCitations = await this.citationValidator.validate(
        synthesisResult.answer,
        synthesisResult.citations,
        rerankedChunks
      );

      // 9. Compute confidence and quality metrics
      const confidence = this.computeConfidence(synthesisResult, validatedCitations, answerability);
      
      const response: RAGResponse = {
        answer: synthesisResult.answer,
        citations: validatedCitations,
        confidence,
        answerability: answerability.confidence,
        sources: RAGUtilityMethods.extractSources(rerankedChunks),
        metadata: {
          requestId,
          processingTime: performance.now() - startTime,
          model: synthesisResult.model,
          tokensUsed: synthesisResult.tokensUsed,
          cost: synthesisResult.cost,
          retrievalStats: {
            totalCandidates: retrievedChunks.length,
            afterRerank: rerankedChunks.length,
            strategy: retrievalPlan.strategy
          }
        },
        reasoning: {
          steps: synthesisResult.reasoning,
          intentAnalysis,
          retrievalPlan,
          synthesisStrategy: synthesisResult.strategy
        }
      };

      // 10. Log metrics and cache
      await this.logMetrics(response, request);
      await RAGUtilityMethods.cacheResponse(sanitizedQuery, response, request.userId);

      Logger.info('RAG processing completed', {
        requestId,
        confidence,
        answerability: answerability.confidence,
        processingTime: response.metadata.processingTime
      });

      return response;

    } catch (error) {
      Logger.error('RAG processing failed', { requestId, error, query: request.query.slice(0, 100) });
      throw error;
    }
  }

  private async validateInput(query: string): Promise<string> {
    // Simple validation - in production would use more robust validation
    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }
    if (query.length > 2000) {
      throw new Error('Query too long');
    }
    
    // Basic sanitization
    return query.trim().replace(/[<>]/g, '');
  }

  private async analyzeIntent(query: string, context?: any): Promise<IntentAnalysis> {
    const complexity = this.analyzeComplexity(query);
    const type = this.classifyQueryType(query);
    const scope = RAGUtilityMethods.determineScope(query, context);
    
    return {
      type,
      complexity,
      scope,
      entities: RAGUtilityMethods.extractEntities(query),
      temporal: RAGUtilityMethods.extractTemporal(query),
      expectedAnswerType: RAGUtilityMethods.predictAnswerType(query, type)
    };
  }

  private async checkCostConstraints(intent: IntentAnalysis, userId: string): Promise<any> {
    const estimatedTokens = RAGUtilityMethods.estimateTokens(intent);
    const estimatedCost = RAGUtilityMethods.estimateCost(intent, estimatedTokens);
    
    return costEnforcer.shouldProceed(
      'rag_query',
      estimatedTokens,
      estimatedCost,
      intent.complexity > 0.7 ? 'high' : 'medium'
    );
  }

  private planRetrieval(intent: IntentAnalysis, options?: RAGOptions): RetrievalPlan {
    const strategy = RAGUtilityMethods.selectRetrievalStrategy(intent);
    const topK = RAGUtilityMethods.computeTopK(intent, strategy);
    const filters = RAGUtilityMethods.buildFilters(intent, options);
    
    return {
      strategy,
      topK,
      filters,
      rerankCount: Math.min(topK * 2, 20),
      includeMetadata: intent.scope.includes('metadata'),
      timeRange: intent.temporal
    };
  }

  private async checkAnswerability(query: string, chunks: RerankedChunk[]): Promise<AnswerabilityResult> {
    if (chunks.length === 0) {
      return {
        canAnswer: false,
        confidence: 0,
        reasoning: 'No relevant sources found',
        suggestedQueries: RAGUtilityMethods.generateSuggestedQueries(query)
      };
    }

    // Evidence scoring
    const evidenceScore = this.computeEvidenceScore(query, chunks);
    const coverageScore = RAGUtilityMethods.computeCoverageScore(query, chunks);
    const coherenceScore = RAGUtilityMethods.computeCoherenceScore(chunks);
    
    const overallScore = (evidenceScore * 0.5) + (coverageScore * 0.3) + (coherenceScore * 0.2);
    const threshold = 0.6;
    
    return {
      canAnswer: overallScore >= threshold,
      confidence: overallScore,
      reasoning: RAGUtilityMethods.explainAnswerability(evidenceScore, coverageScore, coherenceScore),
      missingInfo: overallScore < threshold ? RAGUtilityMethods.identifyMissingInfo(query, chunks) : undefined
    };
  }

  private computeConfidence(synthesis: any, citations: Citation[], answerability: AnswerabilityResult): number {
    const citationScore = citations.length > 0 ? citations.reduce((sum, c) => sum + c.confidence, 0) / citations.length : 0;
    const synthesisScore = synthesis.confidence || 0.5;
    const answerabilityScore = answerability.confidence;
    
    return Math.min(0.95, (citationScore * 0.4) + (synthesisScore * 0.3) + (answerabilityScore * 0.3));
  }

  private handleUnanswerable(answerability: AnswerabilityResult, query: string, requestId: string): RAGResponse {
    return {
      answer: `Je ne peux pas répondre avec certitude à cette question basé sur les informations disponibles. ${answerability.reasoning}`,
      citations: [],
      confidence: 0,
      answerability: answerability.confidence,
      sources: [],
      metadata: {
        requestId,
        processingTime: 0,
        model: 'answerability-gate',
        tokensUsed: 0,
        cost: 0,
        retrievalStats: { totalCandidates: 0, afterRerank: 0, strategy: 'none' }
      }
    };
  }

  // Additional utility methods...
  private analyzeComplexity(query: string): number {
    const words = query.split(/\s+/).length;
    const questions = (query.match(/\?/g) || []).length;
    const concepts = (query.match(/\b(pourquoi|comment|quand|qui|quoi|où)\b/gi) || []).length;
    
    let score = 0;
    if (words > 10) score += 0.3;
    if (questions > 1) score += 0.2;
    if (concepts > 1) score += 0.3;
    if (query.includes('compare') || query.includes('différence')) score += 0.4;
    
    return Math.min(1, score);
  }

  private classifyQueryType(query: string): QueryType {
    const q = query.toLowerCase();
    if (q.includes('comment') || q.includes('explain')) return 'procedural';
    if (q.includes('pourquoi') || q.includes('why')) return 'causal';
    if (q.includes('quand') || q.includes('when')) return 'temporal';
    if (q.includes('qui') || q.includes('who')) return 'entity';
    if (q.includes('compare') || q.includes('différence')) return 'comparative';
    return 'factual';
  }

  private computeEvidenceScore(query: string, chunks: RerankedChunk[]): number {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    let totalScore = 0;
    
    for (const chunk of chunks) {
      const content = chunk.content.toLowerCase();
      const matches = queryTerms.filter(term => content.includes(term)).length;
      const density = matches / queryTerms.length;
      totalScore += density * chunk.score;
    }
    
    return Math.min(1, totalScore / chunks.length);
  }

  private async logMetrics(response: RAGResponse, request: RAGRequest): Promise<void> {
    const metrics = {
      user_id: request.userId,
      operation: 'rag_query',
      model: response.metadata.model,
      request_tokens: RAGUtilityMethods.estimateTokens({ query: request.query }),
      response_tokens: response.metadata.tokensUsed,
      cost_usd: response.metadata.cost,
      latency_ms: response.metadata.processingTime,
      confidence: response.confidence,
      answerability: response.answerability,
      citation_count: response.citations.length,
      cache_hit: false,
      request_fingerprint: await RAGUtilityMethods.generateFingerprint(request.query)
    };

    await supabase.from('ai_logs').insert(metrics);
  }
}

// Supporting classes and interfaces...
interface TimeRange {
  start: Date;
  end: Date;
}

interface RetrievalPlan {
  strategy: RetrievalStrategy;
  topK: number;
  filters: QueryFilters;
  rerankCount: number;
  includeMetadata: boolean;
  timeRange?: TimeRange;
}

type QueryType = 'factual' | 'procedural' | 'causal' | 'temporal' | 'entity' | 'comparative';
type AnswerType = 'short' | 'explanation' | 'list' | 'comparison' | 'process';
type RetrievalStrategy = 'semantic' | 'hybrid' | 'temporal' | 'entity-focused';

export const ragOrchestrator = RAGOrchestrator.getInstance();