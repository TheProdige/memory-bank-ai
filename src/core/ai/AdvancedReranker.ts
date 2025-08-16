/**
 * Advanced Local Reranker - Production-grade reranking with multiple strategies
 */

import { Logger } from '@/core/logging/Logger';

export interface RerankedChunk {
  id: string;
  content: string;
  originalScore: number;
  rerankScore: number;
  finalScore: number;
  source: string;
  metadata?: ChunkMetadata;
  signals: RerankingSignals;
}

export interface RerankingSignals {
  semantic: number;
  lexical: number;
  temporal: number;
  entity: number;
  context: number;
  quality: number;
}

export interface RerankingConfig {
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

export class AdvancedReranker {
  private config: RerankingConfig;
  private semanticModel: LocalSemanticModel;
  private entityExtractor: EntityExtractor;
  private qualityAnalyzer: ContentQualityAnalyzer;

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

      // 1. Compute adaptive weights based on query intent
      const adaptiveWeights = this.computeAdaptiveWeights(intent, query);

      // 2. Extract query features for signal computation
      const queryFeatures = await this.extractQueryFeatures(query, intent);

      // 3. Compute reranking signals for each chunk
      const rerankedChunks = await Promise.all(
        chunks.map(chunk => this.computeChunkSignals(chunk, queryFeatures, contextHistory))
      );

      // 4. Apply diversity filtering
      const diversifiedChunks = this.applyDiversityFiltering(
        rerankedChunks,
        this.config.diversityFactor
      );

      // 5. Final ranking with adaptive weights
      const finalRanked = this.computeFinalRanking(diversifiedChunks, adaptiveWeights);

      // 6. Filter by quality threshold
      const qualityFiltered = finalRanked.filter(
        chunk => chunk.signals.quality >= this.config.qualityThreshold
      );

      // 7. Limit results
      const results = qualityFiltered.slice(0, this.config.maxResults);

      Logger.info('Reranking completed', {
        originalCount: chunks.length,
        afterDiversity: diversifiedChunks.length,
        afterQuality: qualityFiltered.length,
        finalCount: results.length,
        processingTime: performance.now() - startTime
      });

