/**
 * Advanced Reranker - Hybrid scoring with local models
 */

import { Logger } from '@/core/logging/Logger';
import { RerankedChunk, ChunkMetadata, IntentAnalysis, ConversationTurn } from './RAGTypes';

interface RerankingSignals {
  semantic: number;
  lexical: number;
  temporal: number;
  entity: number;
  context: number;
  quality: number;
  diversity: number;
}

interface RerankingConfig {
  strategy: 'semantic' | 'hybrid' | 'adaptive';
  weights: SignalWeights;
  diversityFactor: number;
  qualityThreshold: number;
  maxResults: number;
}

interface SignalWeights {
  semantic: number;
  lexical: number;
  temporal: number;
  entity: number;
  context: number;
  quality: number;
}

interface QueryFeatures {
  text: string;
  terms: string[];
  embedding: number[];
  entities: string[];
  intent: IntentAnalysis;
  concepts: string[];
  temporal: string[];
  contextRelevance: number;
  expectedType: string;
}

interface RetrievedChunk {
  id: string;
  content: string;
  score: number;
  source: string;
  metadata?: ChunkMetadata;
}

interface TemporalFeature {
  hasDate: boolean;
  hasTime: boolean;
  timeReference: 'past' | 'present' | 'future' | 'none';
}

export class AdvancedReranker {
  private config: RerankingConfig;
  private semanticModel: LocalSemanticModel;
  private entityExtractor: EntityExtractor;
  private qualityAnalyzer: ContentQualityAnalyzer;
  private signals: RerankingSignals[] = [];

  constructor(config?: Partial<RerankingConfig>) {
    this.config = {
      strategy: 'adaptive',
      weights: {
        semantic: 0.35,
        lexical: 0.25,
        temporal: 0.1,
        entity: 0.15,
        context: 0.1,
        quality: 0.05
      },
      diversityFactor: 0.2,
      qualityThreshold: 0.3,
      maxResults: 8,
      ...config
    };

    this.semanticModel = new LocalSemanticModel();
    this.entityExtractor = new EntityExtractor();
    this.qualityAnalyzer = new ContentQualityAnalyzer();
  }

  async rerank(
    query: string,
    chunks: RetrievedChunk[],
    intent: IntentAnalysis,
    contextHistory?: ConversationTurn[]
  ): Promise<RerankedChunk[]> {
    const startTime = performance.now();
    
    try {
      Logger.info('Reranking started', { 
        query: query.slice(0, 50),
        chunkCount: chunks.length,
        strategy: this.config.strategy
      });

      // 1. Extract query features for signal computation
      const queryFeatures = await this.extractQueryFeatures(query, intent, contextHistory);

      // 2. Compute reranking signals for each chunk
      const rankedChunks = await Promise.all(
        chunks.map((chunk, index) => this.computeChunkSignals(chunk, queryFeatures, contextHistory, index))
      );

      // 3. Sort by final score
      const sorted = rankedChunks.sort((a, b) => b.score - a.score);

      // 4. Apply quality filter and limit results
      const filtered = sorted
        .filter(chunk => chunk.signals.quality >= this.config.qualityThreshold)
        .slice(0, this.config.maxResults);

      Logger.info('Reranking completed', {
        originalCount: chunks.length,
        finalCount: filtered.length,
        processingTime: performance.now() - startTime
      });

      return filtered;

    } catch (error) {
      Logger.error('Reranking failed', { error, query: query.slice(0, 50) });
      
      // Fallback: return chunks with basic mapping
      return chunks.map((chunk, index) => ({
        id: chunk.id,
        content: chunk.content,
        originalScore: chunk.score,
        score: chunk.score * 0.3 + (1 - index * 0.1) * 0.7,
        rerankScore: 1 - index * 0.1,
        finalScore: chunk.score * 0.3 + (1 - index * 0.1) * 0.7,
        source: chunk.source,
        metadata: chunk.metadata,
        signals: this.createDefaultSignals()
      })).slice(0, this.config.maxResults);
    }
  }

  private extractQueryFeatures(query: string, intent: IntentAnalysis, context?: ConversationTurn[]): QueryFeatures {
    const tokens = query.toLowerCase().split(/\s+/);
    const concepts = query.split(/\s+/).filter(w => w.length > 3);
    const temporal = this.extractTemporalKeywords(query);
    
    let contextRelevance = 0;
    if (context && context.length > 0) {
      const recentContext = context.slice(-3);
      contextRelevance = recentContext.length * 0.1;
    }

    return {
      text: query,
      terms: tokens,
      embedding: [], // Would be computed by semantic model
      entities: intent.entities,
      intent,
      concepts,
      temporal,
      contextRelevance,
      expectedType: intent.expectedAnswerType
    };
  }

  private extractTemporalKeywords(query: string): string[] {
    const temporalWords = ['today', 'yesterday', 'tomorrow', 'week', 'month', 'year', 'recent', 'latest'];
    return temporalWords.filter(word => query.toLowerCase().includes(word));
  }