      return results;

    } catch (error) {
      Logger.error('Reranking failed', { error, query: query.slice(0, 50) });
      
      // Fallback: return chunks sorted by original score
      return chunks.map(chunk => ({
        ...chunk,
        rerankScore: chunk.score,
        finalScore: chunk.score,
        signals: this.createDefaultSignals()
      })).slice(0, this.config.maxResults);
    }
  }

  private computeAdaptiveWeights(intent: IntentAnalysis, query: string): SignalWeights {
    const baseWeights = { ...this.config.weights };
    
    // Adjust weights based on query characteristics
    switch (intent.type) {
      case 'factual':
        baseWeights.semantic += 0.1;
        baseWeights.entity += 0.1;
        baseWeights.lexical -= 0.1;
        break;
        
      case 'temporal':
        baseWeights.temporal += 0.2;
        baseWeights.semantic -= 0.1;
        break;
        
      case 'procedural':
        baseWeights.context += 0.15;
        baseWeights.quality += 0.1;
        break;
        
      case 'comparative':
        baseWeights.diversity = 0.3; // Special handling for diversity
        baseWeights.semantic += 0.05;
        break;
    }

    // Adjust for query complexity
    if (intent.complexity > 0.7) {
      baseWeights.context += 0.1;
      baseWeights.quality += 0.05;
    }

    // Normalize weights to sum to 1
    const total = Object.values(baseWeights).reduce((sum, w) => sum + w, 0);
    for (const key in baseWeights) {
      baseWeights[key as keyof SignalWeights] /= total;
    }

    return baseWeights;
  }

  private async extractQueryFeatures(query: string, intent: IntentAnalysis): Promise<QueryFeatures> {
    const queryTerms = this.tokenizeQuery(query);
    const queryEmbedding = await this.semanticModel.encode(query);
    const queryEntities = this.entityExtractor.extract(query);
    
    return {
      text: query,
      terms: queryTerms,
      embedding: queryEmbedding,
      entities: queryEntities,
      intent,
      concepts: this.extractConcepts(query),
      temporal: this.extractTemporalFeatures(query)
    };
  }

  private async computeChunkSignals(
    chunk: RetrievedChunk,
    queryFeatures: QueryFeatures,
    contextHistory?: ConversationTurn[]
  ): Promise<RerankedChunk> {
    
    // Semantic similarity
    const chunkEmbedding = await this.semanticModel.encode(chunk.content);
    const semanticScore = this.computeCosineSimilarity(queryFeatures.embedding, chunkEmbedding);

    // Lexical overlap (BM25-style)
    const lexicalScore = this.computeBM25Score(queryFeatures.terms, chunk.content);

    // Entity matching
    const chunkEntities = this.entityExtractor.extract(chunk.content);
    const entityScore = this.computeEntityOverlap(queryFeatures.entities, chunkEntities);

    // Temporal relevance
    const temporalScore = this.computeTemporalRelevance(
      queryFeatures.temporal,
      chunk.metadata?.timestamp
    );

    // Context relevance (if conversation history available)
    const contextScore = contextHistory 
      ? this.computeContextRelevance(chunk.content, contextHistory)
      : 0.5; // neutral if no context

    // Content quality
    const qualityScore = this.qualityAnalyzer.analyze(chunk.content);

    const signals: RerankingSignals = {
      semantic: semanticScore,
      lexical: lexicalScore,
      temporal: temporalScore,
      entity: entityScore,
      context: contextScore,
      quality: qualityScore
    };

    return {
      id: chunk.id,
      content: chunk.content,
      originalScore: chunk.score,
      rerankScore: 0, // Will be computed in final ranking
      finalScore: 0,   // Will be computed in final ranking
      source: chunk.source,
      metadata: chunk.metadata,
      signals
    };
  }

  private computeFinalRanking(chunks: RerankedChunk[], weights: SignalWeights): RerankedChunk[] {
    return chunks.map(chunk => {
      const rerankScore = 
        chunk.signals.semantic * weights.semantic +
        chunk.signals.lexical * weights.lexical +
        chunk.signals.temporal * weights.temporal +
        chunk.signals.entity * weights.entity +
        chunk.signals.context * weights.context +
        chunk.signals.quality * weights.quality;

      // Combine with original score using harmonic mean for balanced consideration
      const finalScore = 2 * (chunk.originalScore * rerankScore) / (chunk.originalScore + rerankScore);

      return {
        ...chunk,
        rerankScore,
        finalScore
      };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }

  private applyDiversityFiltering(chunks: RerankedChunk[], diversityFactor: number): RerankedChunk[] {
    if (diversityFactor === 0 || chunks.length <= 1) return chunks;

    const diversified: RerankedChunk[] = [];
    const used = new Set<string>();

    // Always include the top result
    if (chunks.length > 0) {
      diversified.push(chunks[0]);
      used.add(this.getContentSignature(chunks[0].content));
    }

    for (const chunk of chunks.slice(1)) {
      const signature = this.getContentSignature(chunk.content);
      
      // Check similarity with already selected chunks
      const isSimilar = Array.from(used).some(usedSig => 
        this.computeContentSimilarity(signature, usedSig) > (1 - diversityFactor)
      );

      if (!isSimilar) {
        diversified.push(chunk);
        used.add(signature);
      }
    }

    return diversified;
  }

  // Utility methods
  private computeBM25Score(queryTerms: string[], content: string): number {
    const k1 = 1.2;
    const b = 0.75;
    const avgDocLength = 100; // Approximate average chunk length in words
    
    const docTerms = content.toLowerCase().split(/\s+/);
    const docLength = docTerms.length;
    
    let score = 0;
    for (const term of queryTerms) {
      const tf = docTerms.filter(t => t === term).length;
      const idf = Math.log((1000 + 1) / (1 + 1)); // Simplified IDF
      
      score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgDocLength)));
    }
    
    return Math.min(1, score / queryTerms.length);
  }

  private computeCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private computeEntityOverlap(queryEntities: string[], chunkEntities: string[]): number {
    if (queryEntities.length === 0) return 0.5; // Neutral if no entities in query
    
    const intersection = queryEntities.filter(e => 
      chunkEntities.some(ce => this.entitiesMatch(e, ce))
    );
    
    return intersection.length / queryEntities.length;
  }

  private entitiesMatch(entity1: string, entity2: string): boolean {
    const e1 = entity1.toLowerCase().trim();
    const e2 = entity2.toLowerCase().trim();
    
    // Exact match
    if (e1 === e2) return true;
    
    // Partial match for longer entities
    if (e1.length > 3 && e2.length > 3) {
      return e1.includes(e2) || e2.includes(e1);
    }
    
    return false;
  }

  private getContentSignature(content: string): string {
    // Create a simple signature based on key terms
    const words = content.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4)
      .slice(0, 10)
      .sort();
    
    return words.join('|');
  }

  private computeContentSimilarity(sig1: string, sig2: string): number {
    const words1 = new Set(sig1.split('|'));
    const words2 = new Set(sig2.split('|'));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private createDefaultSignals(): RerankingSignals {
    return {
      semantic: 0.5,
      lexical: 0.5,
      temporal: 0.5,
      entity: 0.5,
      context: 0.5,
      quality: 0.5
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

// Interfaces
interface QueryFeatures {
  text: string;
  terms: string[];
  embedding: number[];
  entities: string[];
  intent: IntentAnalysis;
  concepts: string[];
  temporal?: TemporalFeature;
}

interface RetrievedChunk {
  id: string;
  content: string;
  score: number;
  source: string;
  metadata?: ChunkMetadata;
}

interface ChunkMetadata {
  timestamp?: Date;
  author?: string;
  category?: string;
  tags?: string[];
}

interface TemporalFeature {
  hasDate: boolean;
  hasTime: boolean;
  timeReference: 'past' | 'present' | 'future' | 'none';
}

export { AdvancedReranker };