  private async computeChunkSignals(
    chunk: RetrievedChunk,
    queryFeatures: QueryFeatures,
    context?: ConversationTurn[],
    index: number = 0
  ): Promise<RerankedChunk> {
    
    // Compute various relevance signals
    const semantic = this.computeSemanticScore(chunk.content, queryFeatures.text);
    const lexical = this.computeLexicalScore(chunk.content, queryFeatures.terms);
    const temporal = this.computeTemporalRelevance(chunk, queryFeatures);
    const entity = this.computeEntityRelevance(chunk, queryFeatures);
    const contextScore = this.computeContextRelevance(chunk, context);
    const quality = this.computeQualityScore(chunk);
    const diversity = this.computeDiversityScore(chunk, index);

    const signals: RerankingSignals = {
      semantic,
      lexical,
      temporal,
      entity,
      context: contextScore,
      quality,
      diversity
    };

    // Compute final rerank score using weighted combination
    const weights = this.config.weights;
    const rerankScore = 
      semantic * weights.semantic +
      lexical * weights.lexical +
      temporal * weights.temporal +
      entity * weights.entity +
      contextScore * weights.context +
      quality * weights.quality;

    const finalScore = chunk.score * 0.3 + rerankScore * 0.7;

    return {
      id: chunk.id,
      content: chunk.content,
      originalScore: chunk.score,
      score: finalScore,
      rerankScore,
      finalScore,
      source: chunk.source,
      metadata: chunk.metadata,
      signals
    };
  }

  private computeSemanticScore(content: string, query: string): number {
    // Simple semantic similarity based on term overlap
    const contentTerms = new Set(content.toLowerCase().split(/\s+/));
    const queryTerms = new Set(query.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...queryTerms].filter(term => contentTerms.has(term)));
    return queryTerms.size > 0 ? intersection.size / queryTerms.size : 0;
  }

  private computeLexicalScore(content: string, queryTerms: string[]): number {
    const contentLower = content.toLowerCase();
    const matches = queryTerms.filter(term => contentLower.includes(term.toLowerCase()));
    return queryTerms.length > 0 ? matches.length / queryTerms.length : 0;
  }

  private computeTemporalRelevance(chunk: RetrievedChunk, queryFeatures: QueryFeatures): number {
    if (queryFeatures.temporal.length === 0) return 0.5;
    
    const content = chunk.content.toLowerCase();
    const temporalMatches = queryFeatures.temporal.filter(term => 
      content.includes(term.toLowerCase())
    );
    
    return temporalMatches.length / queryFeatures.temporal.length;
  }

  private computeEntityRelevance(chunk: RetrievedChunk, queryFeatures: QueryFeatures): number {
    if (queryFeatures.entities.length === 0) return 0.5;
    
    const content = chunk.content.toLowerCase();
    const entityMatches = queryFeatures.entities.filter(entity => 
      content.includes(entity.toLowerCase())
    );
    
    return entityMatches.length / queryFeatures.entities.length;
  }

  private computeContextRelevance(chunk: RetrievedChunk, context?: ConversationTurn[]): number {
    if (!context || context.length === 0) return 0.5;
    
    const recentContext = context.slice(-2).map(turn => turn.content.toLowerCase()).join(' ');
    const content = chunk.content.toLowerCase();
    
    const contextWords = recentContext.split(/\s+/).filter(w => w.length > 3);
    const matches = contextWords.filter(word => content.includes(word));
    
    return contextWords.length > 0 ? matches.length / contextWords.length : 0.5;
  }

  private computeQualityScore(chunk: RetrievedChunk): number {
    let score = 0;
    
    // Length penalty for very short chunks
    if (chunk.content.length < 100) score -= 0.2;
    
    // Boost for structured content
    if (chunk.content.includes('\n') || chunk.content.includes('•')) score += 0.1;
    
    // Metadata quality
    if (chunk.metadata?.title) score += 0.1;
    if (chunk.metadata?.date) score += 0.05;
    
    return Math.max(0, Math.min(1, score + 0.5));
  }

  private computeDiversityScore(chunk: RetrievedChunk, index: number): number {
    // Simple diversity based on position - later chunks get slight boost if different
    return Math.max(0.1, 1.0 - (index * 0.1));
  }

  private createDefaultSignals(): RerankingSignals {
    return {
      semantic: 0.5,
      lexical: 0.5,
      temporal: 0.5,
      entity: 0.5,
      context: 0.5,
      quality: 0.5,
      diversity: 0.5
    };
  }
}

// Supporting classes
class LocalSemanticModel {
  async encode(text: string): Promise<number[]> {
    // Simplified local embedding using word hashing
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const dimension = 384;
    const embedding = new Array(dimension).fill(0);
    
    for (const word of words) {
      const hash = this.simpleHash(word);
      const index = Math.abs(hash) % dimension;
      embedding[index] += 1 / Math.sqrt(words.length);
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (magnitude || 1));
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return hash;
  }
}

class EntityExtractor {
  extract(text: string): string[] {
    const entities: string[] = [];
    
    // Simple named entity patterns
    const patterns = [
      /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Person names
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, // Dates
      /\b\d{1,2}h\d{0,2}\b/g, // Times
      /\b[A-Z][a-zA-Z]+ [A-Z][a-zA-Z]+\b/g // Companies/Organizations
    ];
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      entities.push(...matches);
    });
    
    return [...new Set(entities)]; // Remove duplicates
  }
}

class ContentQualityAnalyzer {
  analyze(content: string): number {
    let score = 0;
    
    // Length check (not too short, not too long)
    const length = content.length;
    if (length >= 50 && length <= 500) score += 0.3;
    else if (length >= 20) score += 0.1;
    
    // Sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length >= 2) score += 0.2;
    
    // Word diversity
    const words = content.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const diversity = uniqueWords.size / words.length;
    score += diversity * 0.3;
    
    // Coherence (simple check for transition words)
    const transitionWords = ['donc', 'puis', 'ensuite', 'cependant', 'moreover', 'however'];
    const hasTransitions = transitionWords.some(tw => content.toLowerCase().includes(tw));
    if (hasTransitions) score += 0.2;
    
    return Math.min(1, score);
  }
}

// Export the class
export default AdvancedReranker;